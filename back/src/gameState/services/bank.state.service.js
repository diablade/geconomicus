import _ from 'lodash';
import GameStateManager from '../managers/GameStateManager.js';
import creditTimerManager from '../managers/CreditTimerManager.js';
import prisonTimerManager from '../managers/PrisonTimerManager.js';
import autoSeizureTimerManager from '../managers/AutoSeizureTimerManager.js';
import socket from '#config/socket';
import log from '#config/log';
import Timer from '../../misc/Timer.js';
import { differenceInMilliseconds } from 'date-fns';
import {
	CREDIT_STATUS,
	GAME_STATUS,
	GAME_TYPE,
	PLAYER_TYPE,
	PLAYER_STATUS,
	CREDIT_ORIGIN,
	CREDIT_QUESTION_ANSWER,
	ROOMS,
	IO,
	DB_EVENTS,
} from '@geco/shared';
import EventHelper from '../helpers/event.helper.js';
import DecksHelper from '../helpers/decks.helper.js';
import SyncHelper from '../helpers/sync.helper.js';
import {
	computeAverageMoney,
	computeEffectiveRate,
	computeSolvency,
	computeAutoSeizureForCredit,
	computeAutoSeizurePrisonMinutes,
} from '../helpers/bank.helper.js';

const minute = 60 * 1000;
const fiveSeconds = 5 * 1000;
// Auto Seizure: purely cosmetic "police is processing" wait before the backend resolves a FAULT
// credit on its own. See docs/adr/0005-auto-seizure.md.
const AUTO_SEIZURE_DELAY_MS = 10 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────

const _findPlayer = (state, playerLifeIdx) => {
	const player = state.playersStates.find((p) => p.idx === playerLifeIdx);
	if (!player) throw new Error(`Player idx ${playerLifeIdx} not found`);
	return player;
};

const _findCredit = (gameState, creditId) => {
	const credit = gameState.credits.find((c) => c.id === creditId);
	if (!credit) throw new Error(`Credit idx ${creditId} not found`);
	return credit;
};

const _findCreditsOfPlayer = (state, playerStateIdx) => {
	const credits = state.credits.filter((c) => c.playerStateIdx === playerStateIdx);
	return credits;
};

const _seizeCards = (cards, targetAmount) => {
	// Function to seize cards to match the target amount cardsValue
	// Sort the player's cards by price in descending order
	const sortedCards = _.sortBy(cards, 'price').reverse();

	let seizedCards = [];
	let remainingAmount = targetAmount;

	// Seize cards until the target amount is reached
	for (let card of sortedCards) {
		if (remainingAmount <= 0) {
			break;
		} // Stop if the target is met

		if (card.price <= remainingAmount) {
			seizedCards.push(card); // Add card to seized list
			remainingAmount -= card.price; // Reduce the target by card's price
		}
		0;
	}
	return seizedCards;
};

const _getBankIndicators = (gameState) => {
	return {
		bankIndicators: {
			currentMassMonetary: gameState.currentMassMonetary,
			bankInterestEarned: gameState.bankInterestEarned,
			bankMoneyLost: gameState.bankMoneyLost,
			bankMoneyDestroyed: gameState.bankMoneyDestroyed,
			bankGoodsEarned: gameState.bankGoodsEarned,
		},
	};
};

// Helper to instantiate a Timer object for a given credit
const _createCreditTimer = (gameStateId, credit) => {
	log.debug('[BankStateService] creating credit timer');
	return new Timer(
		credit.id,
		{ ...credit, gameStateId },
		credit.remainingTime,
		_creditTimeoutCallback,
		fiveSeconds,
		_creditHeartBeatCallback
	);
};

const _payInterest = async (playerState, credit, entry) => {
	log.debug('[BankStateService] paying interest for credit');
	const { gameState, rules, events } = entry;
	const interest = credit.interest;

	playerState.coins -= interest;
	gameState.currentMassMonetary -= interest;
	gameState.bankInterestEarned += interest;

	credit.extended++;
	credit.remainingTime = rules.durationCredit * minute;
	credit.status = CREDIT_STATUS.RUNNING;

	const event = EventHelper.createEvent(
		DB_EVENTS.CREDIT_EXTENDED,
		gameState.sessionId,
		gameState.id,
		PLAYER_TYPE.BANK,
		playerState.idx,
		credit
	);
	events.push(event);
};

const _whatCanDoCredit = (credit, playerState) => {
	if (!credit) {
		throw new Error('ERROR.CREDIT_NOT_FOUND');
	}
	if (!playerState) {
		throw new Error('ERROR.PLAYER_NOT_FOUND');
	}
	if (Number(credit.playerStateIdx) !== Number(playerState.idx)) {
		throw new Error('ERROR.OWNERSHIP_CREDIT');
	}
	if (credit.status === CREDIT_STATUS.DONE || credit.status === CREDIT_STATUS.CANCELED) {
		throw new Error('ERROR.CREDIT_ALREADY_DONE_OR_CANCELED');
	}
	return {
		canExtend: credit.interest <= playerState.coins,
		canSettle: credit.amount + credit.interest <= playerState.coins,
	};
};

