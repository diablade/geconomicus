import GameStateModel from '../game.state.model.js';
import { setupGameJune, setupGameDebt } from '../helpers/setup.state.helper.js';
import EventService from '../../event/event.service.js';
import RulesService from '../../session/rules/rules.service.js';
import GameStateManager from '../managers/GameStateManager.js';
import { PLAYER_STATUS, DB_EVENTS, GAME_TYPE, PLAYER_TYPE, GAME_STATUS, IO, ROOMS } from '@geco/shared';
import SessionService from '../../session/session.service.js';
import gameTimerManager from '../managers/GameTimerManager.js';
import Timer from '../../misc/Timer.js';
import socket from '#config/socket';
import log from '#config/log';
import PlayersStateConnectionManager from '../managers/PlayersStateConnectionManager.js';

const TIMER_SAVE_STATE_INTERVAL = 60000; // 1 minute
const TIMER_HEARTBEAT_INTERVAL = 1000; // 1 second

// TIMER CALLBACK METHODS
//--------------------------
const _timerSaveStateCallback = async (timerInstance) => {
	const gameStateId = timerInstance.gameStateId;
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		log.info(`Saving state and post events for game: ${gameStateId}`);
		if (!gameState) {
			log.error(`Game state not in memory — no-op : ${gameStateId}`);
			return;
		}
		try {
			await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState });
			await EventService.postMany(entry.events);
			log.info(`With posted ${entry.events?.length || 0} events for game: ${gameStateId}`);
			// clean events
			entry.events = [];
		} catch (err) {
			// Re-throw so the timer can log the error
			throw err;
		}
	});
};

const _timerHeartBeatCallback = async (timerInstance) => {
	const elapsed = Date.now() - timerInstance.startTime;
	const remainingMs = timerInstance.duration - elapsed;
	const remainingSeconds = Math.ceil(remainingMs / 1000);
	const remainingMinutes = Math.ceil(remainingSeconds / 60);

	// Emit TIMER_LEFT event to all clients
	socket.emitTo(ROOMS.gameState(timerInstance.gameStateId), IO.TIMER_LEFT, remainingMinutes);
};

const _timerEndCallback = async (timerInstance) => {
	log.info(`Timer ended for game ${timerInstance.gameStateId}`);
	// Stop the game
	await GameStateService.stop(timerInstance.gameStateId);
};
//----------------------------------------------------------------

// PUBLIC API
//-----------------------------------------
const GameStateService = {};

GameStateService.create = async (session, rules) => {
	const newGameState = new GameStateModel({
		typeMoney: rules.typeMoney,
		sessionId: session._id,
		ruleIdx: rules.idx,
		playerStateIndexSeq: session.avatarIndexSeq + 1,
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
		await EventService.postNow(DB_EVENTS.GAME_INIT, gameState.sessionId, gameStateId, PLAYER_TYPE.MASTER, '-', {});
		await EventService.postNow(DB_EVENTS.FIRST_DU, gameState.sessionId, gameStateId, PLAYER_TYPE.MASTER, '-', {
			firstDU: initializedGame.currentDU,
		});
	} else if (gameState.typeMoney === GAME_TYPE.DEBT) {
		initializedGame = await setupGameDebt(gameState, rules);
		await EventService.postNow(DB_EVENTS.GAME_INIT, gameState.sessionId, gameStateId, PLAYER_TYPE.MASTER, '-', {});
	} else {
		log.error(`Unknown game type: ${gameState.typeMoney}`);
		throw new Error('Unknown game type');
	}

	log.info(`Game setup completed: ${gameStateId} with type: ${gameState.typeMoney}`);

	// Persist setup state to DB,
	await GameStateModel.findByIdAndUpdate(gameStateId, { $set: initializedGame });

	log.info(`Game state persisted to DB: ${gameStateId}`);

	// then store in memory with rules
	GameStateManager.store(gameStateId, initializedGame, rules);

	// emit to connected players their initial state
	log.info(`Emitting PLAYER_INIT to all players for game: ${gameStateId}`);
	initializedGame.playersStates.forEach(async (playerState) => {
        const roomId = ROOMS.playerState(gameStateId, playerState.avatarIdx, playerState.idx);
		log.info(`emit PLAYER_INIT to room: ${roomId}`);
		await EventService.postNow(
			DB_EVENTS.PLAYER_INIT,
			gameState.sessionId,
			gameStateId,
			PLAYER_TYPE.MASTER,
			playerState.idx,
			{ playerState }
		);
		socket.emitAckTo(roomId, IO.PLAYER.INIT, {
			playerState,
			currentDU: initializedGame.currentDU,
			status: GAME_STATUS.INITIALIZED,
		});
	});

	return initializedGame;
};

GameStateService.getById = async (id, enriched = true) => {
	const entry = await GameStateManager.getOrReload(id);
	if (entry) {
		const session = enriched ? await SessionService.getById(entry.gameState.sessionId) : null;
		const connectedPlayers = enriched ? PlayersStateConnectionManager.getPlayersConnectionStatus(id) : null;
		if (enriched && !session) {
			throw new Error('ERROR.SESSION_NOT_FOUND');
		}
		return { gameState: entry.gameState, rules: entry.rules, session, connectedPlayers };
	}
	throw new Error('ERROR.GAME_STATE_NOT_FOUND');
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

GameStateService.start = async (gameStateId) => {
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

	const timer = new Timer(
		gameStateId,
		durationMs,
		TIMER_HEARTBEAT_INTERVAL,
		TIMER_SAVE_STATE_INTERVAL,
		{ gameStateId, roundMinutes },
		this._timerHeartBeatCallback,
		this._timerSaveStateCallback,
		this._timerEndCallback
	);

	// Add timer to manager
	await gameTimerManager.addTimer(timer);
	await gameTimerManager.startTimer(gameStateId);

	log.info(`Timer started for game ${gameStateId} (${roundMinutes} minutes)`);
};

/**
 * Stop the round and clean up timers.
 * @param {string} gameStateId
 */
GameStateService.stop = async (gameStateId) => {
	// Stop the countdown timer
	await gameTimerManager.stopAndRemoveTimer(gameStateId);

	return GameStateManager.withQueue(gameStateId, async (entry) => {
		log.info(`Stopping and saving last state: ${gameStateId}`);
		if (entry) {
			entry.state.status = GAME_STATUS.STOPPED;
			await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState });
			await EventService.postMany(entry.events);
			GameStateManager.delete(gameStateId);
			log.info(`Game state deleted from memory: ${gameStateId}`);
		} else {
			log.warn(`Game state not found in memory, skipping cleanup: ${gameStateId}`);
		}

		// Emit GAME.STOPPED event
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.STOPPED, {});
		log.info(`Game stopped : ${gameStateId}`);
	});
};

export default GameStateService;
