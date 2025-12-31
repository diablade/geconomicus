import log from "../../../config/log.js";

class BankTimerManager {
    constructor() {
        if (!BankTimerManager.instance) {
            this.timers = new Map();
            BankTimerManager.instance = this;
        }
        return BankTimerManager.instance;
    }

    async addTimer(timer, startTickNow) {
        await this.stopAndRemoveTimer(timer.id);
        this.timers.set(timer.id, timer);
        if (startTickNow) {
            timer.start();
        }
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
                    log.debug(`Successfully stopped and removed bank timer ${id}`);
                }
                else {
                    log.warn(`Bank timer ${id} not found in timers map when trying to remove`);
                }
            }
            else {
                log.debug(`Bank timer ${id} not found, nothing to stop`);
            }
            return true;
        }
        catch (err) {
            log.error(`Unexpected error in stopAndRemoveTimer for bank timer ${id}:`, err);
            return false;
        }
    }

    startAllIdGameDebtTimer(idGame) {
        for (const timer of this.timers.values()) {
            if (timer?.data?.idGame === idGame) {
                timer.start();
            }
        }
    }

    async stopAllPlayerDebtsTimer(idGame, idPlayer) {
        const timersToRemove = [];

        // First, collect all timer IDs to remove
        for (const [id, timer] of this.timers.entries()) {
            if (timer?.data?.idGame === idGame && timer?.data?.idPlayer === idPlayer) {
                timersToRemove.push(id);
            }
        }

        // Then stop and remove them one by one
        for (const id of timersToRemove) {
            await this.stopAndRemoveTimer(id);
        }
    }

    async stopAndRemoveAllIdGameDebtTimer(idGame) {
        const timersToRemove = [];

        // First, collect all timer IDs to remove
        for (const [id, timer] of this.timers.entries()) {
            if (timer?.data?.idGame === idGame) {
                timersToRemove.push(id);
            }
        }

        // Then stop and remove them one by one
        for (const id of timersToRemove) {
            await this.stopAndRemoveTimer(id);
        }
    }
}

const bankTimerManager = new BankTimerManager();
Object.freeze(bankTimerManager);

export default bankTimerManager;