const _createAutoSeizureTimer = (gameStateId, playerStateIdx) => {
	log.debug('[BankStateService] creating auto-seizure timer', { gameStateId, playerStateIdx });
	return new Timer(
		`${gameStateId}-${playerStateIdx}`,
		{ gameStateId, playerStateIdx },
		AUTO_SEIZURE_DELAY_MS,
		_autoSeizureCallback
	);
};

// Helper to create a prison timer
const _createPrisonTimer = (gameStateId, playerStateIdx, prisonTimeMinutes) => {
	log.debug('[BankStateService] creating prison timer', { gameStateId, playerStateIdx, prisonTimeMinutes });
	return new Timer(
		`${gameStateId}-${playerStateIdx}`,
		{ gameStateId, playerStateIdx },
		prisonTimeMinutes * minute,
		_prisonEndCallback,
		fiveSeconds,
		_prisonProgressCallback
	);
};

// Shared prison release logic (called by both timeout and manual prisonBreak)
const _releasePlayer = async (entry, playerStateIdx) => {
	const { gameState, events, rules } = entry;
	const playerState = _findPlayer(gameState, playerStateIdx);

	if (playerState.status !== PLAYER_STATUS.PRISON) {
		log.debug('[BankStateService] player not in prison, skipping release', { playerStateIdx });
		return null;
	}

	// Draw 4 cards from deck 0 (same weight as produce action)
	const newCards = gameState.decks[0].splice(0, 4);
	playerState.cards.push(...newCards);
	playerState.status = PLAYER_STATUS.ALIVE;

	const event = EventHelper.createEvent(
		DB_EVENTS.PRISON_ENDED,
		gameState.sessionId,
		gameState._id,
		PLAYER_TYPE.BANK,
		playerStateIdx,
		{ cards: newCards }
	);
	events.push(event);

	log.info('[BankStateService] player released from prison', { playerStateIdx, cardsCount: newCards.length });

	socket.emitTo(ROOMS.gameStateTable(gameState._id), IO.EVENT, event);
	socket.emitAckTo(ROOMS.playerState(gameState._id, playerStateIdx), IO.PLAYER.PRISON_ENDED, {
		cardsLK: playerState.cards,
	});
	socket.emitTo(ROOMS.gameStateTable(gameState._id), IO.PLAYER.PRISON_ENDED, { playerStateIdx });
	// Table: the released hand gained 4 fresh cards drawn from deck 0.
	SyncHelper.emitPlayerSync(gameState._id, [playerState]);
	SyncHelper.emitDecksSync(gameState._id, gameState, [0]);

	return { playerState, event, newCards };
};

const _prisonEndCallback = async (timerInstance) => {
	log.info(
		`[BankStateService] Prison ended for player ${timerInstance.data.playerStateIdx} in game ${timerInstance.data.gameStateId}`
	);
	const { gameStateId, playerStateIdx } = timerInstance.data;
	try {
		await GameStateManager.withQueue(gameStateId, async (entry) => {
			await _releasePlayer(entry, playerStateIdx);
		});
	} catch (err) {
		log.error('[BankStateService] error in _prisonEndCallback', { error: err.message, playerStateIdx, gameStateId });
	}
};

const _prisonProgressCallback = async (timerInstance) => {
	const { gameStateId, playerStateIdx } = timerInstance.data;
	const remainingMs = timerInstance.getRemainingMs();
	const totalMs = timerInstance.duration;
	const progress = totalMs > 0 ? Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100))) : 0;
	log.debug('[BankStateService] prison progress', { playerStateIdx, remainingMs, progress });

	socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.PLAYER.PROGRESS_PRISON, {
		playerStateIdx,
		remainingTime: remainingMs,
		totalTime: totalMs,
		progress,
	});
	socket.emitTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.PLAYER.PROGRESS_PRISON, {
		playerStateIdx,
		remainingTime: remainingMs,
		totalTime: totalMs,
		progress,
	});
};

// ─── Timer callbacks ───────────────────────────────────────────────────────────

