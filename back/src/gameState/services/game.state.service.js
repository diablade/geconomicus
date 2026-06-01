import GameStateModel from '../game.state.model.js';
import { setupGameJune, setupGameDebt } from '../helpers/setup.helper.js';
import EventService from '../../event/event.service.js';
import RulesService from '../../session/rules/rules.service.js';
import GameStateManager from '../managers/GameStateManager.js';
import { DB_EVENTS, GAME_TYPE, PLAYER_TYPE, PLAYER_STATUS, GAME_STATUS, IO, ROOMS } from '@geco/shared';
import SessionService from '../../session/session.service.js';
import gameTimerManager from '../managers/GameTimerManager.js';
import Timer from '../../misc/Timer.js';
import socket from '#config/socket';
import log from '#config/log';
import PlayersStateConnectionManager from '../managers/PlayersStateConnectionManager.js';
import MoneyHelper from '../helpers/money.helper.js';
import BankStateService from './bank.state.service.js';

const TIMER_SAVE_STATE_INTERVAL = 60000; // 1 minute
const TIMER_HEARTBEAT_INTERVAL = 10000; // 10 seconds

// PRIVATE METHODS
//--------------------------

/**
 * Start the round countdown timer.
 * Creates a timer that emits TIMER_LEFT events every second and stops the game when done.
 * @param {object} gameState
 * @param {number} roundMinutes - duration in minutes
 * @param {number} deathIntervalMs - interval in ms to check for deaths
 * @returns {Promise<void>}
 */
const _createTimer = async (gameState, roundMinutes, deathIntervalMs) => {
	const durationMs = roundMinutes * 60 * 1000; // Convert to milliseconds
	const timer = new Timer(
		gameState._id,
		{ gameStateId: gameState._id, roundMinutes, ...gameState.timer },
		durationMs,
		_timerEndCallback,
		TIMER_HEARTBEAT_INTERVAL,
		_timerHeartBeatCallback,
		TIMER_SAVE_STATE_INTERVAL,
		_timerSaveDUCallback,
		deathIntervalMs,
		_timerDeathCallback
	);
	return timer;
};

// TIMER CALLBACK METHODS
//--------------------------
/**
 * Checks for deaths in the game state and updates player statuses.
 * @param {object} timerInstance - Timer instance containing game state ID.
 */
const _timerDeathCallback = async (timerInstance) => {
	log.debug(`[GameStateService] callback death for game: ${timerInstance.data.gameStateId}`);
	const gameStateId = timerInstance.data.gameStateId;
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		if (!gameState) {
			log.error(`[GameStateService] Game state not in memory — no-op : ${gameStateId}`);
			return;
		}
		log.error(`[GameStateService] Game state death passing by on game ${gameStateId}`);
		// TODO: Implement death logic
	});
};

const _timerSaveDUCallback = async (timerInstance) => {
	log.debug(`[GameStateService] callback saveDU for game: ${timerInstance.data.gameStateId}`);
	const gameStateId = timerInstance.data.gameStateId;
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		if (!entry.gameState) {
			log.error(`[GameStateService] Game state not in memory — no-op : ${gameStateId}`);
			return;
		}
		if (entry.gameState.typeMoney === GAME_TYPE.JUNE) {
			await MoneyHelper.distributeNewDU(entry);
		}

		log.info(`[GameStateService] Saving state and post events for game: ${gameStateId}`);
		try {
			await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState });
			await EventService.postMany(entry.events, gameStateId);
			// clean events
			entry.events = [];
		} catch (err) {
			// Re-throw so the timer can log the error
			log.error(`[GameStateService] Error saving state for game ${gameStateId}: ${err.message}`);
			throw err;
		}
	}).catch((err) => {
		log.error(`[GameStateService] Error in timer save state callback for game ${gameStateId}: ${err.message}`);
	});
};

