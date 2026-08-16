import GameStateManager from '../managers/GameStateManager.js';
import creditTimerManager from '../managers/CreditTimerManager.js';
import prisonTimerManager from '../managers/PrisonTimerManager.js';
import autoSeizureTimerManager from '../managers/AutoSeizureTimerManager.js';
import socket from '#config/socket';
import log from '#config/log';
import Timer from '../../misc/Timer.js';
import { CREDIT_STATUS, GAME_STATUS, GAME_TYPE, PLAYER_STATUS, CREDIT_ORIGIN, ROOMS, IO, DB_EVENTS } from '@geco/shared';
import BankEngine from '../engine/bank.engine.js';
import SyncHelper from '../helpers/sync.helper.js';
import { computeAverageMoney, computeEffectiveRate } from '../helpers/bank.helper.js';

const minute = 60 * 1000;
const fiveSeconds = 5 * 1000;
// Auto Seizure: purely cosmetic "police is processing" wait before the backend resolves a FAULT
// credit on its own. See docs/adr/0005-auto-seizure.md.
const AUTO_SEIZURE_DELAY_MS = 10 * 1000;

const BankStateService = {};

// ─── Timer factories ─────────────────────────────────────────────────────────

/** A credit's maturity timer, with a 5s heartbeat driving the client progress bar. */
const _createCreditTimer = (gameStateId, credit) =>
	new Timer(
		credit.id,
		{ ...credit, gameStateId },
		credit.remainingTime,
		_creditTimeoutCallback,
		fiveSeconds,
		_creditHeartBeatCallback
	);

/** The cosmetic "police is processing" delay before the backend collects on its own. */
const _createAutoSeizureTimer = (gameStateId, playerStateIdx) =>
	new Timer(
		`${gameStateId}-${playerStateIdx}`,
		{ gameStateId, playerStateIdx },
		AUTO_SEIZURE_DELAY_MS,
		_autoSeizureCallback
	);

/** A prison sentence's timer, with a 5s heartbeat driving the countdown. */
const _createPrisonTimer = (gameStateId, playerStateIdx, prisonTimeMinutes) =>
	new Timer(
		`${gameStateId}-${playerStateIdx}`,
		{ gameStateId, playerStateIdx, totalMs: prisonTimeMinutes * minute },
		prisonTimeMinutes * minute,
		_prisonEndCallback,
		fiveSeconds,
		_prisonProgressCallback
	);

// ─── Shared side effects ─────────────────────────────────────────────────────

/** Start the new credit's clock if the round is running, then tell every room about it. */
const _afterCreditCreated = async (gameStateId, entry, created) => {
	const { credit, playerState, startNow } = created;
	if (startNow) await creditTimerManager.startTimer(_createCreditTimer(gameStateId, credit));

	const indicators = BankEngine.bankIndicators(entry.gameState);
	socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.NEW, { credit, ...indicators });
	socket.emitTo(ROOMS.gameStateMaster(gameStateId), IO.CREDIT.NEW, { credit, ...indicators });
	socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.NEW, {
		credit,
		coinsLK: playerState.coins,
	});
	SyncHelper.emitPlayerSync(gameStateId, [playerState]);

	return { credit, ...indicators };
};

/** Free a player from prison and give both the player and the Table the news. */
const _releasePlayer = async (entry, playerStateIdx) => {
	const { gameState, events } = entry;
	const released = BankEngine.releaseFromPrison(entry, playerStateIdx);
	if (!released) {
		log.debug('[BankStateService] player not in prison, skipping release', { playerStateIdx });
		return null;
	}

	const { playerState, newCards } = released;
	const event = events[events.length - 1];
	const gameStateId = gameState._id.toString();

	log.info('[BankStateService] player released from prison', { playerStateIdx, cardsCount: newCards.length });

	socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.EVENT, event);
	socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.PLAYER.PRISON_ENDED, {
		cardsLK: playerState.cards,
	});
	socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.PLAYER.PRISON_ENDED, { playerStateIdx });
	SyncHelper.emitPlayerSync(gameStateId, [playerState]);
	SyncHelper.emitDecksSync(gameStateId, gameState, [0]);

	return { playerState, event, newCards };
};

