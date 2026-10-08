/**
 * GameQueueManager
 *
 * Per-game async queue using promise chaining.
 * Each game has an independent queue — different games never block each other.
 * Only concurrent requests targeting the SAME gameStateId are serialized.
 *
 * Usage:
 *   const result = await gameQueueManager.enqueue(gameStateId, async () => {
 *       // mutate in-memory state safely
 *       return result;
 *   });
 */
class GameQueueManager {
    constructor() {
        if (!GameQueueManager.instance) {
            // Map<gameStateId, Promise> — the "tail" of each game's queue chain
            this._queues = new Map();
            GameQueueManager.instance = this;
        }
        return GameQueueManager.instance;
    }

    /**
     * Enqueue an operation for a specific game. Runs fn() exclusively after any pending operations.
     * @param {string} gameStateId
     * @param {function(): Promise<any>} fn — async work to run exclusively
     * @returns {Promise<any>} resolves with fn()'s return value
     */
    enqueue(gameStateId, fn) {
        // Get the current tail (or a resolved promise if the queue is empty)
        const current = this._queues.get(gameStateId) || Promise.resolve();

        // Build a new tail: wait for current, then run fn
        const next = current
            .then(() => fn())
            .finally(() => {
                // If we are still the tail, clean up the map entry
                if (this._queues.get(gameStateId) === next) {
                    this._queues.delete(gameStateId);
                }
            });

        this._queues.set(gameStateId, next);
        return next;
    }

    /**
     * Check if there are pending operations in the queue for a game.
     * @param {string} gameStateId
     * @returns {boolean}
     */
    isPending(gameStateId) {
        return this._queues.has(gameStateId);
    }
}

const gameQueueManager = new GameQueueManager();
Object.freeze(gameQueueManager);

export default gameQueueManager;
