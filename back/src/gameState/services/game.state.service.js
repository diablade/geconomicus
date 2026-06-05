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
const _createTimer = async (gameState) => {
	const durationMs = gameState.gameTimers.remainingTime;
	const deathIntervalMs = gameState.gameTimers.deathState.deathIntervalMs;
	const timer = new Timer(
		gameState._id.toString(),
		{ gameStateId: gameState._id.toString(), ...gameState.timer },
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
const _getTimer = async (gameState, gameStateId) => {
	if (!gameState || !gameStateId) {
		log.error(`[GameStateService] Game state not in memory — no-op : ${gameStateId}`);
		throw new Error(`Game state not in memory — no-op : ${gameStateId}`);
	}
	if (gameState.status !== GAME_STATUS.PLAYING && gameState.status !== GAME_STATUS.PAUSED) {
		log.warn(`[GameStateService] Game state is not playing or paused — no-op : ${gameStateId}`);
		return null;
	}
	const timer = gameTimerManager.getTimer(gameStateId);
	if (!timer) {
		log.debug(
			`[GameStateService] Game ${gameStateId}, status: ${gameState.status}, has no timer, create new one with remaining: ${gameState.gameTimers.remainingTime}ms`
		);
		return { stored: false, timer: await _createTimer(gameState) };
	}
	return { stored: true, timer };
};

const _recoveringTimers = async (timer, stored, gameState) => {
	if (gameState.status === GAME_STATUS.PLAYING && (timer.status !== 'running' || !stored)) {
		await gameTimerManager.startTimer(timer);
	} else if (gameState.status === GAME_STATUS.PAUSED && timer.status === 'running' && stored) {
		await gameTimerManager.pauseTimer(timer);
	}
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
		try {
			if (!entry.gameState) {
				log.error(`[GameStateService] Game state not in memory — no-op : ${gameStateId}`);
				return;
			}
			if (entry.gameState.typeMoney === GAME_TYPE.JUNE) {
				await MoneyHelper.distributeNewDU(entry);
			}

			log.info(`[GameStateService] Saving state and post events for game: ${gameStateId}`);
			// Non-blocking save to prevent event loop blocking and socket disconnects
			await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState });
			await EventService.postMany(entry.events, gameStateId);
			// clean events after successful save
			entry.events = [];
		} catch (err) {
			log.error(`[GameStateService] Error in timer save state callback for game ${gameStateId}`, err);
		}
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

	// Save remainingTime to in-memory gameState for recovery on refresh
	const gameStateId = timerInstance.data.gameStateId;
	const entry = await GameStateManager.get(gameStateId);
	if (entry && entry.gameState) {
		if (!entry.gameState.gameTimers) entry.gameState.gameTimers = {};
		entry.gameState.gameTimers.remainingTime = remainingMs;
	}

	// Emit TIMER_LEFT event to all clients
	socket.emitTo(ROOMS.gameState(gameStateId), IO.TIMER_LEFT, remainingMs);
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
		const result = await _getTimer(entry.gameState, id);
		if (result?.timer) {
			await _recoveringTimers(result.timer, result.stored, entry.gameState);
		}
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
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		if (!entry || entry.gameState.status !== GAME_STATUS.INITIALIZED) {
			log.warn(
				`[GameStateService] Game state not found in memory or not in initialized state, skipping start: ${gameStateId}`
			);
			throw new Error('ERROR.GAME_STATE_NOT_FOUND');
		}
		log.debug(`[GameStateService] Starting game: ${gameStateId}`);

		// Compute timer duration
		const roundMinutes = entry.rules.roundMinutes;
		let remainingTimeMs = roundMinutes * 60 * 1000;
		const deathIntervalMs = remainingTimeMs / (entry.gameState.playersStates.length + 1);
		const deathQueue = entry.gameState.playersStates;
		if (entry.gameState.status === GAME_STATUS.PAUSED && entry.gameState.gameTimers?.remainingTime > 0) {
			remainingTimeMs = entry.gameState.gameTimers.remainingTime;
		}

		// Update game status to PLAYING
		entry.gameState.status = GAME_STATUS.PLAYING;
		// Initialize gameTimers
		entry.gameState.gameTimers = {
			...entry.gameState.gameTimers,
			createdAt: entry.gameState.gameTimers?.createdAt || Date.now(),
			remainingTime: remainingTimeMs,
			deathState: {
				deathIntervalMs,
				deathQueue,
			},
		};
		//create and store/start timer
		const { timer, stored } = await _getTimer(entry.gameState, gameStateId);
		log.info(`[GameTimerManager] Timer STARTING... for game ${timer.id}`);
		await gameTimerManager.startTimer(timer);

		//start credit timers if game is in debt mode
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
			roundMinutes,
			remainingTimeMs,
		};
	});
};

GameStateService.resume = async (gameStateId) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		if (!entry) {
			log.warn(`[GameStateService] Game state not found in memory, skipping start: ${gameStateId}`);
			throw new Error('ERROR.GAME_STATE_NOT_FOUND');
		}
		if (entry.gameState.status !== GAME_STATUS.PAUSED) {
			log.warn(`[GameStateService] Game state is not paused, skipping resume: ${gameStateId}`);
			throw new Error('ERROR.GAME_STATE_NOT_PAUSED');
		}
		log.debug(`[GameStateService] Resuming game: ${gameStateId}`);
		const { timer, stored } = await _getTimer(entry.gameState, gameStateId);
		if (timer) {
			await _recoveringTimers(timer, stored, entry.gameState);
		}
		log.info(`[GameTimerManager] Timer RESUMING... for game ${timer.id}`);
		await gameTimerManager.resumeTimer(timer);

		// Update game status to PLAYING
		entry.gameState.status = GAME_STATUS.PLAYING;

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
			remainingTimeMs: entry?.gameState?.gameTimers?.remainingTime,
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
	if (entry) {
		entry.gameState.status = GAME_STATUS.STOPPED;
		if (entry.gameState.gameTimers) {
			entry.gameState.gameTimers.remainingTime = 0;
		}
		await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState }, { new: true }).lean();
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
		await GameStateModel.findByIdAndUpdate(gameStateId, {
			$set: {
				status: GAME_STATUS.STOPPED,
				'gameTimers.remainingTime': 0,
			},
		}).lean();
		// Still emit the event to notify clients
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.STOPPED, {});
	}
	return {
		status: GAME_STATUS.STOPPED,
	};
};

/**
 * Pause game and timers.
 * @param {string} gameStateId
 */
GameStateService.pause = async (gameStateId) => {
	// Pause the timer and capture remaining time
	const timer = gameTimerManager.getTimer(gameStateId);
	let remainingTimeMs = 0;
	if (timer) {
		remainingTimeMs = timer.getRemainingMs();
	}
	await gameTimerManager.pauseTimer(gameStateId);

	await GameStateManager.withQueue(gameStateId, async (entry) => {
		log.debug(`[GameStateService] Pausing and saving last state: ${gameStateId}`);
		if (entry) {
			entry.gameState.status = GAME_STATUS.PAUSED;

			// Save remaining time to gameTimers
			if (!entry.gameState.gameTimers) entry.gameState.gameTimers = {};
			entry.gameState.gameTimers.remainingTime = remainingTimeMs;

			log.debug(`[GameStateService] Saving game state to DB: ${gameStateId}`);
			await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState });
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
			remainingTimeMs,
		};
	});
};

export default GameStateService;
