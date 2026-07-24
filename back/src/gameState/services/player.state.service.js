import log from '#config/log';
import _ from 'lodash';
import GameStateManager from '../managers/GameStateManager.js';
import SessionService from '../../session/session.service.js';
import EventHelper from '../helpers/event.helper.js';
import BankStateService from './bank.state.service.js';
import DecksHelper from '../helpers/decks.helper.js';
import creditTimerManager from '../managers/CreditTimerManager.js';
import prisonTimerManager from '../managers/PrisonTimerManager.js';
import gameTimerManager from '../managers/GameTimerManager.js';
import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS, PLAYER_TYPE, IO, ROOMS, GAME_STATUS } from '@geco/shared';
import socket from '#config/socket';

const PlayerStateService = {};

// ── Reincarnation internals (all assume the game lock is already held) ──────────

/** Number of level-0-equivalent cards a fresh life is dealt, per game type. */
const _openingCardUnits = (gameState, rules) =>
	gameState.typeMoney === GAME_TYPE.JUNE
		? (rules.amountCardsForProd === 3 ? 3 : 4)
		: (rules.distribInitCards === 3 ? 3 : 4);

/** Remove an avatar from the death queue (used by Force Death). */
const _removeFromDeathQueue = (gameState, avatarIdx) => {
	const queue = gameState.gameTimers?.deathState?.deathQueue;
	if (Array.isArray(queue)) {
		const i = queue.indexOf(avatarIdx);
		if (i !== -1) queue.splice(i, 1);
	}
};

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
 * End a Life terminally: seize (debt), return its cards to the deck, mark DEAD, snapshot, emit DIED.
 * The dead Life's coins + cards are left in place as the frozen snapshot.
 */
const _endLife = async (entry, player) => {
	const { gameState, events } = entry;
	const gameStateId = gameState._id.toString();
	const playerStateIdx = player.idx;
	player.status = PLAYER_STATUS.DEAD;

	// Seize the dead life's assets (debt game only). Any coins beyond the debts stay as ghost money.
	if (gameState.typeMoney === GAME_TYPE.DEBT) {
		await creditTimerManager.stopPlayerDebtsTimer(gameState._id, playerStateIdx);
		await BankStateService.seizureOnDead(gameState, events, player);
		socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.SEIZURE, { playerStateIdx });
		socket.emitTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.SEIZURE, { playerStateIdx });
	}

	// Replenish the card supply: clone the (post-seizure) remaining cards back into their weight decks,
	// while the DEAD snapshot keeps its own copy as history.
	const returnedCards = player.cards.map((c) => ({ ...c }));
	DecksHelper.pushCardsInDecks(gameState, returnedCards);

	// coinsLK = the leftover coins on the dead life = this life's ghost money.
	const eventDied = EventHelper.createEvent(
		DB_EVENTS.PLAYER_DIED,
		gameState.sessionId,
		gameStateId,
		playerStateIdx,
		PLAYER_TYPE.MASTER,
		{ coinsLK: player.coins, cards: player.cards }
	);
	events.push(eventDied);

	socket.emitTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.PLAYER.DIED, { playerStateIdx });
	socket.emitTo(ROOMS.gameStateMaster(gameStateId), IO.PLAYER.DIED, { playerStateIdx });
	return player;
};

/**
 * End an avatar's current (non-dead) Life and open a new one for the same avatar.
 * Returns { oldPlayerStateIdx, newPlayerStateIdx } or null if the avatar has no living life.
 */
const _reincarnate = async (entry, avatarIdx) => {
	const { gameState, rules, events } = entry;
	const gameStateId = gameState._id.toString();

	const current = gameState.playersStates.find(
		(p) => p.avatarIdx === avatarIdx && p.status !== PLAYER_STATUS.DEAD
	);
	if (!current) {
		log.warn(`[PlayerStateService] reincarnate: no living life for avatar ${avatarIdx} in game ${gameStateId}`);
		return null;
	}

	// Death overrides imprisonment: cancel the running prison timer without running its release logic.
	if (current.status === PLAYER_STATUS.PRISON) {
		await prisonTimerManager.releasePlayer(gameStateId, current.idx).catch(() => {});
	}

	const oldPlayerStateIdx = current.idx;
	await _endLife(entry, current);

	// Open the new life.
	const newPlayerStateIdx = gameState.playerStateIndexSeq;
	gameState.playerStateIndexSeq += 1;
	const newCards = DecksHelper.drawReincarnationCards(gameState, _openingCardUnits(gameState, rules));
	const newLife = {
		idx: newPlayerStateIdx,
		avatarIdx,
		status: PLAYER_STATUS.ALIVE,
		coins: 0,
		cards: newCards,
		actionTokens: rules.startingTokens ?? 1,
	};
	gameState.playersStates.push(newLife);

	events.push(
		EventHelper.createEvent(
			DB_EVENTS.PLAYER_BIRTH,
			gameState.sessionId,
			gameStateId,
			PLAYER_TYPE.MASTER,
			newPlayerStateIdx,
			{ coinsLK: 0, cards: newCards, avatarIdx }
		)
	);

	// Move the dying player's device to the new life.
	socket.emitTo(ROOMS.playerState(gameStateId, oldPlayerStateIdx), IO.PLAYER.REINCARNATED, {
		avatarIdx,
		oldPlayerStateIdx,
		newPlayerStateIdx,
	});
	// Let the animator cockpit refresh the queue / rows.
	socket.emitTo(ROOMS.gameStateMaster(gameStateId), IO.PLAYER.REINCARNATED, {
		avatarIdx,
		oldPlayerStateIdx,
		newPlayerStateIdx,
	});

	return { oldPlayerStateIdx, newPlayerStateIdx };
};

