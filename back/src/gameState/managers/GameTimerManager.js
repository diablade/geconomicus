import log from "#config/log";
import GameStateService from '../game.state.service.js';

class GameTimerManager {
    constructor() {
        if (!GameTimerManager.instance) {
            this.timers = new Map();
            // Map<gameStateId, intervalId> for periodic DB persistence
            this._persistenceIntervals = new Map();
            GameTimerManager.instance = this;
        }
        return GameTimerManager.instance;
    }

    async addTimer(timer) {
        await this.stopAndRemoveTimer(timer.id);
        this.timers.set(timer.id, timer);
    }

    getTimer(id) {
        return this.timers.get(id);
    }

    async stopAndRemoveTimer(id) {
        try {
            const timer = this.getTimer(id);
            if (timer) {
                // Wait for the timer to fully stop
                await timer.stop().catch(err => {
                    log.error(`Error stopping timer ${id}:`, err);
                });
                // Remove the timer from the map
                const wasDeleted = this.timers.delete(id);
                if (wasDeleted) {
                    log.debug(`Successfully stopped and removed timer ${id}`);
                } else {
                    log.warn(`Timer ${id} not found in timers map when trying to remove`);
                }
            } else {
                log.debug(`Timer ${id} not found, nothing to stop`);
            }
            return true;
        } catch (err) {
            log.error(`Unexpected error in stopAndRemoveTimer for ${id}:`, err);
            return false;
        }
    }

    /**
     * Start a periodic persistence timer for a game (every 60s).
     * Fires GameStateService.saveGameStateToDB to flush in-memory state to MongoDB.
     * @param {string} gameStateId
     * @param {number} [intervalMs=60000]
     */
    addPersistenceTimer(gameStateId, intervalMs = 60_000) {
        this.stopPersistenceTimer(gameStateId); // clear any existing
        const id = setInterval(async () => {
            try {
                await GameStateService.saveGameStateToDB(gameStateId);
                log.debug(`[GameTimerManager] Persisted game ${gameStateId} to DB`);
            } catch (err) {
                log.error(`[GameTimerManager] Failed to persist game ${gameStateId}:`, err);
            }
        }, intervalMs);
        this._persistenceIntervals.set(gameStateId, id);
        log.debug(`[GameTimerManager] Persistence timer started for game ${gameStateId} (every ${intervalMs}ms)`);
    }

    /**
     * Stop and remove the persistence timer for a game.
     * Call this on game end / delete (after the final manual save).
     * @param {string} gameStateId
     */
    stopPersistenceTimer(gameStateId) {
        const id = this._persistenceIntervals.get(gameStateId);
        if (id !== undefined) {
            clearInterval(id);
            this._persistenceIntervals.delete(gameStateId);
            log.debug(`[GameTimerManager] Persistence timer stopped for game ${gameStateId}`);
        }
    }
}

const gameTimerManager = new GameTimerManager();
Object.freeze(gameTimerManager);

export default gameTimerManager;
