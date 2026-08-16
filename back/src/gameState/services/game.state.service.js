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
import GameEngine from '../engine/game.engine.js';
import SyncHelper from '../helpers/sync.helper.js';
import BankStateService from './bank.state.service.js';
import PlayerStateService from './player.state.service.js';
import EventHelper from '../helpers/event.helper.js';
import _ from 'lodash';

const _initEventSource = (initializedGame, gameState, gameStateId) => ({
	...initializedGame,
	sessionId: gameState.sessionId,
	_id: gameStateId,
});

const minute = 60 * 1000;
const TIMER_HEARTBEAT_INTERVAL = 10000; // 10 seconds
const MAX_BUFFERED_EVENTS = 5000;
const IDLE_EVICTION_MS = 30 * minute;

/**
 * Persist a resident game and drain its buffered events. Must be called under the game's queue.
 *
 * The buffer is detached before the write so events produced during the await are not lost; a
 * failed write puts it back, oldest-first and capped, so a DB that stays down cannot grow it
 * without bound.
 * @param {{ gameState: object, events: object[] }} entry
 * @param {string} gameStateId
 * @returns {Promise<boolean>} true when the write succeeded
 */
const _persistAndDrain = async (entry, gameStateId) => {
	const pending = entry.events;
	entry.events = [];
	try {
		await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState });
		await EventService.postMany(pending, gameStateId);
		return true;
	} catch (err) {
		const restored = pending.concat(entry.events);
		const dropped = Math.max(0, restored.length - MAX_BUFFERED_EVENTS);
		if (dropped > 0) {
			log.error(`[GameStateService] Event buffer full for game ${gameStateId}, dropping ${dropped} oldest`);
		}
		entry.events = restored.slice(-MAX_BUFFERED_EVENTS);
		log.error(`[GameStateService] Error saving state for game ${gameStateId}`, err);
		return false;
	}
};

//--------------------------
// PRIVATE METHODS
/**
 * Start the round countdown timer.
 * Creates a timer that emits TIMER_LEFT events every second and stops the game when done.
 * @param {object} gameState
 * @param {number} roundMinutes - duration in minutes
 * @param {number} deathIntervalMs - interval in ms to check for deaths
 * @returns {Promise<void>}
 */
const _createTimer = async (gameState, rules) => {
	const durationMs = gameState.gameTimers.remainingTime;
	const deathIntervalMs = gameState.gameTimers.deathState.deathIntervalMs;

	const saveIntervalMs = (rules.timerSaveInterval || 20) * 1000;
	const duIntervalMs = (rules.timerDUInterval || 60) * 1000;

	const timer = new Timer(
		gameState._id.toString(),
		{ gameStateId: gameState._id.toString(), ...gameState.timer },
		durationMs,
		_timerEndCallback,
		TIMER_HEARTBEAT_INTERVAL,
		_timerHeartBeatCallback,
		saveIntervalMs,
		_timerSaveCallback,
		duIntervalMs,
		_timerDUCallback,
		deathIntervalMs,
		_timerDeathCallback
	);
	// Resume the death interval mid-cycle: preserve time-to-next-death saved at pause.
	// On a fresh start intervalDeathLeft == deathIntervalMs, so this is a no-op there.
	const intervalDeathLeft = gameState.gameTimers.deathState.intervalDeathLeft;
	if (intervalDeathLeft != null) {
		timer.setFirstDelayInterval4(intervalDeathLeft);
	}
	return timer;
};
const syncTimerWithGameState = async (gameState, rules) => {
	if (gameState.status !== GAME_STATUS.PLAYING) return null; // PAUSED = pas de timer, rien à sync

	const gameStateId = gameState._id.toString();
	const timer = gameTimerManager.getTimer(gameStateId);

	if (timer?.status === 'running') return timer; // tout va bien

	// CRASH RECOVERY : serveur redémarré pendant une partie en cours
	log.warn(`[syncTimer] Crash recovery for ${gameStateId}`);
	const lostTime = Math.floor((Date.now() - new Date(gameState.updatedAt).getTime()) / 1000);
	if (lostTime > 0) {
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.RECOVERY, { lostTime });
		log.warn(`[syncTimer] Lost time ~${lostTime}s`);
	}

	const freshTimer = await _createTimer(gameState, rules);
	await gameTimerManager.startTimer(freshTimer);
	return gameTimerManager.getTimer(gameStateId);
};
//--------------------------

// TIMER CALLBACK METHODS
/**
 * Checks for deaths in the game state and updates player statuses.
 * @param {object} timerInstance - Timer instance containing game state ID.
 */