const _creditTimeoutCallback = async (timerInstance) => {
	log.debug('[BankStateService] timeout credit callback ');
	const gameStateId = timerInstance.data.gameStateId;
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		const credit = _findCredit(gameState, timerInstance.data.id);
		if (credit) {
			const playerState = gameState.playersStates.find((ps) => ps.idx === credit.playerStateIdx);
			await creditTimerManager.stopAndRemoveTimer(timerInstance.id);

			const { canSettle, canExtend } = await _whatCanDoCredit(credit, playerState);
			if (canSettle) {
				const event = EventHelper.createEvent(
					DB_EVENTS.CREDIT_REQUEST,
					gameState.sessionId,
					gameStateId,
					PLAYER_TYPE.BANK,
					playerState.idx,
					credit
				);
				events.push(event);
				credit.status = CREDIT_STATUS.REQUESTING;
				socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.REQUEST, { credit });
				socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.REQUEST, {
					credit,
					coinsLK: playerState.coins,
				});
			} else if (canExtend) {
				await _payInterest(playerState, credit, entry);
				const timer = _createCreditTimer(gameStateId, credit);
				await creditTimerManager.startTimer(timer);
				socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.EXTENDED, {
					credit,
					coinsLK: playerState.coins,
				});
				socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.EXTENDED, {
					credit,
					..._getBankIndicators(gameState),
				});
				SyncHelper.emitPlayerSync(gameStateId, [playerState]);
			} else {
				// bankrup payment
				const event = EventHelper.createEvent(
					DB_EVENTS.CREDIT_FAULT,
					gameState.sessionId,
					gameStateId,
					PLAYER_TYPE.BANK,
					playerState.idx,
					credit
				);
				events.push(event);
				credit.status = CREDIT_STATUS.FAULT;
				credit.faultAt = new Date();
				socket.emitTo(ROOMS.gameStateEvents(gameStateId), IO.EVENT, event);
				socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.FAULT, { credit });
				socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.FAULT, { credit });

				if (rules.autoSeizure) {
					const timer = _createAutoSeizureTimer(gameStateId, playerState.idx);
					await autoSeizureTimerManager.startIfAbsent(timer);
				}
			}
		} else {
			throw new Error(`Credit not found for player ${playerStateIdx} in timerInstance data`);
		}
	});
};

const _autoSeizureCallback = async (timerInstance) => {
	const { gameStateId, playerStateIdx } = timerInstance.data;
	try {
		await GameStateManager.withQueue(gameStateId, async (entry) => {
			const { gameState, events, rules } = entry;
			await autoSeizureTimerManager.stopAndRemoveTimer(timerInstance.id);
			const playerState = _findPlayer(gameState, playerStateIdx);

			const faultedCredits = _findCreditsOfPlayer(gameState, playerStateIdx)
				.filter((c) => c.status === CREDIT_STATUS.FAULT)
				.sort((a, b) => new Date(a.faultAt).getTime() - new Date(b.faultAt).getTime());

			if (faultedCredits.length === 0) {
				log.debug('[BankStateService] auto-seizure fired with nothing in fault', { gameStateId, playerStateIdx });
				return;
			}

			let totalCoinsSeized = 0;
			let totalInterestSeized = 0;
			let totalCardsFaceValue = 0;
			let totalObjective = 0;
			let totalUnpaid = 0;
			const allSeizedCards = [];
			const resolvedCredits = [];

			for (const credit of faultedCredits) {
				const result = computeAutoSeizureForCredit(playerState.coins, playerState.cards, credit, rules);
				playerState.coins = result.remainingCoins;
				playerState.cards = result.remainingCards;

				totalCoinsSeized += result.coinsSeized;
				totalInterestSeized += result.interestSeized;
				totalCardsFaceValue += result.cardsFaceValue;
				totalObjective += result.objective;
				totalUnpaid += result.unpaid;
				allSeizedCards.push(...result.cardsSeized);

				credit.status = CREDIT_STATUS.DONE;
				credit.endAt = new Date();
				resolvedCredits.push(credit);

				const seizureEvent = EventHelper.createEvent(
					DB_EVENTS.CREDIT_SEIZURE,
					gameState.sessionId,
					gameStateId,
					PLAYER_TYPE.BANK,
					playerStateIdx,
					{ credit, coins: result.coinsSeized, cards: result.cardsSeized }
				);
				events.push(seizureEvent);
				socket.emitTo(ROOMS.gameStateEvents(gameStateId), IO.EVENT, seizureEvent);
			}

			gameState.currentMassMonetary -= totalCoinsSeized;
			gameState.bankInterestEarned += totalInterestSeized;
			gameState.bankGoodsEarned += totalCardsFaceValue;
			DecksHelper.pushCardsInDecks(gameState, allSeizedCards);

			log.info('[BankStateService] auto seizure completed', {
				gameStateId,
				playerStateIdx,
				creditsResolved: resolvedCredits.length,
				coinsSeized: totalCoinsSeized,
				cardsSeized: allSeizedCards.length,
			});

			let prisonResult = null;
			let prisonRemainingMs = 0;
			let prisonTotalMs = 0;
			if (playerState.cards.length === 0) {
				const shortfallRatio = totalObjective > 0 ? totalUnpaid / totalObjective : 0;
				const prisonMinutes = computeAutoSeizurePrisonMinutes(shortfallRatio, rules.timerPrison);
				playerState.status = PLAYER_STATUS.PRISON;

				const prisonEvent = EventHelper.createEvent(
					DB_EVENTS.PRISON,
					gameState.sessionId,
					gameStateId,
					PLAYER_TYPE.BANK,
					playerStateIdx,
					{ prisonTime: prisonMinutes }
				);
				events.push(prisonEvent);
				socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.EVENT, prisonEvent);

				const timer = _createPrisonTimer(gameStateId, playerStateIdx, prisonMinutes);
				await prisonTimerManager.startTimer(timer);
				prisonRemainingMs = timer.getRemainingMs();
				prisonTotalMs = timer.duration;
				await _prisonProgressCallback(timer);

				prisonResult = { playerState };

				log.info('[BankStateService] player auto-imprisoned', {
					gameStateId,
					playerStateIdx,
					prisonDuration: prisonMinutes,
				});
			}

			const payload = {
				credits: resolvedCredits,
				seizure: { coins: totalCoinsSeized, cards: allSeizedCards },
				coinsLK: playerState.coins,
				prisoner: prisonResult?.playerState,
				prisonRemainingTime: prisonRemainingMs,
				prisonTotalTime: prisonTotalMs,
			};
			socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.SEIZURE, payload);
			socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.SEIZURE, {
				credits: resolvedCredits,
				..._getBankIndicators(gameState),
			});
			// Table: coins/cards drained on the seized player, and seized cards returned to the decks.
			SyncHelper.emitPlayerSync(gameStateId, [playerState]);
			SyncHelper.emitDecksSync(gameStateId, gameState, allSeizedCards.map((c) => c.weight));
		});
	} catch (err) {
		log.error('[BankStateService] error in _autoSeizureCallback', {
			error: err.message,
			playerStateIdx,
			gameStateId,
		});
	}
};

