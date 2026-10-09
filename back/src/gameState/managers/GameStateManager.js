import gameQueueManager from './GameQueueManager.js';
import log from '#config/log';
import { GAME_STATUS } from '@geco/shared';
import GameStateModel from '../game.state.model.js';
import RulesService from '../../session/rules/rules.service.js';
import socket from '#config/socket';
import { IO } from '@geco/shared';
import gameTimerManager from './GameTimerManager.js';
import creditTimerManager from './CreditTimerManager.js';

/**
 * InMemoryGameStateManager
 *
 * Singleton that holds all live game payloads in memory.
 * Each entry is { state, rules }:
 *   - state: the mutable game state (playersStates, decks, credits, etc.)
 *   - rules: the immutable rules for the game (used for calculations, never persisted here)
 *   - events: historical events that occurred during the game (buffered in memory before being saved to DB)
 *
 * The periodic DB save (every 60s) persists state only — rules come from the session.
 */
class GameStateManager {
	constructor() {
		if (!GameStateManager.instance) {
			// Map<gameStateId, { gameState: POJO, rules: POJO, events: object[] }>
			this._games = new Map();
			// Hooks run (in order) after every successful withQueue mutation, with the
			// entry still under lock. Registered once at import time (e.g. the auto-bank
			// rate-change broadcast). Array so it stays mutable under Object.freeze.
			this._afterMutations = [];
			GameStateManager.instance = this;
		}
		return GameStateManager.instance;
	}

	/**
	 * Register a post-mutation hook: fn(entry) is awaited after each withQueue fn
	 * resolves, inside the same lock. A throwing hook is logged, never propagated,
	 * so it cannot break the mutation it observes.
	 * @param {function({ gameState: object, rules: object, events: object[] }): (void|Promise<void>)} fn
	 */
	onAfterMutation(fn) {
		if (typeof fn === 'function') this._afterMutations.push(fn);
	}

	/**
	 * Store a game payload (state + rules) in memory.
	 * @param {string} gameStateId
	 * @param {object} gameState — plain JS object matching GameStateSchema
	 * @param {object} rules — plain JS rules object from the session
	 * @param {object[]} events — array of historical events (buffered in memory)
	 */
	store(gameStateId, gameState, rules, events = []) {
		this._games.set(gameStateId, { gameState, rules, events, lastTouchedAt: Date.now() });
		log.debug(`[GameStateManager] Game ${gameStateId} loaded into memory`);
	}

	/**
	 * How long a resident game has gone without a mutation. A game absent from memory reads as
	 * infinitely idle, so a caller sweeping on this value never has to special-case it.
	 * @param {string} gameStateId
	 * @returns {number} milliseconds since the last withQueue mutation
	 */
	idleMs(gameStateId) {
		const entry = this.get(gameStateId);
		if (!entry) return Infinity;
		return Date.now() - (entry.lastTouchedAt ?? 0);
	}

	/**
	 * Resident games idle beyond maxIdleMs. A PLAYING game is never listed — its round timer
	 * mutates it on every heartbeat, and stopping owns its removal.
	 * @param {number} maxIdleMs
	 * @returns {string[]}
	 */
	idleGameIds(maxIdleMs) {
		const ids = [];
		for (const [gameStateId, entry] of this._games) {
			if (entry.gameState?.status === GAME_STATUS.PLAYING) continue;
			if (this.idleMs(gameStateId) > maxIdleMs) ids.push(gameStateId);
		}
		return ids;
	}

	/**
	 * Check if a game is loaded in memory.
	 * @param {string} gameStateId
	 * @returns {boolean}
	 */
	has(gameStateId) {
		return this._games.has(gameStateId);
	}

	/**
	 * Get the full payload { state, rules } for a game.
	 * @param {string} gameStateId
	 * @returns {{ gameState: object, rules: object, events: object[] } | null}
	 */
	get(gameStateId) {
		return this._games.get(gameStateId) || null;
	}