// ─── Timer callbacks ─────────────────────────────────────────────────────────

/** Push the remaining prison time to the prisoner and the Table. */
const _prisonProgressCallback = async (timerInstance) => {
	const { gameStateId, playerStateIdx } = timerInstance.data;
	const remainingMs = timerInstance.getRemainingMs();
	const totalMs = timerInstance.data.totalMs ?? timerInstance.duration;
	const progress = totalMs > 0 ? Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100))) : 0;
	const payload = {
		playerStateIdx,
		remainingTime: remainingMs,
		totalTime: totalMs,
		progress,
		paused: timerInstance.status === 'paused',
	};

	socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.PLAYER.PROGRESS_PRISON, payload);
	socket.emitTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.PLAYER.PROGRESS_PRISON, payload);
};

/**
 * A sentence ran its course. The spent timer is dropped from the manager before the release,
 * so a game that is no longer in memory cannot strand it there.
 */
const _prisonEndCallback = async (timerInstance) => {
	const { gameStateId, playerStateIdx } = timerInstance.data;
	log.info(`[BankStateService] Prison ended for player ${playerStateIdx} in game ${gameStateId}`);
	await prisonTimerManager.stopAndRemoveTimer(timerInstance.id);
	try {
		await GameStateManager.withQueue(gameStateId, async (entry) => {
			await _releasePlayer(entry, playerStateIdx);
		});
	} catch (err) {
		log.error('[BankStateService] error in _prisonEndCallback', { error: err.message, playerStateIdx, gameStateId });
	}
};

/**
 * A credit reached maturity.
 *
 * The three-way decision belongs to the engine; this only stops the old clock, starts a new one
 * when the credit was extended, and tells the rooms. A callback that fires against a credit
 * already settled or cancelled resolves to `gone` and does nothing — the timer cannot be
 * recalled once it has queued, so the engine is where that has to be tolerated.
 *
 * The spent timer is dropped from the manager before the queue is entered, so a game that is no
 * longer in memory cannot strand it there.
 */
const _creditTimeoutCallback = async (timerInstance) => {
	const { gameStateId, id: creditId } = timerInstance.data;
	await creditTimerManager.stopAndRemoveTimer(timerInstance.id);
	try {
		await GameStateManager.withQueue(gameStateId, async (entry) => {
			const { outcome, credit, playerState } = BankEngine.resolveCreditMaturity(entry, creditId);
			if (outcome === 'gone') {
				log.debug('[BankStateService] maturity fired on a credit no longer running', { gameStateId, creditId });
				return;
			}

			const { gameState, rules, events } = entry;
			const playerRoom = ROOMS.playerState(gameStateId, playerState.idx);

			if (outcome === 'settlement-call') {
				socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.REQUEST, { credit });
				socket.emitAckTo(playerRoom, IO.CREDIT.REQUEST, { credit, coinsLK: playerState.coins });
				return;
			}

			if (outcome === 'extended') {
				await creditTimerManager.startTimer(_createCreditTimer(gameStateId, credit));
				socket.emitAckTo(playerRoom, IO.CREDIT.EXTENDED, { credit, coinsLK: playerState.coins });
				socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.EXTENDED, {
					credit,
					...BankEngine.bankIndicators(gameState),
				});
				SyncHelper.emitPlayerSync(gameStateId, [playerState]);
				return;
			}

			socket.emitTo(ROOMS.gameStateEvents(gameStateId), IO.EVENT, events[events.length - 1]);
			socket.emitAckTo(playerRoom, IO.CREDIT.FAULT, { credit });
			socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.FAULT, { credit });

			if (rules.autoSeizure) {
				await autoSeizureTimerManager.startIfAbsent(_createAutoSeizureTimer(gameStateId, playerState.idx));
			}
		});
	} catch (err) {
		log.error('[BankStateService] error in _creditTimeoutCallback', { error: err.message, gameStateId, creditId });
	}
};