const _timerHeartBeatCallback = async (timerInstance) => {
	const elapsed = Date.now() - timerInstance.startTime;
	const remainingMs = timerInstance.duration - elapsed;
	const remainingSeconds = Math.ceil(remainingMs / 1000);
	const remainingMinutes = Math.floor(remainingSeconds / 60);
	const remainingSecondsDisplay = remainingSeconds % 60;
	log.debug(
		`[GameStateService] callback heartbeat for game: ${timerInstance.data.gameStateId}, remaining: ${remainingMinutes}m ${remainingSecondsDisplay}s`
	);

	// Emit TIMER_LEFT event to all clients
	socket.emitTo(ROOMS.gameState(timerInstance.data.gameStateId), IO.TIMER_LEFT, remainingMs);
};

const _timerEndCallback = async (timerInstance) => {
	log.info(`[GameStateService] Timer ended for game ${timerInstance.data.gameStateId}`);
	// Stop the game
	await GameStateService.stop(timerInstance.data.gameStateId);
};
//----------------------------------------------------------------

// PUBLIC API
//-----------------------------------------
const GameStateService = {};

GameStateService.create = async (session, rules) => {
	log.info(`[GameStateService] Creating new game state for session ${session._id} and rule ${rules.idx}`);
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
		log.error(`[GameStateService] Unknown game type: ${gameState.typeMoney}`);
		throw new Error('Unknown game type');
	}

	log.debug(`[GameStateService] Game init completed: ${gameStateId} with type: ${gameState.typeMoney}`);

	// Persist setup state to DB,
	await GameStateModel.findByIdAndUpdate(gameStateId, { $set: initializedGame });

	log.debug(`[GameStateService] Game state persisted to DB: ${gameStateId}`);

	// then store in memory with rules
	GameStateManager.store(gameStateId, initializedGame, rules);

	// emit to connected players their initial state
	log.debug(`[GameStateService] Emitting PLAYER_INIT to all players for game: ${gameStateId}`);
	initializedGame.playersStates.forEach(async (playerState) => {
		const roomId = ROOMS.playerState(gameStateId, playerState.avatarIdx, playerState.idx);
		log.debug(`[GameStateService] emit PLAYER_INIT to room: ${roomId}`);
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

	log.info(`[GameStateService] Game init completed for game: ${gameStateId}`);

	return initializedGame;
};

GameStateService.getById = async (id, enriched = true) => {
	const entry = await GameStateManager.getOrReload(id);
	if (entry) {
		const session = enriched ? await SessionService.getById(entry.gameState.sessionId, false) : null;
		const connectedPlayers = enriched ? PlayersStateConnectionManager.getPlayersConnectionStatus(id) : null;
		if (enriched && !session) {
			throw new Error('ERROR.SESSION_NOT_FOUND');
		}
		return { gameState: entry.gameState, rules: entry.rules, session, connectedPlayers };
	}
	throw new Error('ERROR.GAME_STATE_NOT_FOUND');
};

GameStateService.getBySessionIdAndRuleIdx = async (sessionId, ruleIdx) => {
	const gameState = await GameStateModel.findOne({ sessionId, ruleIdx }).lean();
	return gameState;
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
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		if (!entry) {
			log.warn(`[GameStateService] Game state not found in memory, skipping start: ${gameStateId}`);
			throw new Error('ERROR.GAME_STATE_NOT_FOUND');
		}
		log.debug(`[GameStateService] Starting game: ${gameStateId}`);
		// Update game status to PLAYING
		entry.gameState.status = GAME_STATUS.PLAYING;

		// Start the round timer
		entry.gameState.timer = { ...entry.gameState.timer, startedAt: null, createdAt: Date.now(), endedAt: null };
		const deathIntervalMs = (entry.rules.roundMinutes * 60 * 1000) / (entry.gameState.playersStates.length + 1);
		const timer = await _createTimer(entry.gameState, entry.rules.roundMinutes, deathIntervalMs);
		await gameTimerManager.startTimer(timer);
		log.debug(
			`[GameStateService] Timer started for game ${gameStateId} (${entry.rules.roundMinutes} minutes, death interval: ${deathIntervalMs}ms)`
		);

		if (entry.rules.typeMoney === GAME_TYPE.DEBT) {
			await BankStateService.startCreditsTimersOfGame(gameStateId, entry.gameState.credits);
		}

		// Persist to DB
		EventService.postNow(
			DB_EVENTS.GAME_STARTED,
			entry.gameState.sessionId,
			gameStateId,
			PLAYER_TYPE.MASTER,
			null,
			null
		);
		await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState });
		socket.emitAckTo(ROOMS.gameState(gameStateId), IO.GAME.STARTED, { gameStateId });
		log.info(`[GameStateService] Game started: ${gameStateId}`);
		return {
			status: GAME_STATUS.PLAYING,
			sessionId: entry?.gameState?.sessionId,
			ruleIdx: entry?.gameState?.ruleIdx,
		};
	});
};