/** Lock-free reincarnation entry point for the death-timer callback (which already holds the lock). */
PlayerStateService.reincarnateWithinLock = async (entry, avatarIdx) => _reincarnate(entry, avatarIdx);

PlayerStateService.getCurrentPlayerStateIdx = async (sessionId, gameStateId, avatarIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const player = entry.gameState.playersStates.find(
			(p) => p.avatarIdx == avatarIdx && p.status === PLAYER_STATUS.ALIVE
		);
		if (player) {
			return player.idx;
		}
		return -1;
	});
};
PlayerStateService.getPlayerState = async (sessionId, gameStateId, avatarIdx, playerStateIdx) => {
	const [queueResult, session] = await Promise.all([
		GameStateManager.withQueue(gameStateId, async (entry) => {
			const { gameState, rules } = entry;
			const playerState = gameState.playersStates.find((p) => p.idx == playerStateIdx && p.avatarIdx == avatarIdx);
			if (!playerState) return null;

			const credits = (gameState.credits || []).filter((c) => c.playerStateIdx == playerStateIdx);
			const defaultCredit = credits.some((c) => c.status === 'default-credit');

            if(gameState.status === GAME_STATUS.CREATED) {
                playerState.actionTokens = rules.startingTokens;
            }

			return {
				playerState,
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
		const player = entry.gameState.playersStates.find((p) => p.idx === playerStateIdx);
		if (!player) throw new Error('ERROR.PLAYER_NOT_FOUND');
		if (player.status === PLAYER_STATUS.DEAD) throw new Error('ERROR.PLAYER_ALREADY_DEAD');
		await _endLife(entry, player);
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
 * @param {string} gameStateId
 * @param {number} playerStateIdx - the life the animator clicked on
 */
PlayerStateService.forceDeath = async (gameStateId, playerStateIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState } = entry;
		const target = gameState.playersStates.find((p) => p.idx === playerStateIdx);
		if (!target) throw new Error('ERROR.PLAYER_NOT_FOUND');
		if (target.status === PLAYER_STATUS.DEAD) throw new Error('ERROR.PLAYER_ALREADY_DEAD');

		const avatarIdx = target.avatarIdx;
		const alreadyReincarnated = gameState.playersStates.filter((p) => p.avatarIdx === avatarIdx).length > 1;

		if (alreadyReincarnated) {
			// Second death: terminal, no new life.
			await _endLife(entry, target);
			_removeFromDeathQueue(gameState, avatarIdx);
			return { reincarnated: false };
		}

		// First death forced early: reincarnate, drop from the queue, re-space the remaining deaths.
		const result = await _reincarnate(entry, avatarIdx);
		_removeFromDeathQueue(gameState, avatarIdx);
		_resetDeathInterval(gameState, gameStateId);
		return { reincarnated: true, ...result };
	});
};

PlayerStateService.transaction = async (gameStateId, buyerIdx, sellerIdx, cardKey) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const buyer = entry.gameState.playersStates.find((p) => p.idx === buyerIdx);
		const seller = entry.gameState.playersStates.find((p) => p.idx === sellerIdx);
		if (!buyer) throw new Error('ERROR.BUYER_NOT_FOUND');
		if (!seller) throw new Error('ERROR.SELLER_NOT_FOUND');
		if (buyer.status !== PLAYER_STATUS.ALIVE || seller.status !== PLAYER_STATUS.ALIVE)
			throw new Error('ERROR.TRANSACTION_CANNOT_INVOLVE_DEAD_OR_PRISONER');

		const card = seller.cards.find((c) => c.key === cardKey);
		if (!card) throw new Error('ERROR.CARD_NOT_FOUND');

		const cost =
			entry.gameState.typeMoney === GAME_TYPE.JUNE
				? Number((card.price * entry.gameState.currentDU).toFixed(2))
				: card.price;
		if (buyer.coins < cost) throw new Error('ERROR.NOT_ENOUGH_COINS');

		// Update coins states
		buyer.coins = Number((buyer.coins - cost).toFixed(2));
		seller.coins = Number((seller.coins + cost).toFixed(2));

		// Update cards states
		buyer.cards.push(card);
		seller.cards = seller.cards.filter((c) => c.key !== cardKey);

		// add transaction event
		entry.events.push(
			EventHelper.createEvent(
				DB_EVENTS.TRANSACTION,
				entry.gameState.sessionId,
				gameStateId,
				buyerIdx,
				sellerIdx,
				{
					cost,
					card,
				}
			)
		);

		// Emit transaction event to results room
		const resultsRoom = `gs:${gameStateId}:${PLAYER_TYPE.RESULTS}`;
		socket.emitTo(resultsRoom, IO.EVENT, {
			event: DB_EVENTS.TRANSACTION,
			sessionId: entry.gameState.sessionId,
			gameStateId: gameStateId,
			emitter: buyerIdx,
			receiver: sellerIdx,
			payload: {
				cost: cost,
				card: card,
			},
		});

		// Notify seller
		socket.emitAckTo(ROOMS.playerState(gameStateId, sellerIdx), IO.PLAYER.TRANSACTION_DONE, {
			sellerIdx,
			cardKey: card.key,
			coinsLK: seller.coins,
		});

		return {
			buyedCard: card,
			coinsLK: buyer.coins,
		};
	});
};

export default PlayerStateService;
