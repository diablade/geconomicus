import log from '#config/log';
import GameStateManager from '../managers/GameStateManager.js';
import SessionService from '../../session/session.service.js';
import PlayerEngine from '../engine/player.engine.js';
import SyncHelper from '../helpers/sync.helper.js';
import creditTimerManager from '../managers/CreditTimerManager.js';
import prisonTimerManager from '../managers/PrisonTimerManager.js';
import gameTimerManager from '../managers/GameTimerManager.js';
import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS, PLAYER_TYPE, IO, ROOMS, GAME_STATUS } from '@geco/shared';
import socket from '#config/socket';

const PlayerStateService = {};

// ── Reincarnation internals (all assume the game lock is already held) ──────────

/** Re-space the remaining scheduled deaths over the remaining round time (used by Force Death). */
const _resetDeathInterval = (gameState, gameStateId) => {
	const deathState = gameState.gameTimers?.deathState;
	if (!deathState) return;
	const timer = gameTimerManager.getTimer(gameStateId);
	const remaining = timer ? timer.getRemainingMs() : gameState.gameTimers?.remainingTime ?? 0;
	const queueLen = deathState.deathQueue?.length ?? 0;
	const newInterval = remaining / (queueLen + 1);
	deathState.deathIntervalMs = newInterval;
	deathState.intervalDeathLeft = newInterval;
	if (timer) timer.resetInterval4(newInterval, newInterval);
};

/**
 * Tear down the dead Life's timers and tell everyone, once the engine has ended it.
 *
 * The engine reports which credits it resolved and whether the Life was imprisoned, so the
 * service never has to re-derive either. Stopping a prison timer here rather than before the
 * mutation is safe: the manager only cancels the timer, it does not run the release.
 */
const _afterDeath = async (entry, playerStateIdx, death) => {
	const { gameState } = entry;
	const gameStateId = gameState._id.toString();

	for (const credit of death.resolvedCredits) {
		await creditTimerManager.stopAndRemoveTimer(credit.id);
	}
	if (death.wasInPrison) {
		await prisonTimerManager.releasePlayer(gameStateId, playerStateIdx).catch(() => {});
	}

	if (gameState.typeMoney === GAME_TYPE.DEBT) {
		socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.CREDIT.SEIZURE, { playerStateIdx });
		socket.emitTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.SEIZURE, { playerStateIdx });
	}

	SyncHelper.emitDecksSync(gameStateId, gameState, gameState.decks.map((_, lvl) => lvl));

	socket.emitTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.PLAYER.DIED, { playerStateIdx });
	socket.emitTo(ROOMS.gameStateMaster(gameStateId), IO.PLAYER.DIED, {
		playerStateIdx,
		coinsLK: death.player.coins,
		cardsLK: death.player.cards,
		currentMassMonetary: gameState.currentMassMonetary,
	});
};

/** Move the player's device onto the new Life and refresh the animator's cockpit. */
const _afterReincarnation = (gameStateId, avatarIdx, oldPlayerStateIdx, newPlayerStateIdx) => {
	const payload = { avatarIdx, oldPlayerStateIdx, newPlayerStateIdx };
	socket.emitTo(ROOMS.playerState(gameStateId, oldPlayerStateIdx), IO.PLAYER.REINCARNATED, payload);
	socket.emitTo(ROOMS.gameStateMaster(gameStateId), IO.PLAYER.REINCARNATED, payload);
};

/** End an avatar's current Life, open a new one, and run every side effect of both. */
const _reincarnate = async (entry, avatarIdx) => {
	const gameStateId = entry.gameState._id.toString();
	const result = PlayerEngine.reincarnate(entry, avatarIdx);
	if (!result) {
		log.warn(`[PlayerStateService] reincarnate: no living life for avatar ${avatarIdx} in game ${gameStateId}`);
		return null;
	}

	await _afterDeath(entry, result.oldPlayerStateIdx, result.death);
	_afterReincarnation(gameStateId, avatarIdx, result.oldPlayerStateIdx, result.newPlayerStateIdx);

	return { oldPlayerStateIdx: result.oldPlayerStateIdx, newPlayerStateIdx: result.newPlayerStateIdx };
};

/** Lock-free reincarnation entry point for the death-timer callback (which already holds the lock). */
PlayerStateService.reincarnateWithinLock = async (entry, avatarIdx) => _reincarnate(entry, avatarIdx);

/** The playerStateIdx of an avatar's current Life, or -1 when it has none. */
PlayerStateService.getCurrentPlayerStateIdx = async (sessionId, gameStateId, avatarIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const player = entry.gameState.playersStates.find(
			(p) => p.avatarIdx == avatarIdx && p.status !== PLAYER_STATUS.DEAD
		);
		return player ? player.idx : -1;
	});
};