/**
 * Stop the round and clean up timers.
 * @param {string} gameStateId
 */
GameStateService.stop = async (gameStateId) => {
	log.debug(`[GameStateService] Stopping game: ${gameStateId}`);
	await gameTimerManager.stopAndRemoveTimer(gameStateId);
	const entry = await GameStateManager.get(gameStateId);
	let result;
	if (entry) {
		entry.gameState.status = GAME_STATUS.STOPPED;
		result = await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState }, { new: true }).lean();
		log.debug(`[GameStateService] Game state updated in DB: ${gameStateId}`, result);
		await EventService.postMany(entry.events, gameStateId);
		await EventService.postNow(
			DB_EVENTS.GAME_ENDED,
			entry.gameState.sessionId,
			gameStateId,
			PLAYER_TYPE.MASTER,
			null,
			null
		);

		GameStateManager.remove(gameStateId);
		log.debug(`[GameStateService] Game state deleted from memory: ${gameStateId}`);

		// Emit STOPPED event
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.STOPPED, {});
		log.info(`[GameStateService] Game stopped : ${gameStateId}`);
	} else {
		log.debug(`[GameStateService] Game state not found in memory, saving STOPPED status in DB: ${gameStateId}`);
		result = await GameStateModel.findByIdAndUpdate(gameStateId, {
			$set: { 'gameState.status': GAME_STATUS.STOPPED },
		}).lean();
		// Still emit the event to notify clients
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.STOPPED, {});
	}
	return {
		status: GAME_STATUS.STOPPED,
		sessionId: result?.sessionId,
		ruleIdx: result?.ruleIdx,
	};
};

/**
 * Pause game and timers.
 * @param {string} gameStateId
 */
GameStateService.pause = async (gameStateId) => {
	await gameTimerManager.pauseTimer(gameStateId);
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		log.debug(`[GameStateService] Pausing and saving last state: ${gameStateId}`);
		if (entry) {
			entry.state.status = GAME_STATUS.PAUSED;
			log.debug(`[GameStateService] Saving game state to DB: ${gameStateId}`);
			await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState });
			log.debug(`[GameStateService] Posting events to DB: ${gameStateId}`);
			await EventService.postMany(entry.events, gameStateId);
			entry.events = [];
			log.debug(`[GameStateService] Game state paused and saved: ${gameStateId}`);

			// Emit GAME.PAUSED event
			socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.PAUSED, {});
			log.info(`[GameStateService] Game paused : ${gameStateId}`);
		} else {
			log.warn(`[GameStateService] Game state not found in memory, skipping pause: ${gameStateId}`);
		}
		return {
			status: GAME_STATUS.PAUSED,
			sessionId: entry?.gameState?.sessionId,
			ruleIdx: entry?.gameState?.ruleIdx,
		};
	});
};

export default GameStateService;