const _timerDeathCallback = async (timerInstance) => {
	log.debug(`[GameStateService] callback death for game: ${timerInstance.data.gameStateId}`);
	const gameStateId = timerInstance.data.gameStateId;
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		if (!entry.gameState) {
			log.error(`[GameStateService] Game state not in memory — no-op : ${gameStateId}`);
			return;
		}
		const avatarIdx = GameEngine.popScheduledDeath(entry);
		if (avatarIdx === null) return;

		log.info(`[GameStateService] death tick: reincarnating avatar ${avatarIdx} in game ${gameStateId}`);
		await PlayerStateService.reincarnateWithinLock(entry, avatarIdx);
	});
};
const _timerSaveCallback = async (timerInstance) => {
	log.debug(`[GameStateService] callback save state for game: ${timerInstance.data.gameStateId}`);
	const gameStateId = timerInstance.data.gameStateId;
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		if (!entry.gameState) return;
		log.info(`[GameStateService] Saving state and post events for game: ${gameStateId}`);
		// Non-blocking save to prevent event loop blocking and socket disconnects
		await _persistAndDrain(entry, gameStateId);
	});
};
const _timerDUCallback = async (timerInstance) => {
	log.debug(`[GameStateService] callback DU for game: ${timerInstance.data.gameStateId}`);
	const gameStateId = timerInstance.data.gameStateId;
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		try {
			if (!entry.gameState) return;
			if (!GameEngine.paysDividend(entry.gameState)) return;

			const { du, alive, currentMassMonetary } = await GameEngine.distributeDU(entry);
			log.info(`[GameStateService] DU ${du} distributed to ${alive.length} players in game: ${gameStateId}`);

			for (const playerState of alive) {
				socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.PLAYER.DISTRIB_DU, {
					du,
					coinsLK: playerState.coins,
				});
			}
			// Emitted after the loop so the mass is final. See docs/adr/0008.
			socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.CURRENT_DU, { du, currentMassMonetary });
			SyncHelper.emitPlayerSync(gameStateId, alive);
		} catch (err) {
			log.error(`[GameStateService] Error in timer DU callback for game ${gameStateId}`, err);
		}
	});
};
const _timerHeartBeatCallback = async (timerInstance) => {
	const elapsed = Date.now() - timerInstance.startTime.getTime();
	const remainingMs = timerInstance.duration - elapsed;
	log.debug(
		`[GameStateService] callback heartbeat for game: ${timerInstance.data.gameStateId},
         remaining: ${Math.floor(remainingMs / minute)}m ${Math.ceil((remainingMs % minute) / 1000)}s`
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
		await EventService.postMany(
			[
				EventHelper.createEvent(DB_EVENTS.FIRST_DU, _initEventSource(initializedGame, gameState, gameStateId), {
					emitter: PLAYER_TYPE.MASTER,
					receiver: '-',
					payload: { firstDU: initializedGame.currentDU },
				}),
			],
			gameStateId
		);
	} else if (gameState.typeMoney === GAME_TYPE.DEBT) {
		initializedGame = await setupGameDebt(gameState, rules);
		await EventService.postNow(DB_EVENTS.GAME_INIT, gameState.sessionId, gameStateId, PLAYER_TYPE.MASTER, '-', {});
	} else {
		log.error(`[GameStateService] Unknown game type: ${gameState.typeMoney}`);
		throw new Error('Unknown game type');
	}

	// Compute timer duration
	const remainingTime = rules.roundMinutes * 60 * 1000;
	const deathIntervalMs = remainingTime / (initializedGame.playersStates.length + 1);
	// Death queue holds avatarIdx (stable across reincarnation); each avatar dies exactly once.
	const deathQueue = _.shuffle(initializedGame.playersStates.map((p) => p.avatarIdx));
	log.debug(`[GameStateService] Death queue: ${JSON.stringify(deathQueue)}`);

	// Initialize gameTimers
	initializedGame.gameTimers = {
		...initializedGame.gameTimers,
		remainingTime,
		deathState: {
			deathIntervalMs,
			intervalDeathLeft: deathIntervalMs,
			deathQueue,
		},
	};

	log.debug(`[GameStateService] Game init completed: ${gameStateId} with type: ${gameState.typeMoney}`);

	// Persist setup state to DB,
	await GameStateModel.findByIdAndUpdate(gameStateId, { $set: initializedGame });

	log.debug(`[GameStateService] Game state persisted to DB: ${gameStateId}`);

	// then store in memory with rules
	GameStateManager.store(gameStateId, initializedGame, rules);
    log.debug(rules);

	// emit to connected players their initial state
	log.debug(`[GameStateService] Emitting PLAYER_INIT to all players for game: ${gameStateId}`);
	initializedGame.playersStates.forEach(async (playerState) => {
		const roomId = ROOMS.playerState(gameStateId, playerState.idx);
		log.debug(`[GameStateService] emit PLAYER_INIT to room: ${roomId}`);
		await EventService.postMany(
			[
				EventHelper.createEvent(
					DB_EVENTS.PLAYER_INIT,
					_initEventSource(initializedGame, gameState, gameStateId),
					{ emitter: PLAYER_TYPE.MASTER, receiver: playerState.idx, payload: { playerState } }
				),
			],
			gameStateId
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
		await syncTimerWithGameState(entry.gameState, entry.rules);
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

/** Drop every in-memory trace of a game: round timer, bank timers, state payload and presence. */
const _teardownGameState = async (gameStateId) => {
	await gameTimerManager.stopAndRemoveTimer(gameStateId);
	await BankStateService.stopAllTimersGame(gameStateId);
	GameStateManager.remove(gameStateId);
	PlayersStateConnectionManager.removeGame(gameStateId);
};

GameStateService.delete = async (gameStateId) => {
	await _teardownGameState(gameStateId);
	return await GameStateModel.findByIdAndDelete(gameStateId).exec();
};

/**
 * Evict games that have sat idle in memory past IDLE_EVICTION_MS, so an abandoned workshop cannot
 * hold its payload forever.
 *
 * A PLAYING game is never a candidate, nor is one still holding a prison sentence — that lives
 * only in its timer, so dropping it would strand the prisoner on resume. Everything else is
 * persisted under its own queue before being dropped, so the eviction is lossless — the next
 * access reloads it through getOrReload.
 * @returns {Promise<number>} how many games were evicted
 */
GameStateService.sweepIdleGames = async () => {
	const candidates = GameStateManager.idleGameIds(IDLE_EVICTION_MS);
	let evicted = 0;

	for (const gameStateId of candidates) {
		if (BankStateService.hasPrisonTimers(gameStateId)) {
			log.debug(`[GameStateService] Idle game ${gameStateId} kept in memory: prison sentence pending`);
			continue;
		}
		try {
			const persisted = await GameStateManager.withQueue(gameStateId, async (entry) => {
				if (GameStateManager.idleMs(gameStateId) <= IDLE_EVICTION_MS) return false;
				return await _persistAndDrain(entry, gameStateId);
			});
			if (!persisted) continue;

			await _teardownGameState(gameStateId);
			evicted++;
			log.info(`[GameStateService] Evicted idle game from memory: ${gameStateId}`);
		} catch (err) {
			log.error(`[GameStateService] Error evicting idle game ${gameStateId}`, err);
		}
	}

	return evicted;
};

GameStateService.removeAllBySessionId = async (id) => {
	const gameStates = await GameStateModel.find({ sessionId: id }, { _id: 1 }).lean();
	for (const { _id } of gameStates) {
		await _teardownGameState(_id.toString());
	}
	// Sweep any payload whose DB document was already gone before we listed them.
	GameStateManager.clearSession(id);
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
		let remainingTimeMs = roundMinutes * minute;
		const deathIntervalMs = remainingTimeMs / (entry.gameState.playersStates.length + 1);
		// Reuse the avatarIdx queue built at init; rebuild only if it is missing.
		const existingQueue = entry.gameState.gameTimers?.deathState?.deathQueue;
		const deathQueue =
			Array.isArray(existingQueue) && existingQueue.length
				? existingQueue
				: _.shuffle(entry.gameState.playersStates.map((p) => p.avatarIdx));

		if (entry.rules.typeMoney === GAME_TYPE.DEBT) {
			BankStateService.sweepUnansweredFirstCredit(entry);
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
				intervalDeathLeft: deathIntervalMs,
				deathQueue,
			},
		};

		//start credit timers if game is in debt mode
		if (entry.rules.typeMoney === GAME_TYPE.DEBT) {
			await BankStateService.startAllTimersCreditGame(gameStateId, entry.gameState.credits, entry.rules);
		}

		//create and store/start timer
		const timer = await _createTimer(entry.gameState, entry.rules);
		await gameTimerManager.startTimer(timer);
		log.info(`[GameStateService] Timer started: ${timer.id}`);

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

GameStateService.pause = async (gameStateId) => {
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		if (!entry) {
			log.warn(`[GameStateService] Game state not found in memory, skipping pause: ${gameStateId}`);
			return null;
		}
		if (entry.gameState.status === GAME_STATUS.PAUSED) {
			log.warn(`[GameStateService] Already paused: ${gameStateId}`);
			return null;
		}

		// Capture time-to-next-death before the timer is torn down, so resume restarts mid-cycle.
		const runningTimer = gameTimerManager.getTimer(gameStateId);
		const intervalDeathLeft = runningTimer
			? runningTimer.getRemainingInterval4Ms()
			: entry.gameState.gameTimers?.deathState?.deathIntervalMs;

		const remainingTimeMs = await gameTimerManager.pauseTimer(gameStateId);
		if (!remainingTimeMs) {
			log.warn(`[GameStateService] No remaining time for: ${gameStateId}`);
			return null;
		}

		await gameTimerManager.stopAndRemoveTimer(gameStateId);

		entry.gameState.status = GAME_STATUS.PAUSED;
		entry.gameState.gameTimers.remainingTime = remainingTimeMs;
		if (entry.gameState.gameTimers.deathState) {
			entry.gameState.gameTimers.deathState.intervalDeathLeft = intervalDeathLeft;
		}

		if (entry.rules.typeMoney === GAME_TYPE.DEBT) {
			//save all credits remaining time
			await BankStateService.pauseAllTimersCreditGame(gameStateId, entry.gameState.credits);
			await BankStateService.pauseAllPrisonTimers(gameStateId);
		}

		log.debug(`[GameStateService] Saving game state to DB: ${gameStateId}`);
		await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState });
		await EventService.postMany(entry.events, gameStateId);
		entry.events = [];
		EventService.postNow(
			DB_EVENTS.GAME_PAUSED,
			entry.gameState.sessionId,
			entry.gameState._id,
			PLAYER_TYPE.MASTER,
			'all',
			{}
		);
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.PAUSED, {});

		log.info(`[GameStateService] Game paused, saved and timer removed: ${gameStateId}`);
		return { status: GAME_STATUS.PAUSED, remainingTimeMs };
	});
};