const _creditHeartBeatCallback = async (timerInstance) => {
	log.debug('[BankStateService] heartbeat credit callback ');
	const remainingMs = timerInstance.getRemainingMs();
	log.debug('[BankStateService] remainingTime: ' + remainingMs);
	socket.emitTo(ROOMS.gameStateTable(timerInstance.data.gameStateId), IO.CREDIT.PROGRESS, {
		id: timerInstance.id,
		remainingTime: remainingMs,
	});
	socket.emitTo(
		ROOMS.playerState(timerInstance.data.gameStateId, timerInstance.data.playerStateIdx),
		IO.CREDIT.PROGRESS,
		{
			id: timerInstance.id,
			remainingTime: remainingMs,
		}
	);
};

// ─── Public API ──────────────────────────────────────────────────────────────

const BankStateService = {};

const _currentRate = (gameState, rules) => {
	if (rules.typeMoney !== GAME_TYPE.DEBT || !rules.autoBank || gameState.status !== GAME_STATUS.PLAYING) {
		// base rate (tierIndex -1): pass an avg above every threshold
		return computeEffectiveRate(Number.POSITIVE_INFINITY, rules.rateSchedule, rules);
	}
	return computeEffectiveRate(computeAverageMoney(gameState), rules.rateSchedule, rules);
};

const _createCreditInEntry = async (entry, gameStateId, playerStateIdx, amount, interest, origin) => {
	const { gameState, rules, events } = entry;
	const playerState = _findPlayer(gameState, playerStateIdx);
	if (!playerState) {
		throw new Error('Player not found');
	}
	if (playerState.status !== PLAYER_STATUS.ALIVE) {
		throw new Error('Player is not alive or in prison');
	}

	const startNow = gameState.status === GAME_STATUS.PLAYING;

	gameState.creditIndexSeq++;
	const timerId = `credit-${gameStateId}-${playerStateIdx}-${gameState.creditIndexSeq}`;
	const now = new Date();
	const credit = {
		id: timerId,
		amount,
		interest,
		playerStateIdx,
		status: startNow ? CREDIT_STATUS.RUNNING : CREDIT_STATUS.IDLE,
		extended: 0,
		createdAt: now,
		startedAt: startNow ? now : null,
		endAt: null,
		remainingTime: rules.durationCredit * minute,
	};

	// update gameState
	gameState.credits.push(credit);
	gameState.currentMassMonetary += amount;
	playerState.coins += amount;

	if (startNow) {
		const timer = _createCreditTimer(gameStateId, credit);
		creditTimerManager.startTimer(timer);
	}

	events.push(
		EventHelper.createEvent(
			DB_EVENTS.CREDIT_NEW,
			entry.sessionId,
			entry.gameStateId,
			PLAYER_TYPE.BANK,
			playerStateIdx,
			{ ...credit, origin }
		)
	);

	socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.NEW, { credit, ..._getBankIndicators(gameState) });
	socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.NEW, {
		credit,
		coinsLK: playerState.coins,
	});
	SyncHelper.emitPlayerSync(gameStateId, [playerState]);

	return {
		credit,
		..._getBankIndicators(gameState),
	};
};

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
	return await GameStateManager.withQueue(gameStateId, async (entry) =>
		_createCreditInEntry(entry, gameStateId, playerStateIdx, amount, interest, origin)
	);
};

// Auto-bank rate broadcast: after a money/alive change, re-price credit from theG.
// Registered as a GameStateManager afterMutation hook, so it runs after every
// mutation inside the already-held queue entry — it never re-enqueues.
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

BankStateService.getRate = async (gameStateId, playerStateIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules } = entry;
		const playerState = _findPlayer(gameState, playerStateIdx);
		const rate = _currentRate(gameState, rules);
		const solvency = computeSolvency(playerState, _findCreditsOfPlayer(gameState, playerStateIdx));
		return { rate, solvency };
	});
};

