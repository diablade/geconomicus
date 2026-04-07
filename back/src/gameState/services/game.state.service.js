import GameStateModel from '../game.state.model.js';
import setupGameJune from './init.game.service.js';
import EventService from '../../event/event.service.js';
import RulesService from '../../session/rules/rules.service.js';
import GameStateManager from '../managers/GameStateManager.js';
import { PLAYER_STATUS, DB_EVENTS, GAME_TYPE, PLAYER_TYPE } from '@geco/shared';
import SessionService from '../../session/session.service.js';

const GameStateService = {};

GameStateService.create = async (session, rules) => {
	const newGameState = new GameStateModel({
		typeMoney: rules.typeMoney,
		sessionId: session._id,
		ruleIdx: rules.idx,
		playerLifeIndexSeq: session.avatarIndexSeq+1,
		playersLifes: session.players.map((p) => {
			return {
				idx: p.idx,
				avatarIdx: p.idx,
				status: PLAYER_STATUS.ALIVE,
				coins: 0,
				cards: [],
			};
		}),
	});
	// create life for each player
	// link to distribute to players ...
	return await newGameState.save();
};

GameStateService.setupGame = async (gameStateId, socket) => {
	const gameState = await GameStateModel.findById(gameStateId).lean();
	const rules = await RulesService.getByIdx(gameState.sessionId, gameState.ruleIdx);

	let initializedGame;
	if (gameState.typeMoney === GAME_TYPE.JUNE) {
		initializedGame = await setupGameJune(gameState, rules);
	} else if (gameState.typeMoney === GAME_TYPE.DEBT) {
        initializedGame = await initGameDebt(gameState, rules);
	} else {
        throw new Error('Unknown game type');
	}

	// Persist setup state to DB,
	await GameStateModel.findByIdAndUpdate(gameStateId, { $set: initializedGame });

    // save history event
    await EventService.postNow(DB_EVENTS.TYPE.SETUP_GAME, gameState.sessionId, gameStateId,PLAYER_TYPE.MASTER,"-",{});

    // then load into memory with rules
	GameStateManager.setGame(gameStateId, initializedGame, rules);

    // emit to players
    const session = await SessionService.getById(gameState.sessionId);
    session.players.forEach((player) => {
        socket.to(player.avatarIdx).emit(DB_EVENTS.TYPE.SETUP_GAME, {player});
    });

	return initializedGame;
};

GameStateService.getById = async (id, enriched = true) => {
	// Check in-memory first for a live game
	const liveEntry = GameStateManager.getGame(id);
	if (liveEntry) {
		if (enriched) {
			return { gameState: liveEntry.state, rules: liveEntry.rules };
		}
		return { gameState: liveEntry.state };
	}
	// Fall back to DB for finished / not-yet-started games
	const gameState = await GameStateModel.findById(id).lean();
	if (!gameState) {
		throw new Error('Game state not found');
	}
	if (enriched) {
		let session = await SessionService.getById(gameState.sessionId);
		const rules = session.gamesRules.find((rule) => rule.idx === gameState.ruleIdx);
		session.gamesRules = [];
		return { gameState, session, rules };
	}
	return { gameState };
};
GameStateService.whoHaveCard = async (gameStateId, cardKey) => {
    const gameState = GameStateManager.getGame(gameStateId);
	if (gameState) {
		const player = gameState.playersLifes
			.filter((p) => p.status === 'alive')
			.find((player) => player.cards.find((card) => card.key === cardKey));
		if (player) {
			return {
				status: 'player',
				name: player.name,
			};
		} else {
			const inDeck = gameState.decks.some((deck) => deck.some((card) => card.key === cardKey));
			if (inDeck) {
				return {
					status: 'deck',
					name: '',
				};
			}
			return {
				status: 'ko',
				name: '',
				reason: 'not found in deck and players hands',
			};
		}
	} else {
		return {
			status: 'ko',
			name: '',
			reason: 'GameState not found',
		};
	}
};

/**
 * Persist the in-memory state of a game to MongoDB.
 * Called automatically every 60s by GameTimerManager.
 * Also called manually on game stop/end before removing from memory.
 * @param {string} gameStateId
 */
GameStateService.saveGameStateToDB = async (gameStateId) => {
	const entry = GameStateManager.getGame(gameStateId);
	if (!entry) {
		// Game not in memory (already ended or not yet initialized) — no-op
		return;
	}
	try {
		await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.state });
	} catch (err) {
		// Re-throw so the timer can log the error
		throw err;
	}
};

/**
 * Load a game from DB into memory (state + rules).
 * Use this to hot-reload a game that was dropped from memory (e.g. server restart).
 * @param {string} gameStateId
 * @returns {{ state: object, rules: object }}
 */
GameStateService.loadGameStateToMemory = async (gameStateId) => {
	const state = await GameStateModel.findById(gameStateId).lean();
	if (!state) throw new Error('GameState not found');
	const rules = await RulesService.getByIdx(state.sessionId, state.ruleIdx);
	GameStateManager.setGame(gameStateId, state, rules);
	return { state, rules };
};

GameStateService.delete = async (gameStateId) => {
	return await GameStateModel.findByIdAndDelete(gameStateId).exec();
};

GameStateService.removeAllBySessionId = async (id) => {
	return await GameStateModel.deleteMany({ sessionId: id }).exec();
};

export default GameStateService;