GameStateService.resume = async (gameStateId) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		if (!entry) throw new Error('ERROR.GAME_STATE_NOT_FOUND');
		if (entry.gameState.status !== GAME_STATUS.PAUSED) throw new Error('ERROR.GAME_STATE_NOT_PAUSED');

		log.debug(`[GameStateService] Resuming game: ${gameStateId}`);

		// On recrée le timer depuis le gameState (remainingTime est la source de vérité)
		const timer = await _createTimer(entry.gameState, entry.rules);
		await gameTimerManager.startTimer(timer);

		entry.gameState.status = GAME_STATUS.PLAYING;

		if (entry.rules.typeMoney === GAME_TYPE.DEBT) {
			await BankStateService.resumeAllTimersCreditGame(gameStateId, entry.gameState.credits, entry.rules);
			await BankStateService.resumeAllPrisonTimers(gameStateId);
		}

		EventService.postNow(
			DB_EVENTS.GAME_RESUMED,
			entry.gameState.sessionId,
			gameStateId,
			PLAYER_TYPE.MASTER,
			null,
			null
		);
		await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState });
		socket.emitAckTo(ROOMS.gameState(gameStateId), IO.GAME.RESUMED, { gameStateId });

		log.info(`[GameStateService] Game resumed: ${gameStateId}`);
		return {
			status: GAME_STATUS.PLAYING,
			remainingTimeMs: entry.gameState.gameTimers?.remainingTime,
		};
	});
};