BankStateService.askFirstCreditQuestion = async (gameStateId) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules } = entry;
		const rate = _currentRate(gameState, rules); // not PLAYING yet → base rate
		const payload = { rate: { amount: rate.amount, interest: rate.interest, allowDouble: rate.allowDouble } };
		let asked = 0;
		for (const p of gameState.playersStates) {
			if (p.status !== PLAYER_STATUS.ALIVE) continue;
			socket.emitTo(ROOMS.playerState(gameStateId, p.idx), IO.CREDIT.QUESTION, payload);
			asked++;
		}
		log.info(`[BankStateService] first credit question asked to ${asked} players in g:${gameStateId}`);
		return { asked, ...payload };
	});
};

BankStateService.answerFirstCreditQuestion = async (gameStateId, playerStateIdx, answer) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		_findPlayer(gameState, playerStateIdx); // validate the life exists (throws otherwise)
		const base = _currentRate(gameState, rules);

		events.push(
			EventHelper.createEvent(
				DB_EVENTS.CREDIT_QUESTION_ANSWERED,
				gameState.sessionId,
				gameState._id,
				PLAYER_TYPE.BANK,
				playerStateIdx,
				{ answer, amount: base.amount, interest: base.interest }
			)
		);

		let result = { answer };
		if (answer === CREDIT_QUESTION_ANSWER.ACCEPT_SINGLE || answer === CREDIT_QUESTION_ANSWER.ACCEPT_DOUBLE) {
			const useDouble = answer === CREDIT_QUESTION_ANSWER.ACCEPT_DOUBLE && base.allowDouble;
			const amount = useDouble ? base.amount * 2 : base.amount;
			const interest = useDouble ? base.interest * 2 : base.interest;
			const created = await _createCreditInEntry(
				entry,
				gameStateId,
				playerStateIdx,
				amount,
				interest,
				CREDIT_ORIGIN.FIRST_QUESTION
			);
			result = { ...result, ...created };
		}
		return result;
	});
};

BankStateService.requestCredit = async (gameStateId, playerStateIdx, amount, interest) => {
	log.info(`[BankStateService] credit request p:${playerStateIdx} g:${gameStateId} a:${amount} i:${interest}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events } = entry;
		const playerState = _findPlayer(gameState, playerStateIdx);
		if (playerState.status !== PLAYER_STATUS.ALIVE) {
			throw new Error('ERROR.PLAYER_NOT_ALIVE');
		}
		if (gameState.status !== GAME_STATUS.PLAYING && gameState.status !== GAME_STATUS.INITIALIZED && gameState.status !== GAME_STATUS.PAUSED) {
			throw new Error('ERROR.GAME_NOT_PLAYING');
		}

		// Solvency: coins + card value must cover every obligation, this one included.
		const solvency = computeSolvency(
			playerState,
			_findCreditsOfPlayer(gameState, playerStateIdx),
			amount,
			interest
		);
		if (!solvency.solvent) {
			const event = EventHelper.createEvent(
				DB_EVENTS.CREDIT_REFUSED,
				gameState.sessionId,
				gameState._id,
				PLAYER_TYPE.BANK,
				playerStateIdx,
				{ amount, interest, ...solvency }
			);
			events.push(event);
			socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.REFUSED, {
				amount,
				interest,
				solvency,
			});
			return { refused: true, amount, interest, solvency };
		}

		const result = await _createCreditInEntry(
			entry,
			gameStateId,
			playerStateIdx,
			amount,
			interest,
			CREDIT_ORIGIN.PLAYER_REQUEST
		);
		return { refused: false, ...result };
	});
};

BankStateService.createCreditForAll = async (gameStateId) => {
	log.debug(`[BankStateService] Creating credit for all in game state ${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules } = entry;
		const credits = [];
		for (const playerState of gameState.playersStates) {
			if (playerState.status !== PLAYER_STATUS.ALIVE) {
				continue;
			}
			const credit = await _createCreditInEntry(
				entry,
				gameStateId,
				playerState.idx,
				rules.defaultCreditAmount,
				rules.defaultInterestAmount,
				CREDIT_ORIGIN.ANIMATOR
			);
			credits.push(credit);
		}
		return {
			credits,
			..._getBankIndicators(gameState),
		};
	});
};