	/**
	 * Get the full payload { state, rules } for a game, reloading from DB if not in memory.
	 *
	 * A game whose status no longer belongs in memory (STOPPED/ENDED) cannot be reloaded, so it
	 * comes back detached and flagged `resident: false` — readable (the results page needs it),
	 * but not tracked by the manager, so mutating it would silently lose the write.
	 * @param {string} gameStateId
	 * @returns {{ gameState: object, rules: object, events?: object[], resident?: boolean } | null}
	 */
	async getOrReload(gameStateId) {
		const entry = this.get(gameStateId);
		if (entry) return entry;

		const reload = await this.reload(gameStateId); // recharge si PLAYING/PAUSED
		if (reload.reloaded) return this.get(gameStateId);

		return { gameState: reload.gameState, rules: reload.rules, resident: false };
	}

	/**
	 * Get only the state for a game.
	 * @param {string} gameStateId
	 * @returns {object | null}
	 */
	getGameState(gameStateId) {
		const entry = this.get(gameStateId);
		return entry ? entry.gameState : null;
	}

	/**
	 * Get only the rules for a game.
	 * @param {string} gameStateId
	 * @returns {object | null}
	 */
	getRules(gameStateId) {
		const entry = this.get(gameStateId);
		return entry ? entry.rules : null;
	}

	/**
	 * Remove a game from memory (call on end/delete after final DB save).
	 * @param {string} gameStateId
	 */
	remove(gameStateId) {
		this._games.delete(gameStateId);
		log.debug(`[GameStateManager] Game ${gameStateId} removed from memory`);
	}

	/**
	 * Clear all games for a session. Entries are keyed by bare gameStateId, so the session is
	 * read off each payload rather than off the key.
	 * @param {string} sessionId
	 */
	clearSession(sessionId) {
		for (const [key, entry] of Array.from(this._games.entries())) {
			if (String(entry.gameState?.sessionId) === String(sessionId)) {
				this.remove(key);
			}
		}
	}

	async reload(gameStateId) {
		const gameState = await GameStateModel.findById(gameStateId).lean();
		if (!gameState) {
			throw new Error(`[GameStateManager] Game ${gameStateId} not found in DB`);
		}
		const rules = await RulesService.getByIdx(gameState.sessionId, gameState.ruleIdx);
		if (!rules) {
			throw new Error(
				`[GameStateManager] Rules ${gameState.ruleIdx} not found in session ${gameState.sessionId} for game ${gameStateId}`
			);
		}

		// Only reload if the game is in a state that should be in memory
		if (
			![
				GAME_STATUS.CREATED,
				GAME_STATUS.INITIALIZED,
				GAME_STATUS.PLAYING,
				GAME_STATUS.PAUSED,
				GAME_STATUS.FINISHED,
			].includes(gameState.status)
		) {
			log.warn(
				`[GameStateManager] Game ${gameStateId} has status: ${gameState.status}, will not be stored in memory`
			);
			return { reloaded: false, gameState, rules };
		}

		this.store(gameStateId, gameState, rules);
		log.info(`[GameStateManager] Game ${gameStateId} reloaded (in memory) from DB`);
		socket.emitTo(`${gameStateId}:master`, IO.INFO, {
			gameStateId,
			message: 'Game reloaded from DB after memory loss',
		});
		return { reloaded: true };
	}

	/**
	 * Enqueue for a game, then run fn with { state, rules }.
	 * fn must return the (potentially mutated) state object.
	 * Rules are never mutated via this path.
	 *
	 * @param {string} gameStateId
	 * @param {function({ state: object, rules: object }): Promise<any>} fn
	 * @returns {Promise<any>} resolves with fn's return value
	 */
	async withQueue(gameStateId, fn) {
		return gameQueueManager.enqueue(gameStateId, async () => {
			const entry = await this.getOrReload(gameStateId);
			if (!entry) throw new Error(`[GameStateManager] Game ${gameStateId} still not found after reload`);
			if (entry.resident === false) {
				throw new Error(
					`[GameStateManager] Game ${gameStateId} is ${entry.gameState.status} and not in memory — refusing to mutate a detached state`
				);
			}
			const result = await fn(entry);
			entry.lastTouchedAt = Date.now();
			for (const hook of this._afterMutations) {
				try {
					await hook(entry);
				} catch (err) {
					log.error(`[GameStateManager] afterMutation hook failed: ${err.message}`);
				}
			}
			return result;
		});
	}
}

const gameStateManager = new GameStateManager();
Object.freeze(gameStateManager);

export default gameStateManager;
