import log from '#config/log';
import _ from 'lodash';
import GameStateManager from '../managers/GameStateManager.js';
import EventService from '../../event/event.service.js';
import BankStateService from './bank.state.service.js';
import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS, PLAYER_TYPE, IO, ROOMS } from '@geco/shared';
import socket from '#config/socket';

const PlayerStateService = {};

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
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules } = entry;
		const playerState = gameState.playersStates.find((p) => p.idx == playerStateIdx && p.avatarIdx == avatarIdx);
		if (!playerState) return null;

		const credits = (gameState.credits || []).filter((c) => c.playerStateIdx == playerStateIdx);
		const defaultCredit = credits.some((c) => c.status === 'default-credit');

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
	});
};

PlayerStateService.killPlayer = async (gameStateId, playerStateIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules } = entry;
		const player = gameState.playersStates.find((p) => p.idx === playerStateIdx);
		if (!player) throw new Error('ERROR.PLAYER_NOT_FOUND');

		// Seize player's assets before
		if (gameState.typeMoney === GAME_TYPE.DEBT) {
			//stop timer of player's credits
			await BankStateService.seizureOnDead(gameState, rules, player);
			// socket.emitTo(gameStateId + C.EVENT, C.EVENT, event);
			// socket.emitTo(gameStateId + C.BANK, C.SEIZED_DEAD, event);
		}

		player.status = PLAYER_STATUS.DEAD;
		// Post player died event
		EventService.postNow(DB_EVENTS.PLAYER_DIED, entry.gameState.sessionId, gameStateId, playerStateIdx, {
			coins: player.coins,
			cards: player.cards,
		});
		EventService.postNow(DB_EVENTS.PLAYER_SEIZED_DEAD, entry.gameState.sessionId, gameStateId, playerStateIdx, {
			coins: player.coins,
			cards: player.cards,
		});
		socket.to(ROOMS.playerState(gameStateId, player.idx)).emit(IO.PLAYER.DIED, { playerStateIdx });
		socket.to(ROOMS.gameStateMaster(gameStateId)).emit(IO.PLAYER.DIED, { playerStateIdx });
		return true;
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

		// Post transaction event
		EventService.postNow(DB_EVENTS.TRANSACTION, entry.gameState.sessionId, gameStateId, buyerIdx, sellerIdx, {
			cost,
			card,
		});

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
		const sellerRoom = `gs:${gameStateId}:${seller.avatarIdx}:${sellerIdx}`;
		socket.emitAckTo(sellerRoom, IO.PLAYER.TRANSACTION_DONE, {
			sellerIdx,
			cardKey: card.key,
			coinsAfter: seller.coins,
		});

		return {
			buyedCard: card,
			coinsAfter: buyer.coins,
		};
	});
};

export default PlayerStateService;