BankStateService.freeMoney = async (gameStateId, playerStateIdx, amount) => {
	log.debug(`[BankStateService] Freeing money for player ${playerStateIdx} in game state ${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events } = entry;
		const playerState = _findPlayer(gameState, playerStateIdx);
		if (!playerState || playerState.status !== PLAYER_STATUS.ALIVE) {
			throw new Error('Player state not found or not alive');
		}
		playerState.coins += amount;
		gameState.currentMassMonetary += amount;

		events.push(
			EventHelper.createEvent(
				DB_EVENTS.FREE_MONEY,
				entry.sessionId,
				entry.gameStateId,
				PLAYER_TYPE.BANK,
				playerStateIdx,
				{ coinsLK: playerState.coins, currentMassMonetary: gameState.currentMassMonetary, amount }
			)
		);
		socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.FREE_MONEY, {
			coinsLK: playerState.coins,
			amount,
		});
		SyncHelper.emitPlayerSync(gameStateId, [playerState]);

		return { amount, playerStateIdx, ..._getBankIndicators(gameState) };
	});
};

BankStateService.cancelCredit = async (gameStateId, creditId) => {
	log.debug(`[BankStateService] Canceling credit ${creditId} in game state ${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events } = entry;

		const credit = gameState.credits.find((c) => c.id === creditId);
		if (!credit) {
			throw new Error('Credit not found');
		}
		log.debug(`[BankStateService] Canceling credit ${creditId} for player ${credit.playerStateIdx}`);
		const playerState = _findPlayer(gameState, credit.playerStateIdx);
		if (!playerState) {
			throw new Error('Player state not found');
		}
		if (playerState.coins < credit.amount) {
			throw new Error('Not enough coins');
		}

		gameState.currentMassMonetary -= credit.amount;
		playerState.coins -= credit.amount;
		credit.status = CREDIT_STATUS.CANCELED;
		credit.endAt = new Date();
		creditTimerManager.stopAndRemoveTimer(credit.id);

		events.push(
			EventHelper.createEvent(
				DB_EVENTS.CREDIT_CANCELED,
				entry.sessionId,
				entry.gameStateId,
				PLAYER_TYPE.BANK,
				credit.playerStateIdx,
				credit
			)
		);

		socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.CANCELED, {
			credit,
			coinsLK: playerState.coins,
		});
		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.CANCELED, {
			credit,
			..._getBankIndicators(gameState),
		});
		SyncHelper.emitPlayerSync(gameStateId, [playerState]);

		return {
			credit,
			..._getBankIndicators(gameState),
		};
	});
};

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

BankStateService.pauseAllTimersCreditGame = async (gameStateId, credits) => {
	log.debug(`[BankStateService] Pausing all credit timers for game state ${gameStateId}`);
	for (const credit of credits) {
		if (credit.status !== CREDIT_STATUS.RUNNING) continue;
		const remaining = creditTimerManager.stopAndGetRemaining(credit.id);

        if (remaining !== null && remaining > 0) {
			credit.remainingTime = remaining;
		}

        credit.status = CREDIT_STATUS.PAUSED;
		log.debug(
			`[BankStateService] Paused credit ${credit.id} for player ${credit.playerStateIdx}, remainingTime: ${credit.remainingTime}`
		);
	}
};

BankStateService.resumeAllTimersCreditGame = async (gameStateId, credits, rules) => {
	log.debug(`[BankStateService] Resuming all credit timers for game ${gameStateId}`);
	const fullDurationMs = (rules?.durationCredit ?? 0) * minute;
	for (const credit of credits) {
		if (
			credit.status !== CREDIT_STATUS.PAUSED &&
			credit.status !== CREDIT_STATUS.IDLE &&
			credit.status !== CREDIT_STATUS.RUNNING
		) {
			continue;
		}
		if (!(credit.remainingTime > 0) && fullDurationMs > 0) {
			log.warn(
				`[BankStateService] credit ${credit.id} had invalid remainingTime (${credit.remainingTime}), resetting to full duration ${fullDurationMs}ms`
			);
			credit.remainingTime = fullDurationMs;
		}
		const timer = _createCreditTimer(gameStateId, credit);
		await creditTimerManager.startTimer(timer);
		credit.status = CREDIT_STATUS.RUNNING;
		log.debug(`[CreditTimerManager] Resumed timer for credit ${credit.id}, remaining: ${credit.remainingTime}ms`);
	}
};

BankStateService.stopAllTimersCreditGame = async (gameStateId) => {
	log.debug(`[BankStateService] Stopping all credit timers for game state ${gameStateId}`);
	await creditTimerManager.removeGameTimers(gameStateId);
};

