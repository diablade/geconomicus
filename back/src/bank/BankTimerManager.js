import _ from "lodash";

class BankTimerManager {
    constructor() {
        if (!BankTimerManager.instance) {
            this.timers = [];
            BankTimerManager.instance = this;
        }
        return BankTimerManager.instance;
    }

    async addTimer(timer, startTickNow) {
        await this.stopAndRemoveTimer(timer.id);
        this.timers.push(timer);
        if (startTickNow) {
            timer.start();
        }
    }

    getTimer(id) {
        return _.find(this.timers, (timer) => timer.id === id);
    }

    async stopAndRemoveTimer(id) {
        let timer = this.getTimer(id);
        if (timer) {
            await timer.stop();
            _.remove(this.timers, {"id": id});
        }
    }

    startAllIdGameDebtTimer(idGame) {
        _.forEach(this.timers, (timer) => {
            if (timer && timer.data && timer.data.idGame === idGame) {
                timer.start();
                timer.data.status = "running";
            }
        });
    }

    stopAllPlayerDebtsTimer(idGame, idPlayer) {
        _.forEach(this.timers, (timer) => {
            if (timer && timer.data && timer.data.idGame === idGame && timer.data.idPlayer === idPlayer) {
                this.stopAndRemoveTimer(timer.id);
            }
        });
    }

    stopAndRemoveAllIdGameDebtTimer(idGame) {
        _.forEach(this.timers, (timer) => {
            if (timer && timer.data && timer.data.idGame === idGame) {
                this.stopAndRemoveTimer(timer.id);
            }
        });
    }
}

const bankTimerManager = new BankTimerManager();
Object.freeze(bankTimerManager);

export default bankTimerManager;
