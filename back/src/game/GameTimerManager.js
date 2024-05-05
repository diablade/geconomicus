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

    stopAndRemoveTimer(id) {
        let timer = this.getTimer(id);
        if (timer) {
            timer.stop();
            _.remove(this.timers, {"id": id});
        }
    }
}

const gameTimerManager = new GameTimerManager();
Object.freeze(gameTimerManager);

export default gameTimerManager;