BankStateService.seizureOnDead = async (gameState, events, player) => {
	let cardsValue = _.reduce(player.cards, (acc, card) => card.price + acc, 0);
	let credits = _findCreditsOfPlayer(gameState, player.idx);

	let totalPayedInterest = 0;
	let totalPayedAmount = 0;
	let totalValuesToSeize = 0;
	let totalNotPayed = 0;

	for (let credit of credits) {
		let payedInterest = 0;
		let payedAmount = 0;
		let seizureCardsValue = 0;

		// FIRST PAY INTEREST
		if (player.coins - credit.interest >= 0) {
			payedInterest = credit.interest;
			player.coins -= credit.interest;
			credit.interest = 0;
		} else {
			//seizure on cards
			if (cardsValue >= credit.interest) {
				cardsValue -= credit.interest;
				seizureCardsValue += credit.interest;
				credit.interest = 0;
			} else {
				seizureCardsValue += cardsValue;
				cardsValue = 0;
				credit.interest -= cardsValue;
			}
		}

		//SECOND PAY CREDIT AMOUNT
		if (player.coins - credit.amount >= 0) {
			player.coins -= credit.amount;
			payedAmount += credit.amount;
			credit.amount = 0;
		} else {
			// seize the rest coins
			credit.amount -= player.coins;
			payedAmount += player.coins;
			player.coins = 0;
			//seizure on cards
			if (cardsValue >= credit.amount) {
				cardsValue -= credit.amount;
				seizureCardsValue += credit.amount;
				credit.amount = 0;
			} else {
				seizureCardsValue += cardsValue;
				credit.amount -= cardsValue;
				cardsValue = 0;
			}
		}

		totalPayedInterest += payedInterest;
		totalPayedAmount += payedAmount;
		totalValuesToSeize += seizureCardsValue;
		totalNotPayed += credit.interest + credit.amount;

		credit.status = CREDIT_STATUS.DONE;
	}

	//convert value to cards
	let totalSeizedCards = _seizeCards(player.cards, totalValuesToSeize);
	let totalSeizedCardsValue = _.reduce(totalSeizedCards, (acc, card) => card.price + acc, 0);
	let totalCoinSeized = totalPayedInterest + totalPayedAmount;

	gameState.bankMoneyLost += totalNotPayed;
	gameState.bankMoneyDestroyed += totalPayedAmount;
	gameState.bankGoodsEarned += totalSeizedCardsValue;
	gameState.bankInterestEarned += totalPayedInterest;
	gameState.currentMassMonetary -= totalCoinSeized;

	//PUT BACK seized CARDS IN THE DECKs
	await DecksHelper.pushCardsInDecks(gameState, totalSeizedCards);
	// remove seized cards from player's hand (embedded cards have no _id — match by key)
	const seizedKeys = new Set(totalSeizedCards.map((c) => c.key));
	player.cards = player.cards.filter((card) => !seizedKeys.has(card.key));

	const event = EventHelper.createEvent(
		DB_EVENTS.CREDIT_SEIZED_DEAD,
		gameState.sessionId,
		gameState._id,
		PLAYER_TYPE.MASTER,
		PLAYER_TYPE.BANK,
		{
			totalCoinSeized,
			interest: totalPayedInterest,
			amount: totalPayedAmount,
			cards: totalSeizedCards,
			bankMoneyLost: totalNotPayed,
			bankMoneyDestroyed: totalPayedAmount,
			bankGoodsEarned: totalSeizedCardsValue,
		}
	);
	events.push(event);
};

BankStateService.seizure = async (gameStateId, creditId, playerStateIdx, seizure) => {
	log.debug(`[BankStateService] Seizing credit:${creditId} from player:${playerStateIdx} in game:${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events, rules } = entry;

		const credit = _findCredit(gameState, creditId);
		const playerState = _findPlayer(gameState, playerStateIdx);

		if (Number(credit.playerStateIdx) !== Number(playerStateIdx)) {
			throw new Error('ERROR.OWNERSHIP_CREDIT');
		}
		if (credit.status !== CREDIT_STATUS.FAULT) {
			throw new Error('ERROR.CREDIT_NOT_IN_FAULT');
		}
		if (seizure.coins > playerState.coins) {
			throw new Error('ERROR.SEIZURE_COINS_EXCEED_PLAYER_COINS');
		}

		// Validate card keys exist in player hand, and look up actual card data from hand
		const seizedCardKeys = new Set(seizure.cards.map((c) => c.key));
		const seizedCardsFromHand = playerState.cards.filter((c) => seizedCardKeys.has(c.key));

		if (seizedCardsFromHand.length !== seizure.cards.length) {
			throw new Error('ERROR.CARD_NOT_FOUND_IN_HAND');
		}

		// Calculate value from actual card data (don't trust client prices)
		const cardsValue = seizedCardsFromHand.reduce((acc, c) => acc + c.price, 0);
		const interestSeized = seizure.coins >= credit.interest ? credit.interest : 0;

		// Remove seized cards from player hand
		playerState.cards = playerState.cards.filter((c) => !seizedCardKeys.has(c.key));
		playerState.coins -= seizure.coins;

		// Update bank monetary state
		gameState.currentMassMonetary -= seizure.coins;
		gameState.bankInterestEarned += interestSeized;
		gameState.bankGoodsEarned += cardsValue;

		// Return seized cards to deck
		DecksHelper.pushCardsInDecks(gameState, seizedCardsFromHand);

		// Mark credit as done and stop its timer
		credit.status = CREDIT_STATUS.DONE;
		credit.endAt = new Date();
		creditTimerManager.stopAndRemoveTimer(credit.id);

		// Create seizure event
		const seizureEvent = EventHelper.createEvent(
			DB_EVENTS.CREDIT_SEIZURE,
			gameState.sessionId,
			gameState._id,
			PLAYER_TYPE.BANK,
			playerStateIdx,
			{ credit, coins: seizure.coins, cards: seizedCardsFromHand }
		);
		events.push(seizureEvent);

		log.info('[BankStateService] seizure completed', {
			gameStateId,
			creditId,
			playerStateIdx,
			coinSeized: seizure.coins,
			cardsSeized: seizedCardsFromHand.length,
		});

		socket.emitTo(ROOMS.gameStateEvents(gameStateId), IO.EVENT, seizureEvent);

		// Handle prison if specified
		let prisonResult = null;
		let prisonRemainingMs = 0;
		let prisonTotalMs = 0;
		if (seizure.prisonTime && seizure.prisonTime > 0) {
			const clampedPrisonTime = Math.min(seizure.prisonTime, rules.timerPrison);
			playerState.status = PLAYER_STATUS.PRISON;

			const prisonEvent = EventHelper.createEvent(
				DB_EVENTS.PRISON,
				gameState.sessionId,
				gameState._id,
				PLAYER_TYPE.BANK,
				playerStateIdx,
				{ prisonTime: clampedPrisonTime }
			);
			events.push(prisonEvent);

			if (clampedPrisonTime > 0) {
				const timer = _createPrisonTimer(gameStateId, playerStateIdx, clampedPrisonTime);
				await prisonTimerManager.startTimer(timer);
				prisonRemainingMs = timer.getRemainingMs();
				prisonTotalMs = timer.duration;
				await _prisonProgressCallback(timer);
			}

			socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.EVENT, prisonEvent);
			prisonResult = { playerState, event: prisonEvent };

			log.info('[BankStateService] player imprisoned', {
				gameStateId,
				playerStateIdx,
				prisonDuration: clampedPrisonTime,
			});
		}

		// Emit seizure payload to player
		const payload = {
			credit,
			seizure: { coins: seizure.coins, cards: seizedCardsFromHand },
			coinsLK: playerState.coins,
			prisoner: prisonResult?.playerState,
			prisonRemainingTime: prisonRemainingMs,
			prisonTotalTime: prisonTotalMs,
		};
		socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.SEIZURE, payload);
		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.SEIZURE, {
			credit,
			..._getBankIndicators(gameState),
		});
		// Table: coins/cards drained on the seized player, and seized cards returned to the decks.
		SyncHelper.emitPlayerSync(gameStateId, [playerState]);
		SyncHelper.emitDecksSync(gameStateId, gameState, seizedCardsFromHand.map((c) => c.weight));

		return payload;
	});
};

BankStateService.prisonBreak = async (gameStateId, playerStateIdx) => {
	log.debug(`[BankStateService] Prison break for player:${playerStateIdx} in game:${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		await prisonTimerManager.releasePlayer(gameStateId, playerStateIdx);
		const result = await _releasePlayer(entry, playerStateIdx);
		if (!result) {
			throw new Error('ERROR.PLAYER_NOT_IN_PRISON');
		}

		log.info('[BankStateService] player released from prison via break', { gameStateId, playerStateIdx });
		return result;
	});
};