GameStateService.stop = async (gameStateId) => {
	log.debug(`[GameStateService] Stopping game: ${gameStateId}`);
	await gameTimerManager.stopAndRemoveTimer(gameStateId);
	if (GameStateManager.has(gameStateId)) {
		await GameStateManager.withQueue(gameStateId, async (entry) => {
			await BankStateService.stopAllTimersGame(gameStateId);
			entry.gameState.status = GAME_STATUS.STOPPED;
			if (entry.gameState.gameTimers) {
				entry.gameState.gameTimers.remainingTime = 0;
				// Round over: clear any avatars still scheduled to die — they simply never die.
				if (entry.gameState.gameTimers.deathState) {
					entry.gameState.gameTimers.deathState.deathQueue = [];
					entry.gameState.gameTimers.deathState.intervalDeathLeft = 0;
				}
			}
			await GameStateModel.findByIdAndUpdate(gameStateId, { $set: entry.gameState }, { new: true }).lean();
			await EventService.postMany(entry.events, gameStateId);
			entry.events = [];
			await EventService.postNow(
				DB_EVENTS.GAME_ENDED,
				entry.gameState.sessionId,
				gameStateId,
				PLAYER_TYPE.MASTER,
				null,
				null
			);
		});

		GameStateManager.remove(gameStateId);
		log.debug(`[GameStateService] Game state deleted from memory: ${gameStateId}`);

		// Emit STOPPED event
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.STOPPED, {});
		log.info(`[GameStateService] Game stopped : ${gameStateId}`);
	} else {
		log.debug(`[GameStateService] Game state not found in memory, saving STOPPED status in DB: ${gameStateId}`);
		await BankStateService.stopAllTimersGame(gameStateId);
		await GameStateModel.findByIdAndUpdate(gameStateId, {
			$set: {
				status: GAME_STATUS.STOPPED,
				'gameTimers.remainingTime': 0,
			},
		}).lean();
		// Still emit the event to notify clients
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.STOPPED, {});
	}
	PlayersStateConnectionManager.removeGame(gameStateId);
	return {
		status: GAME_STATUS.STOPPED,
	};
};

export default GameStateService;
