import gameQueueManager from './GameQueueManager.js';
import log from '#config/log';
import { GAME_STATUS } from '@geco/shared';
import GameStateModel from '../game.state.model.js';
import RulesService from '../../session/rules/rules.service.js';
import socket from '#config/socket';
import { IO } from '@geco/shared';

/**
 * InMemoryGameStateManager
 *
 * Singleton that holds all live game payloads in memory.
 * Each entry is { state, rules }:
 *   - state: the mutable game state (playersStates, decks, credits, etc.)
 *   - rules: the immutable rules for the game (used for calculations, never persisted here)
 *
 * The periodic DB save (every 60s) persists state only — rules come from the session.
 */
class GameStateManager {
	constructor() {
		if (!GameStateManager.instance) {
			// Map<gameStateId, { state: POJO, rules: POJO }>
			this._games = new Map();
			GameStateManager.instance = this;
		}
		return GameStateManager.instance;
	}

	/**
	 * Store a game payload (state + rules) in memory.
	 * @param {string} gameStateId
	 * @param {object} gameState — plain JS object matching GameStateSchema
	 * @param {object} rules — plain JS rules object from the session
	 */
	store(gameStateId, gameState, rules) {
		this._games.set(gameStateId, { gameState, rules });
		log.debug(`[GameStateManager] Game ${gameStateId} loaded into memory`);
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
	 * @returns {{ state: object, rules: object } | null}
	 */
	get(gameStateId) {
		return this._games.get(gameStateId) || null;
	}

	/**
	 * Get the full payload { state, rules } for a game, reloading from DB if not in memory.
	 * @param {string} gameStateId
	 * @returns {{ state: object, rules: object } | null}
	 */
	async getOrReload(gameStateId) {
		let entry = this.get(gameStateId);
		if (!entry) {
			await this.reload(gameStateId); // recharge si PLAYING/PAUSED
			entry = this.get(gameStateId);
		}
		return entry;
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
	 * Clear all games for a session.
	 * @param {string} sessionId
	 */
	clearSession(sessionId) {
		for (const key of this._games.keys()) {
			if (key.startsWith(`${sessionId}:`)) {
				this.remove(key);
			}
		}
	}

	async reload(gameStateId) {
		const fromDb = await GameStateModel.findById(gameStateId).lean();
		if (!fromDb) {
			throw new Error(`[GameStateManager] Game ${gameStateId} not found in DB`);
		}

		// Only reload if the game is in a state that should be in memory
		if (![GAME_STATUS.PLAYING, GAME_STATUS.PAUSED].includes(fromDb.status)) {
			// Notifie le game master et throw
			socket.emitTo(`${gameStateId}:master`, IO.INFO, {
				message: 'Game not found or not reloadable',
			});
			throw new Error(`[GameStateManager] Game ${gameStateId} is ${fromDb.status}, not reloading`);
		}

		const rules = await RulesService.getByIdx(fromDb.sessionId, fromDb.ruleIdx);
		if (!rules) {
			throw new Error(
				`[GameStateManager] Rules ${fromDb.ruleIdx} not found in session ${fromDb.sessionId} for game ${gameStateId}`
			);
		}
		this.store(gameStateId, fromDb, rules);
		log.info(`[WARN] Game ${gameStateId} reloaded from DB (in memory)`);
		socket.emitTo(`${gameStateId}:master`, IO.INFO, {
			gameStateId,
			message: 'Game reloaded from DB after memory loss',
		});
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
	withQueue(gameStateId, fn) {
		return gameQueueManager.enqueue(gameStateId, async () => {
			let entry = this.get(gameStateId);
			if (!entry) {
				log.error(`[GameStateManager] Game ${gameStateId} not found in memory`);
				await this.reload(gameStateId);
				entry = this.get(gameStateId);
				// security net: reload() could have stored it but get() still fails
				if (!entry) throw new Error(`[GameStateManager] Game ${gameStateId} still not found after reload`);
			}
			return fn(entry);
		});
	}
}

const gameStateManager = new GameStateManager();
Object.freeze(gameStateManager);

export default gameStateManager;
