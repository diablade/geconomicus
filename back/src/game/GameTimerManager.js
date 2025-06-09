import _ from "lodash";

class GameTimerManager {
    constructor() {
        if (!GameTimerManager.instance) {
            this.timers = [];
            GameTimerManager.instance = this;
        }
        return GameTimerManager.instance;
    }

    async addTimer(timer) {
        await this.stopAndRemoveTimer(timer.id);
        this.timers.push(timer);
    }

    getTimer(id) {
        return _.find(this.timers, (timer) => timer.id === id);
    }

    async stopAndRemoveTimer(id) {
        try {
            const timer = this.getTimer(id);
            if (timer) {
                await timer.stop().catch(err => {
                    log.error(`Error stopping timer ${id}:`, err);
                });
                _.remove(this.timers, { "id": id });
            }
        } catch (err) {
            log.error(`Unexpected error in stopAndRemoveTimer for ${id}:`, err);
        }
    }
}

const gameTimerManager = new GameTimerManager();
Object.freeze(gameTimerManager);

export default gameTimerManager;
