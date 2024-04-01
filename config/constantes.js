// (ES5 compatible)
const OPEN = 'open';
const JUNE = 'june';
const DEBT = 'debt';
const NEW_CREDIT = "new-credit";
const RUNNING_CREDIT = "running";
const PAUSED_CREDIT = "paused";
const PAYED_INTEREST = "payed-interest";
const CREDIT_DONE = "credit-done";
const TIMEOUT_CREDIT = "timeout-credit";
const DEFAULT_CREDIT = "default-credit";
const REQUEST_CREDIT = "requesting";
const PROGRESS_CREDIT = "credit-progress";
const START_GAME = 'start-game';
const END_GAME = 'end-game';
const START_ROUND = 'start-round';
const PLAYING = 'playing';
const STOP_ROUND = 'stop-round';
const TIMER_LEFT = 'timer-left';
const INTER_ROUND = 'inter-round';
const EVENT = 'event';
const MASTER = 'master';
const DISTRIB_DU = 'distrib_du';
const DISTRIB = 'distrib';
const FIRST_DU = 'first_du';
const RESET_GAME = 'reset-game';
const NEW_FEEDBACK = 'new-feedback';
const TRANSACTION_DONE = 'transaction-done';
const TRANSACTION = 'transaction';
const TRANSFORM_DISCARDS = "transformDiscards";
const TRANSFORM_NEWCARDS = "transformNewCards";
const DEAD = "dead";
const REMIND_DEAD = "remind-dead";
const ALIVE = "alive";
const BIRTH = "birth";

if (typeof module !== 'undefined' && module.exports) {
// Export the constants for use in other scripts if needed (for ES6 and later).
    module.exports = {
        OPEN: OPEN,
        JUNE: JUNE,
        DEBT: DEBT,
        DEAD: DEAD,
        NEW_CREDIT: NEW_CREDIT,
        RUNNING_CREDIT: RUNNING_CREDIT,
        PAUSED_CREDIT: PAUSED_CREDIT,
        PAYED_INTEREST: PAYED_INTEREST,
        CREDIT_DONE: CREDIT_DONE,
        TIMEOUT_CREDIT: TIMEOUT_CREDIT,
        REQUEST_CREDIT: REQUEST_CREDIT,
        DEFAULT_CREDIT: DEFAULT_CREDIT,
        PROGRESS_CREDIT: PROGRESS_CREDIT,
        REMIND_DEAD: REMIND_DEAD,
        ALIVE: ALIVE,
        BIRTH: BIRTH,
        START_GAME: START_GAME,
        END_GAME: END_GAME,
        NEW_FEEDBACK: NEW_FEEDBACK,
        START_ROUND: START_ROUND,
        PLAYING:PLAYING,
        TIMER_LEFT: TIMER_LEFT,
        STOP_ROUND: STOP_ROUND,
        INTER_ROUND: INTER_ROUND,
        EVENT: EVENT,
        MASTER: MASTER,
        DISTRIB_DU: DISTRIB_DU,
        DISTRIB: DISTRIB,
        FIRST_DU: FIRST_DU,
        RESET_GAME: RESET_GAME,
        TRANSACTION: TRANSACTION,
        TRANSACTION_DONE: TRANSACTION_DONE,
        TRANSFORM_DISCARDS: TRANSFORM_DISCARDS,
        TRANSFORM_NEWCARDS: TRANSFORM_NEWCARDS,
    };
}