/**
 * The police wait elapsed: collect on every faulted credit of this player at once.
 *
 * The spent timer is dropped from the manager before the queue is entered, so a game that is no
 * longer in memory cannot strand it there.
 */
const _autoSeizureCallback = async (timerInstance) => {
	const { gameStateId, playerStateIdx } = timerInstance.data;
	await autoSeizureTimerManager.stopAndRemoveTimer(timerInstance.id);
	try {
		await GameStateManager.withQueue(gameStateId, async (entry) => {
			const { gameState, events } = entry;

			const eventsBefore = events.length;
			const outcome = BankEngine.applyAutoSeizure(entry, playerStateIdx);
			if (!outcome) {
				log.debug('[BankStateService] auto-seizure fired with nothing in fault', { gameStateId, playerStateIdx });
				return;
			}

			const { playerState, resolvedCredits, seizedCards, coinsSeized } = outcome;

			for (const event of events.slice(eventsBefore)) {
				if (event.typeEvent === DB_EVENTS.CREDIT_SEIZURE) {
					socket.emitTo(ROOMS.gameStateEvents(gameStateId), IO.EVENT, event);
				} else if (event.typeEvent === DB_EVENTS.PRISON) {
					socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.EVENT, event);
				}
			}

			log.info('[BankStateService] auto seizure completed', {
				gameStateId,
				playerStateIdx,
				creditsResolved: resolvedCredits.length,
				coinsSeized,
				cardsSeized: seizedCards.length,
			});

			let prisonRemainingMs = 0;
			let prisonTotalMs = 0;
			if (outcome.imprisoned) {
				const timer = _createPrisonTimer(gameStateId, playerStateIdx, outcome.prisonMinutes);
				await prisonTimerManager.startTimer(timer);
				prisonRemainingMs = timer.getRemainingMs();
				prisonTotalMs = timer.duration;
				await _prisonProgressCallback(timer);
				log.info('[BankStateService] player auto-imprisoned', {
					gameStateId,
					playerStateIdx,
					prisonDuration: outcome.prisonMinutes,
				});
			}

			socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.SEIZURE, {
				credits: resolvedCredits,
				seizure: { coins: coinsSeized, cards: seizedCards },
				coinsLK: playerState.coins,
				prisoner: outcome.imprisoned ? playerState : undefined,
				prisonRemainingTime: prisonRemainingMs,
				prisonTotalTime: prisonTotalMs,
			});
			socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.SEIZURE, {
				credits: resolvedCredits,
				...BankEngine.bankIndicators(gameState),
			});
			SyncHelper.emitPlayerSync(gameStateId, [playerState]);
			SyncHelper.emitDecksSync(gameStateId, gameState, seizedCards.map((c) => c.weight));
		});
	} catch (err) {
		log.error('[BankStateService] error in _autoSeizureCallback', { error: err.message, playerStateIdx, gameStateId });
	}
};

/** Push a running credit's remaining time to its borrower and the Table. */
const _creditHeartBeatCallback = async (timerInstance) => {
	const payload = { id: timerInstance.id, remainingTime: timerInstance.getRemainingMs() };
	socket.emitTo(ROOMS.gameStateTable(timerInstance.data.gameStateId), IO.CREDIT.PROGRESS, payload);
	socket.emitTo(
		ROOMS.playerState(timerInstance.data.gameStateId, timerInstance.data.playerStateIdx),
		IO.CREDIT.PROGRESS,
		payload
	);
};

// ─── Public API ──────────────────────────────────────────────────────────────

