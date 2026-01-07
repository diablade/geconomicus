import log from "#config/log";

class GameTimerManager {
    constructor() {
        if (!GameTimerManager.instance) {
            this.timers = new Map();
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
                }
                else {
                    log.warn(`Timer ${id} not found in timers map when trying to remove`);
                }
            }
            else {
                log.debug(`Timer ${id} not found, nothing to stop`);
            }
            return true;
        }
        catch (err) {
            log.error(`Unexpected error in stopAndRemoveTimer for ${id}:`, err);
            return false;
        }
    }
}

const gameTimerManager = new GameTimerManager();
Object.freeze(gameTimerManager);

export default gameTimerManager;
