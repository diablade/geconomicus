import log from "#config/log";
import Timer from "../misc/Timer.js";

// ─── Timer helpers ───────────────────────────────────────────────────────────

const _addDebtTimer = (creditId, startTickNow, duration, data) => {
    bankTimerManager.addTimer(new Timer(creditId, duration * minute, fiveSeconds, data, (timer) => {
        const remainingTime = differenceInMilliseconds(timer.endTime, new Date());
        const totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);
        const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
        socket.emitTo(timer.data.gameStateId + BANK, IO.CREDIT_PROGRESS, { id: creditId, progress });
        socket.emitTo(timer.data.playerLifeIdx.toString(), IO.CREDIT_PROGRESS, { id: creditId, progress });
    }, (timer) => {
        _timeoutCredit(timer);
    }), startTickNow);
};

const _addPrisonTimer = (playerId, duration, data) => {
    bankTimerManager.addTimer(new Timer(playerId, duration * minute, fiveSeconds, data, (timer) => {
        const remainingTime = differenceInMilliseconds(timer.endTime, new Date());
        const totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);
        const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
        socket.emitTo(timer.data.gameStateId + BANK, IO.PRISON_PROGRESS, { id: playerId, progress, remainingTime });
        socket.emitTo(timer.data.playerLifeIdx.toString(), IO.PRISON_PROGRESS, { id: playerId, progress, remainingTime });
    }, (timer) => {
        _timeoutPrison(timer);
    }), true);
};

const _timeoutCredit = async (timer) => {
    if (!timer) return;
    const { gameStateId, playerLifeIdx, creditIdx } = timer.data;
    await bankTimerManager.stopAndRemoveTimer(timer.id);

    try {
        await inMemoryGameStateManager.withLock(gameStateId, ({ state, rules }) => {
            const credit = _findCredit(state, creditIdx);
            const player = _findPlayer(state, playerLifeIdx);

            if (credit.status === CREDIT_DONE) return;

            if (credit.amount + credit.interest <= player.coins) {
                // Player can pay interest — request it
                credit.status = REQUEST_CREDIT;
                const event = _makeEvent(REQUEST_CREDIT, MASTER, playerLifeIdx, credit.amount, [credit]);
                state.events = state.events || [];
                state.events.push(event);
                socket.emitTo(gameStateId + EVENT, EVENT, event);
                socket.emitAckTo(playerLifeIdx.toString(), IO.CREDIT_TIMEOUT, { credit });
                socket.emitTo(gameStateId + BANK, IO.CREDIT_TIMEOUT, credit);
            } else {
                // Default
                credit.status = DEFAULT_CREDIT;
                const event = _makeEvent(DEFAULT_CREDIT, MASTER, playerLifeIdx, credit.amount, [credit]);
                state.events = state.events || [];
                state.events.push(event);
                socket.emitTo(gameStateId + EVENT, EVENT, event);
                socket.emitTo(gameStateId + BANK, IO.CREDIT_DEFAULT, credit);
                if (player.status !== DEAD) {
                    socket.emitAckTo(playerLifeIdx.toString(), IO.CREDIT_DEFAULT, { credit });
                }
            }
        });
    } catch (err) {
        log.error(`[bankMemService] _timeoutCredit error: ${err}`);
    }
};

// const _timeoutPrison = async (timer) => {
//     if (!timer) return;
//     const { gameStateId, playerLifeIdx } = timer.data;
//     await bankTimerManager.stopAndRemoveTimer(timer.id);
//     await getOut(gameStateId, playerLifeIdx);
// };

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
                    log.error(`Error stopping timer ${id}: ${err}`);
                });
                // Remove the timer from the map
                const wasDeleted = this.timers.delete(id);
                if (wasDeleted) {
                    log.debug(`Successfully stopped and removed bank timer ${id}`);
                } else {
                    log.warn(`Bank timer ${id} not found in timers map when trying to remove`);
                }
            } else {
                log.debug(`Bank timer ${id} not found, nothing to stop`);
            }
            return true;
        } catch (err) {
            log.error(`Unexpected error in stopAndRemoveTimer for bank timer ${id}: ${err}`);
            return false;
        }
    }

    startAllDebtTimersOfGameState(gameStateId) {
        for (const timer of this.timers.values()) {
            if (timer?.data?.gameStateId === gameStateId) {
                timer.start();
            }
        }
    }

    async stopPlayerDebtsTimer(gameStateId, playerIdx) {
        const timersToRemove = [];

        // First, collect all timer IDs to remove
        for (const [id, timer] of this.timers.entries()) {
            if (timer?.data?.gameStateId === gameStateId && timer?.data?.playerIdx === playerIdx) {
                timersToRemove.push(id);
            }
        }

        // Then stop and remove them one by one
        for (const id of timersToRemove) {
            await this.stopAndRemoveTimer(id);
        }
    }

    async stopAndRemoveAllGameStateTimers(gameStateId) {
        const timersToRemove = [];

        // First, collect all timer IDs to remove
        for (const [id, timer] of this.timers.entries()) {
            if (timer?.data?.gameStateId === gameStateId) {
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