/** The animator's manual contract. */
BankStateService.createCredit = async (
	gameStateId,
	playerStateIdx,
	amount,
	interest,
	origin = CREDIT_ORIGIN.ANIMATOR
) => {
	log.info(
		`[BankStateService] creating credit for p:${playerStateIdx} in g:${gameStateId} / c:${amount}, i:${interest}, o:${origin}`
	);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const created = BankEngine.createCredit(entry, playerStateIdx, amount, interest, origin);
		return await _afterCreditCreated(gameStateId, entry, created);
	});
};

/**
 * Re-price credit from the money supply after any mutation that moved it.
 *
 * Registered as a GameStateManager afterMutation hook, so it runs inside the already-held queue
 * entry and never re-enqueues. Rate changes are live-down, silent-up: the client decides what to
 * show from `improved`.
 */
BankStateService.refreshRateBroadcast = (entry) => {
	const { gameState, rules } = entry;
	if (!rules || rules.typeMoney !== GAME_TYPE.DEBT || !rules.autoBank) return;
	if (gameState.status !== GAME_STATUS.PLAYING) return;

	const rate = computeEffectiveRate(computeAverageMoney(gameState), rules.rateSchedule, rules);
	const prev = Number.isInteger(gameState.currentRateTierIndex) ? gameState.currentRateTierIndex : -1;
	if (rate.tierIndex === prev) return;

	gameState.currentRateTierIndex = rate.tierIndex;
	const payload = { rate, improved: rate.tierIndex > prev };
	for (const p of gameState.playersStates) {
		if (p.status !== PLAYER_STATUS.ALIVE) continue;
		socket.emitTo(ROOMS.playerState(gameState._id, p.idx), IO.CREDIT.RATE, payload);
	}
	log.info(`[BankStateService] rate tier ${prev}→${rate.tierIndex} improved:${payload.improved} g:${gameState._id}`);
};
GameStateManager.onAfterMutation(BankStateService.refreshRateBroadcast);

/** The terms one player would be offered right now, plus how solvent they are. */
BankStateService.getRate = async (gameStateId, playerStateIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules } = entry;
		return {
			rate: BankEngine.currentRate(gameState, rules),
			solvency: BankEngine.solvencyOf(gameState, playerStateIdx),
		};
	});
};

/** Open the ceremony: stamp every living Life pending and put the question on their boards. */
BankStateService.askFirstCreditQuestion = async (gameStateId) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { asked, playerStateIdxs, rate } = BankEngine.askFirstCreditQuestion(entry);

		for (const idx of playerStateIdxs) {
			socket.emitTo(ROOMS.playerState(gameStateId, idx), IO.CREDIT.QUESTION, { rate });
		}
		log.info(`[BankStateService] first credit question asked to ${asked} players in g:${gameStateId}`);

		return { asked, playerStateIdxs, rate };
	});
};

/** One player's answer to the opening question. */
BankStateService.answerFirstCreditQuestion = async (gameStateId, playerStateIdx, answer) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { credit, playerState, startNow, ...rest } = BankEngine.answerFirstCreditQuestion(
			entry,
			playerStateIdx,
			answer
		);

		let result = { answer: rest.answer };
		if (credit) {
			result = { ...result, ...(await _afterCreditCreated(gameStateId, entry, { credit, playerState, startNow })) };
		}

		socket.emitTo(ROOMS.gameStateMaster(gameStateId), IO.CREDIT.QUESTION_ANSWERED, {
			playerStateIdx,
			firstCreditAnswer: answer,
			currentMassMonetary: entry.gameState.currentMassMonetary,
		});
		return result;
	});
};

/** Starting the round closes the question on any phone still showing it. */
BankStateService.sweepUnansweredFirstCredit = (entry) => {
	const swept = BankEngine.sweepUnansweredFirstCredit(entry);
	for (const idx of swept) {
		socket.emitTo(ROOMS.playerState(entry.gameState._id, idx), IO.CREDIT.QUESTION, { rate: null });
	}
	if (swept.length) {
		log.info(
			`[BankStateService] first credit question unanswered by ${swept.length} players in g:${entry.gameState._id}`
		);
	}
	return swept;
};