BankStateService.settleCredit = async (gameStateId, creditId, playerStateIdx) => {
	log.debug(`[BankStateService] Settling credit:${creditId} in game:${gameStateId} for player:${playerStateIdx}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events } = entry;

		const credit = gameState.credits.find((c) => c.id === creditId);
		const playerState = _findPlayer(gameState, credit.playerStateIdx);

		const { canSettle } = _whatCanDoCredit(credit, playerState);
		if (!canSettle) {
			throw new Error('ERROR.NOT_ENOUGH_COINS');
		}

		gameState.currentMassMonetary -= credit.amount + credit.interest;
		gameState.bankInterestEarned += credit.interest;
		gameState.bankMoneyDestroyed += credit.amount;
		playerState.coins -= credit.amount + credit.interest;

		credit.status = CREDIT_STATUS.DONE;
		credit.endAt = new Date();
		credit.remainingTime = 0;
		creditTimerManager.stopAndRemoveTimer(credit.id);

		events.push(
			EventHelper.createEvent(
				DB_EVENTS.CREDIT_SETTLED,
				entry.sessionId,
				entry.gameStateId,
				credit.playerStateIdx,
				PLAYER_TYPE.BANK,
				credit
			)
		);

		socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.DONE, {
			credit,
			coinsLK: playerState.coins,
		});
		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.DONE, {
			credit,
			..._getBankIndicators(gameState),
		});
		SyncHelper.emitPlayerSync(gameStateId, [playerState]);

		return {
			credit,
			coinsLK: playerState.coins,
		};
	});
};

BankStateService.extendCredit = async (gameStateId, creditId, playerStateIdx) => {
	log.debug(`[BankStateService] Extending credit:${creditId} in game:${gameStateId} for player:${playerStateIdx}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events, rules } = entry;

		const credit = gameState.credits.find((c) => c.id === creditId);
		const playerState = _findPlayer(gameState, credit.playerStateIdx);

		const { canExtend } = _whatCanDoCredit(credit, playerState);
		if (!canExtend) {
			throw new Error('ERROR.NOT_ENOUGH_COINS');
		}

		await _payInterest(playerState, credit, entry);
		creditTimerManager.stopAndRemoveTimer(credit.id);
		if (gameState.status === GAME_STATUS.PLAYING) {
			const timer = _createCreditTimer(gameStateId, credit);
			creditTimerManager.startTimer(timer);
		}

		events.push(
			EventHelper.createEvent(
				DB_EVENTS.CREDIT_EXTENDED,
				entry.sessionId,
				entry.gameStateId,
				playerStateIdx,
				PLAYER_TYPE.BANK,
				credit
			)
		);

		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.EXTENDED, {
			credit,
			..._getBankIndicators(gameState),
		});
		SyncHelper.emitPlayerSync(gameStateId, [playerState]);

		return {
			credit,
			coinsLK: playerState.coins,
		};
	});
};

export default BankStateService;
