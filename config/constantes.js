// (ES5 compatible)
const OPEN = 'open';
const JUNE= 'june';
const START_GAME = 'start-game';
const STOP_GAME = 'stop-game';
const START_ROUND = 'start-round';
const STOP_ROUND = 'stop-round';
const TIMER_LEFT = 'timer-left';
const INTER_TOUR = 'intertour';
const STARTED = 'started';
const EVENT = 'event';
const MASTER = 'master';
const DISTRIB_DU = 'distrib_du';
const DISTRIB = 'distrib';
const FIRST_DU = 'first_du';
const RESET_GAME = 'reset-game';
const TRANSACTION_DONE = 'transaction-done';
const TRANSACTION = 'transaction';
const TRANSFORM_DISCARDS = "transformDiscards";
const TRANSFORM_NEWCARDS = "transformNewCards";
const DEAD="dead";
const REMIND_DEAD="remind-dead";
const ALIVE="alive";
const BIRTH="birth";

if (typeof module !== 'undefined' && module.exports) {
// Export the constants for use in other scripts if needed (for ES6 and later).
    module.exports = {
        OPEN: OPEN,
        JUNE: JUNE,
        DEAD: DEAD,
        REMIND_DEAD: REMIND_DEAD,
        ALIVE:ALIVE,
        BIRTH:BIRTH,
        START_GAME: START_GAME,
        STOP_GAME: STOP_GAME,
        START_ROUND: START_ROUND,
        TIMER_LEFT:TIMER_LEFT,
        STOP_ROUND: STOP_ROUND,
        INTER_TOUR: INTER_TOUR,
        STARTED: STARTED,
        EVENT: EVENT,
        MASTER: MASTER,
        DISTRIB_DU: DISTRIB_DU,
        DISTRIB: DISTRIB,
        FIRST_DU: FIRST_DU,
        RESET_GAME: RESET_GAME,
        TRANSACTION: TRANSACTION,
        TRANSACTION_DONE: TRANSACTION_DONE,
        TRANSFORM_DISCARDS:TRANSFORM_DISCARDS,
        TRANSFORM_NEWCARDS:TRANSFORM_NEWCARDS,
    };
}