/** A player's own ask for credit, auto-approved only while they are solvent. */
BankStateService.requestCredit = async (gameStateId, playerStateIdx, amount, interest) => {
	log.info(`[BankStateService] credit request p:${playerStateIdx} g:${gameStateId} a:${amount} i:${interest}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const outcome = BankEngine.requestCredit(entry, playerStateIdx, amount, interest);

		if (outcome.refused) {
			socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.REFUSED, {
				amount,
				interest,
				solvency: outcome.solvency,
			});
			return outcome;
		}

		const { credit, playerState, startNow } = outcome;
		return { refused: false, ...(await _afterCreditCreated(gameStateId, entry, { credit, playerState, startNow })) };
	});
};

/** Issue the default credit to every living Life at once. */
BankStateService.createCreditForAll = async (gameStateId) => {
	log.debug(`[BankStateService] Creating credit for all in game state ${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const created = BankEngine.createCreditForAll(entry);
		const credits = [];
		for (const one of created) credits.push(await _afterCreditCreated(gameStateId, entry, one));
		return { credits, ...BankEngine.bankIndicators(entry.gameState) };
	});
};

/** Hand a player coins from nowhere. */
BankStateService.freeMoney = async (gameStateId, playerStateIdx, amount) => {
	log.debug(`[BankStateService] Freeing money for player ${playerStateIdx} in game state ${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { playerState } = BankEngine.freeMoney(entry, playerStateIdx, amount);
		const indicators = BankEngine.bankIndicators(entry.gameState);

		socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.FREE_MONEY, {
			coinsLK: playerState.coins,
			amount,
		});
		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.FREE_MONEY, { playerStateIdx, amount, ...indicators });
		socket.emitTo(ROOMS.gameStateMaster(gameStateId), IO.CREDIT.FREE_MONEY, { playerStateIdx, amount, ...indicators });
		SyncHelper.emitPlayerSync(gameStateId, [playerState]);

		return { amount, playerStateIdx, ...indicators };
	});
};

/** Write a credit off at the animator's discretion. */
BankStateService.cancelCredit = async (gameStateId, creditId) => {
	log.debug(`[BankStateService] Canceling credit ${creditId} in game state ${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { credit, playerState } = BankEngine.cancelCredit(entry, creditId);
		await creditTimerManager.stopAndRemoveTimer(credit.id);
		const indicators = BankEngine.bankIndicators(entry.gameState);

		socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.CANCELED, {
			credit,
			coinsLK: playerState.coins,
		});
		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.CANCELED, { credit, ...indicators });
		socket.emitTo(ROOMS.gameStateMaster(gameStateId), IO.CREDIT.CANCELED, { credit, ...indicators });
		SyncHelper.emitPlayerSync(gameStateId, [playerState]);

		return { credit, ...indicators };
	});
};

/** Repay a credit in full. */
BankStateService.settleCredit = async (gameStateId, creditId, playerStateIdx) => {
	log.debug(`[BankStateService] Settling credit:${creditId} in game:${gameStateId} for player:${playerStateIdx}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { credit, playerState } = BankEngine.settleCredit(entry, creditId);
		await creditTimerManager.stopAndRemoveTimer(credit.id);

		socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.DONE, {
			credit,
			coinsLK: playerState.coins,
		});
		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.DONE, {
			credit,
			...BankEngine.bankIndicators(entry.gameState),
		});
		SyncHelper.emitPlayerSync(gameStateId, [playerState]);

		return { credit, coinsLK: playerState.coins };
	});
};

/** The borrower pays the interest and buys another full term. */
BankStateService.extendCredit = async (gameStateId, creditId, playerStateIdx) => {
	log.debug(`[BankStateService] Extending credit:${creditId} in game:${gameStateId} for player:${playerStateIdx}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { credit, playerState } = BankEngine.extendCredit(entry, creditId);

		await creditTimerManager.stopAndRemoveTimer(credit.id);
		if (entry.gameState.status === GAME_STATUS.PLAYING) {
			await creditTimerManager.startTimer(_createCreditTimer(gameStateId, credit));
		}

		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.EXTENDED, {
			credit,
			...BankEngine.bankIndicators(entry.gameState),
		});
		SyncHelper.emitPlayerSync(gameStateId, [playerState]);

		return { credit, coinsLK: playerState.coins };
	});
};

