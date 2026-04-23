import GameStateModel from '../game.state.model.js';
import { setupGameJune, setupGameDebt } from './setup.game.service.js';
import EventService from '../../event/event.service.js';
import RulesService from '../../session/rules/rules.service.js';
import GameStateManager from '../managers/GameStateManager.js';
import { PLAYER_STATUS, DB_EVENTS, GAME_TYPE, PLAYER_TYPE, GAME_STATUS, IO } from '@geco/shared';
import SessionService from '../../session/session.service.js';
import gameTimerManager from '../managers/GameTimerManager.js';
import Timer from '../../misc/Timer.js';
import socket from '#config/socket';
import log from '#config/log';

const GameStateService = {};

GameStateService.create = async (session, rules) => {
	const newGameState = new GameStateModel({
		typeMoney: rules.typeMoney,
		sessionId: session._id,
		ruleIdx: rules.idx,
		playerStateIndexSeq: session.avatarIndexSeq+1,
		playersStates: session.avatars.map((p) => {
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
	// link to distribute to avatars ...
	return await newGameState.save();
};

GameStateService.initGame = async (gameStateId) => {
	const gameState = await GameStateModel.findById(gameStateId).lean();
	const rules = await RulesService.getByIdx(gameState.sessionId, gameState.ruleIdx);

	let initializedGame;
	if (gameState.typeMoney === GAME_TYPE.JUNE) {
		initializedGame = await setupGameJune(gameState, rules);
		await EventService.postNow(DB_EVENTS.GAME_INIT, gameState.sessionId, gameStateId,PLAYER_TYPE.MASTER,"-",{});
        await EventService.postNow(DB_EVENTS.FIRST_DU, gameState.sessionId, gameStateId,PLAYER_TYPE.MASTER,"-",{firstDU:initializedGame.currentDU});

	} else if (gameState.typeMoney === GAME_TYPE.DEBT) {
		initializedGame = await setupGameDebt(gameState, rules);
		await EventService.postNow(DB_EVENTS.GAME_INIT, gameState.sessionId, gameStateId,PLAYER_TYPE.MASTER,"-",{});

	} else {
		log.error('Unknown game type '+ { typeMoney: gameState.typeMoney });
		throw new Error('Unknown game type');
	}

	log.info('Game setup completed '+ { gameStateId, typeMoney: gameState.typeMoney });

	// Persist setup state to DB,
	await GameStateModel.findByIdAndUpdate(gameStateId, { $set: initializedGame });

	log.info('Game state persisted to DB '+ { gameStateId });

    // then store in memory with rules
	GameStateManager.store(gameStateId, initializedGame, rules);

	// emit to connected players their initial state
	initializedGame.playersStates.forEach(async (playerState) => {
		const roomId = `${gameStateId}:${playerState.avatarIdx}:${playerState.idx}`;

		console.log('emit PLAYER_INIT to room', roomId);
		await EventService.postNow(DB_EVENTS.PLAYER_INIT, gameState.sessionId, gameStateId,PLAYER_TYPE.MASTER,playerState.idx,{playerState});
		socket.emitAckTo(roomId, IO.PLAYER.INIT, {playerState,status: GAME_STATUS.INITIALIZED});
	});

	return initializedGame;
};

GameStateService.getById = async (id, enriched = true) => {


    // Check in-memory first for a live game
    const liveEntry = GameStateManager.get(id);
    if (liveEntry) {
        const session = await SessionService.getById(liveEntry.state.sessionId);
        if (!session) {
            throw new Error('Session not found for game state');
        }
        return { gameState: liveEntry.state, rules: liveEntry.rules, session };
    }else{
        // Fall back to DB for finished / not-yet-started games
        const gameState = await GameStateModel.findById(id).lean();
        if (!gameState) {
            throw new Error('Game state not found');
        }
        const session = await SessionService.getById(gameState.sessionId);
        if (!session) {
            throw new Error('Session not found for game state');
        }
        const rules = session.gamesRules.find((rule) => rule.idx === gameState.ruleIdx);
        session.gamesRules = [];
        return { gameState, session, rules };
    }
};

GameStateService.getCurrentPlayerStateIdx = async (sessionId, gameStateId, avatarIdx) => {
    const entry = GameStateManager.get(gameStateId);
    if (entry) {
        const player = entry.state.playersStates.find((p) => p.avatarIdx == avatarIdx);
        if (player) {
            return player.idx;
        }
    }
    // Fallback to DB
    const gameState = await GameStateModel.findById(gameStateId).lean();
    if (gameState) {
        const player = gameState.playersStates.find((p) => p.avatarIdx == avatarIdx);
        if (player) {
            return player.idx;
        }
    }
    return -1;
};

GameStateService.getPlayerState = async (sessionId, gameStateId, avatarIdx, playerStateIdx) => {
    // Try in-memory first
    let gameState, rules;
    const entry = GameStateManager.get(gameStateId);
    if (entry) {
        gameState = entry.state;
        rules = entry.rules;
    } else {
        // Fallback to DB
        gameState = await GameStateModel.findById(gameStateId).lean();
        if (!gameState) return null;
        const session = await SessionService.getById(gameState.sessionId);
        rules = session.gamesRules.find((rule) => rule.idx === gameState.ruleIdx);
    }

    const playerState = gameState.playersStates.find(
        (p) => p.idx == playerStateIdx && p.avatarIdx == avatarIdx
    );
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
};

GameStateService.whoHaveCard = async (gameStateId, cardKey) => {
    const gameState = GameStateManager.get(gameStateId);
	if (gameState) {
		const player = gameState.playersStates
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
				reason: 'not found in deck and avatars hands',
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
	const entry = GameStateManager.get(gameStateId);
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
	GameStateManager.store(gameStateId, state, rules);
	return { state, rules };
};

GameStateService.delete = async (gameStateId) => {
	GameStateManager.remove(gameStateId);
	return await GameStateModel.findByIdAndDelete(gameStateId).exec();
};

GameStateService.removeAllBySessionId = async (id) => {
	return await GameStateModel.deleteMany({ sessionId: id }).exec();
};

GameStateService.startRound = async (gameStateId) => {
	const entry = GameStateManager.get(gameStateId);
	if (!entry) {
		throw new Error('Game not found in memory');
	}

	// Update game status to PLAYING
	entry.state.status = GAME_STATUS.PLAYING;

	// Persist to DB
	await GameStateModel.findByIdAndUpdate(gameStateId, { $set: { status: GAME_STATUS.PLAYING } });

	// Update in-memory state
	GameStateManager.store(gameStateId, entry.state, entry.rules);

	// Start the round timer
	await GameStateService.startTimer(gameStateId, entry.rules.roundMinutes);

	// Add persistence timer for periodic DB saves
	gameTimerManager.addPersistenceTimer(gameStateId);

	return { status: GAME_STATUS.PLAYING, gameStateId };
};

/**
 * Start the round countdown timer.
 * Creates a timer that emits TIMER_LEFT events every second and stops the game when done.
 * @param {string} gameStateId
 * @param {number} roundMinutes - duration in minutes
 */
GameStateService.startTimer = async (gameStateId, roundMinutes) => {
	// Stop any existing timer for this game
	await gameTimerManager.stopAndRemoveTimer(gameStateId);

	const durationMs = roundMinutes * 60 * 1000; // Convert to milliseconds
	const intervalMs = 1000; // Emit every second

	const timer = new Timer(
		gameStateId,
		durationMs,
		intervalMs,
		{ gameStateId, roundMinutes },
		// Callback at interval (every second)
		(timerInstance) => {
			const elapsed = Date.now() - timerInstance.startTime;
			const remainingMs = timerInstance.duration - elapsed;
			const remainingSeconds = Math.ceil(remainingMs / 1000);
			const remainingMinutes = Math.ceil(remainingSeconds / 60);

			// Emit TIMER_LEFT event to all clients
			socket.emitTo(gameStateId, IO.TIMER_LEFT, remainingMinutes);
		},
		// Callback at end
		async (timerInstance) => {
			log.info(`Round timer ended for game ${gameStateId}`);
			// Stop the game
			await GameStateService.stopRound(gameStateId);
		}
	);

	// Add timer to manager
	await gameTimerManager.addTimer(timer);

	// Start the timer
	timer.start();

	log.info(`Round timer started for game ${gameStateId} (${roundMinutes} minutes)`);
};

/**
 * Stop the round and clean up timers.
 * @param {string} gameStateId
 */
GameStateService.stopRound = async (gameStateId) => {
	// Stop the countdown timer
	await gameTimerManager.stopAndRemoveTimer(gameStateId);

	// Stop the persistence timer
	gameTimerManager.stopPersistenceTimer(gameStateId);

	// Update game status to STOPPED
	const entry = GameStateManager.get(gameStateId);
	if (entry) {
		entry.state.status = GAME_STATUS.STOPPED;
		GameStateManager.store(gameStateId, entry.state, entry.rules);
		await GameStateModel.findByIdAndUpdate(gameStateId, { $set: { status: GAME_STATUS.STOPPED } });
	}

	// Emit GAME.STOPPED event
	socket.emitTo(gameStateId, IO.GAME.STOPPED, {});

	log.info(`Round stopped for game ${gameStateId}`);
};

export default GameStateService;
