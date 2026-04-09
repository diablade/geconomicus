import gameQueueManager from './GameQueueManager.js';
import log from '#config/log';

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
     * @param {object} state — plain JS object matching GameStateSchema
     * @param {object} rules — plain JS rules object from the session
     */
    setGame(gameStateId, state, rules) {
        this._games.set(gameStateId, { state, rules });
        log.debug(`[InMemoryGameStateManager] Game ${gameStateId} loaded into memory`);
    }

    /**
     * Get the full payload { state, rules } for a game.
     * @param {string} gameStateId
     * @returns {{ state: object, rules: object } | null}
     */
    getGame(gameStateId) {
        return this._games.get(gameStateId) || null;
    }

    /**
     * Get only the state for a game.
     * @param {string} gameStateId
     * @returns {object | null}
     */
    getState(gameStateId) {
        const entry = this._games.get(gameStateId);
        return entry ? entry.state : null;
    }

    /**
     * Get only the rules for a game.
     * @param {string} gameStateId
     * @returns {object | null}
     */
    getRules(gameStateId) {
        const entry = this._games.get(gameStateId);
        return entry ? entry.rules : null;
    }

    /**
     * @param {string} gameStateId
     * @returns {boolean}
     */
    hasGame(gameStateId) {
        return this._games.has(gameStateId);
    }

    /**
     * Remove a game from memory (call on end/delete after final DB save).
     * @param {string} gameStateId
     */
    removeGame(gameStateId) {
        this._games.delete(gameStateId);
        log.debug(`[InMemoryGameStateManager] Game ${gameStateId} removed from memory`);
    }

    /**
     * Clear all games for a session.
     * @param {string} sessionId
     */
    clearSession(sessionId) {
        for (const key of this.games.keys()) {
            if (key.startsWith(`${sessionId}:`)) {
                this.games.delete(key);
            }
        }
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
            const entry = this._games.get(gameStateId);
            if (!entry) {
                throw new Error(`[InMemoryGameStateManager] Game ${gameStateId} not found in memory`);
            }
            return fn(entry);
        });
    }
}

const gameStateManager = new GameStateManager();
Object.freeze(gameStateManager);

export default gameStateManager;