/** The animator's manual seizure of one defaulted credit. */
BankStateService.seizure = async (gameStateId, creditId, playerStateIdx, seizure) => {
	log.debug(`[BankStateService] Seizing credit:${creditId} from player:${playerStateIdx} in game:${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events } = entry;
		const eventsBefore = entry.events.length;
		const result = BankEngine.seizure(entry, creditId, playerStateIdx, seizure);
		const { credit, playerState, seizedCards, coinsSeized, unpaid, prisonMinutes } = result;

		await creditTimerManager.stopAndRemoveTimer(credit.id);

		log.info('[BankStateService] seizure completed', {
			gameStateId,
			creditId,
			playerStateIdx,
			coinSeized: coinsSeized,
			cardsSeized: seizedCards.length,
			bankMoneyLost: unpaid,
		});

		let prisonRemainingMs = 0;
		let prisonTotalMs = 0;
		if (prisonMinutes > 0) {
			const timer = _createPrisonTimer(gameStateId, playerStateIdx, prisonMinutes);
			await prisonTimerManager.startTimer(timer);
			prisonRemainingMs = timer.getRemainingMs();
			prisonTotalMs = timer.duration;
			await _prisonProgressCallback(timer);
			log.info('[BankStateService] player imprisoned', { gameStateId, playerStateIdx, prisonDuration: prisonMinutes });
		}

		for (const event of events.slice(eventsBefore)) {
			if (event.typeEvent === DB_EVENTS.CREDIT_SEIZURE) {
				socket.emitTo(ROOMS.gameStateEvents(gameStateId), IO.EVENT, event);
			} else if (event.typeEvent === DB_EVENTS.PRISON) {
				socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.EVENT, event);
			}
		}

		const payload = {
			credit,
			seizure: { coins: coinsSeized, cards: seizedCards },
			coinsLK: playerState.coins,
			prisoner: prisonMinutes > 0 ? playerState : undefined,
			prisonRemainingTime: prisonRemainingMs,
			prisonTotalTime: prisonTotalMs,
		};
		socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.SEIZURE, payload);
		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.SEIZURE, {
			credit,
			...BankEngine.bankIndicators(gameState),
		});
		SyncHelper.emitPlayerSync(gameStateId, [playerState]);
		SyncHelper.emitDecksSync(gameStateId, gameState, seizedCards.map((c) => c.weight));

		return payload;
	});
};

/** The animator lets a prisoner out early. */
BankStateService.prisonBreak = async (gameStateId, playerStateIdx) => {
	log.debug(`[BankStateService] Prison break for player:${playerStateIdx} in game:${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		await prisonTimerManager.releasePlayer(gameStateId, playerStateIdx);
		const result = await _releasePlayer(entry, playerStateIdx);
		if (!result) throw new Error('ERROR.PLAYER_NOT_IN_PRISON');

		log.info('[BankStateService] player released from prison via break', { gameStateId, playerStateIdx });
		return result;
	});
};

// ─── Bulk timer control (game lifecycle) ─────────────────────────────────────