/** Everything one player's board needs to render itself, including a live prison countdown. */
PlayerStateService.getPlayerState = async (sessionId, gameStateId, avatarIdx, playerStateIdx) => {
	const [queueResult, session] = await Promise.all([
		GameStateManager.withQueue(gameStateId, async (entry) => {
			const { gameState, rules } = entry;
			const playerState = gameState.playersStates.find((p) => p.idx == playerStateIdx && p.avatarIdx == avatarIdx);
			if (!playerState) return null;

			const credits = (gameState.credits || []).filter((c) => c.playerStateIdx == playerStateIdx);
			const defaultCredit = credits.some((c) => c.status === 'default-credit');

			if (gameState.status === GAME_STATUS.CREATED) {
				playerState.actionTokens = rules.startingTokens;
			}

			let prison = null;
			if (playerState.status === PLAYER_STATUS.PRISON) {
				const prisonTimer = prisonTimerManager.getTimer(`${gameStateId}-${playerStateIdx}`);
				if (prisonTimer) {
					prison = {
						remainingTime: prisonTimer.getRemainingMs(),
						totalTime: prisonTimer.data.totalMs ?? prisonTimer.duration,
						paused: prisonTimer.status === 'paused',
					};
				}
			}

			return {
				playerState,
				prison,
				gameState: {
					typeMoney: gameState.typeMoney,
					status: gameState.status,
					currentDU: gameState.currentDU || 0,
					currentMassMonetary: gameState.currentMassMonetary || 0,
				},
				rules,
				credits,
				defaultCredit,
			};
		}),
		SessionService.getById(sessionId, false).catch(() => null),
	]);

	if (!queueResult) return null;
	return {
		...queueResult,
		avatars: (session?.avatars || []).map((a) => ({ idx: a.idx, name: a.name, image: a.image })),
	};
};

/** Terminal death (no new life). Used for an already-reincarnated avatar. */
PlayerStateService.killPlayer = async (gameStateId, playerStateIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const death = PlayerEngine.killLife(entry, playerStateIdx);
		await _afterDeath(entry, playerStateIdx, death);
		return true;
	});
};

/** Public reincarnation (acquires the lock). */
PlayerStateService.reincarnatePlayer = async (gameStateId, avatarIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => _reincarnate(entry, avatarIdx));
};

/**
 * Force Death — the animator's manual "kill". Reincarnates an avatar that has not reincarnated yet
 * (dropping it from the death queue and re-spacing the remaining deaths); terminal otherwise.
 *
 * @param {string} gameStateId
 * @param {number} playerStateIdx - the life the animator clicked on
 * @returns {Promise<{reincarnated: boolean, oldPlayerStateIdx?: number, newPlayerStateIdx?: number}>}
 */
PlayerStateService.forceDeath = async (gameStateId, playerStateIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const result = PlayerEngine.forceDeath(entry, playerStateIdx);
		await _afterDeath(entry, playerStateIdx, result.death);

		if (!result.reincarnated) {
			return { reincarnated: false };
		}

		_afterReincarnation(gameStateId, result.avatarIdx, result.oldPlayerStateIdx, result.newPlayerStateIdx);
		_resetDeathInterval(entry.gameState, gameStateId);
		return {
			reincarnated: true,
			oldPlayerStateIdx: result.oldPlayerStateIdx,
			newPlayerStateIdx: result.newPlayerStateIdx,
		};
	});
};

/** One player buys one card from another, coins one way and the card the other. */
PlayerStateService.transaction = async (gameStateId, buyerIdx, sellerIdx, cardKey) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { cost, card, buyer, seller } = PlayerEngine.applyTransaction(entry, buyerIdx, sellerIdx, cardKey);

		socket.emitTo(`gs:${gameStateId}:${PLAYER_TYPE.RESULTS}`, IO.EVENT, {
			event: DB_EVENTS.TRANSACTION,
			sessionId: entry.gameState.sessionId,
			gameStateId,
			emitter: buyerIdx,
			receiver: sellerIdx,
			payload: { cost, card },
		});

		socket.emitAckTo(ROOMS.playerState(gameStateId, sellerIdx), IO.PLAYER.TRANSACTION_DONE, {
			sellerIdx,
			cardKey: card.key,
			coinsLK: seller.coins,
		});

		SyncHelper.emitPlayerSync(gameStateId, [buyer, seller]);

		return { buyedCard: card, coinsLK: buyer.coins };
	});
};

export default PlayerStateService;