/** Start the clock on every credit booked before the round began. */
BankStateService.startAllTimersCreditGame = async (gameStateId, credits) => {
	log.debug(`[BankStateService] Starting all credit timers for game ${gameStateId}`);
	for (const credit of credits) {
		if (credit.status !== CREDIT_STATUS.IDLE) continue;
		const timer = _createCreditTimer(gameStateId, credit);
		await creditTimerManager.startTimer(timer);
		credit.status = CREDIT_STATUS.RUNNING;
		credit.remainingTime = timer.getRemainingMs();
		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.STARTED, { id: credit.id });
		socket.emitTo(ROOMS.playerState(gameStateId, credit.playerStateIdx), IO.CREDIT.STARTED, { id: credit.id });
	}
};

/** Hold every prison sentence while the game is paused. */
BankStateService.pauseAllPrisonTimers = async (gameStateId) => {
	log.debug(`[BankStateService] Pausing all prison timers for game state ${gameStateId}`);
	const timers = await prisonTimerManager.pauseAllTimersOfGameState(gameStateId);
	for (const timer of timers) await _prisonProgressCallback(timer);
};

/** Resume every held prison sentence. */
BankStateService.resumeAllPrisonTimers = async (gameStateId) => {
	log.debug(`[BankStateService] Resuming all prison timers for game state ${gameStateId}`);
	const timers = prisonTimerManager.resumeAllTimersOfGameState(gameStateId);
	for (const timer of timers) await _prisonProgressCallback(timer);
};

/** Hold every running credit, preserving its remaining time. */
BankStateService.pauseAllTimersCreditGame = async (gameStateId, credits) => {
	log.debug(`[BankStateService] Pausing all credit timers for game state ${gameStateId}`);
	for (const credit of credits) {
		if (credit.status !== CREDIT_STATUS.RUNNING) continue;
		const remaining = creditTimerManager.stopAndGetRemaining(credit.id);
		if (remaining !== null && remaining > 0) credit.remainingTime = remaining;
		credit.status = CREDIT_STATUS.PAUSED;
		log.debug(
			`[BankStateService] Paused credit ${credit.id} for player ${credit.playerStateIdx}, remainingTime: ${credit.remainingTime}`
		);
	}
};

/** Restart every held credit from the time it had left. */
BankStateService.resumeAllTimersCreditGame = async (gameStateId, credits, rules) => {
	log.debug(`[BankStateService] Resuming all credit timers for game ${gameStateId}`);
	const fullDurationMs = (rules?.durationCredit ?? 0) * minute;
	for (const credit of credits) {
		const resumable = [CREDIT_STATUS.PAUSED, CREDIT_STATUS.IDLE, CREDIT_STATUS.RUNNING];
		if (!resumable.includes(credit.status)) continue;
		if (!(credit.remainingTime > 0) && fullDurationMs > 0) {
			log.warn(
				`[BankStateService] credit ${credit.id} had invalid remainingTime (${credit.remainingTime}), resetting to full duration ${fullDurationMs}ms`
			);
			credit.remainingTime = fullDurationMs;
		}
		await creditTimerManager.startTimer(_createCreditTimer(gameStateId, credit));
		credit.status = CREDIT_STATUS.RUNNING;
		log.debug(`[CreditTimerManager] Resumed timer for credit ${credit.id}, remaining: ${credit.remainingTime}ms`);
	}
};

/**
 * Whether the game still holds a prison sentence in memory. Credits rebuild from the state on
 * resume, prison sentences do not — they live only in their timer.
 * @param {string} gameStateId
 * @returns {boolean}
 */
BankStateService.hasPrisonTimers = (gameStateId) => prisonTimerManager.hasTimersOfGameState(gameStateId);

/** Drop every bank-side timer of a finished game: credits, prison sentences and pending auto-seizures. */
BankStateService.stopAllTimersGame = async (gameStateId) => {
	log.debug(`[BankStateService] Stopping all bank timers for game state ${gameStateId}`);
	await creditTimerManager.removeGameTimers(gameStateId);
	await prisonTimerManager.stopAndRemoveAllGameStateTimers(gameStateId);
	await autoSeizureTimerManager.stopAndRemoveAllGameStateTimers(gameStateId);
};

export default BankStateService;
