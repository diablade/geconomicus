// (ES5 compatible)
const OPEN = 'open';
const JUNE = 'june';
const DEBT = 'debt';
const EVENT = 'event';
const MASTER = 'master';
const BANK = 'bank';
const DEATH = 'death';

const CREATE_GAME = "create-game";
const NEW_PLAYER = "new-player";
const COPY_PLAYER = "copy-player";
const UPDATED_PLAYER = "updated-player";
const UPDATE_GAME_OPTION = "update-game-option";
const NEW_CREDIT = "new-credit";
const CREDITS_STARTED = "credits-started";
const SETTLE_CREDIT = "settle-credit";
const PROGRESS_CREDIT = "credit-progress";
const TIMEOUT_CREDIT = "timeout-credit";
const PAY_INTEREST = "pay-interest";
const PAYED_INTEREST = "payed-interest";
const SEIZED_DEAD = "seized-dead";
const SEIZURE = "seizure";

//STATUS CREDIT
const PAUSED_CREDIT = "paused";
const RUNNING_CREDIT = "running";
const REQUEST_CREDIT = "requesting";
const DEFAULT_CREDIT = "default-credit";
const CREDIT_DONE = "credit-done";

const START_GAME = 'start-game';
const END_GAME = 'end-game';
const START_ROUND = 'start-round';
const PLAYING = 'playing';
const STOP_ROUND = 'stop-round';
const TIMER_LEFT = 'timer-left';
const INTER_ROUND = 'inter-round';
const DISTRIB_DU = 'distrib_du';
const INIT_DISTRIB = 'distrib';
const FIRST_DU = 'first_du';
const RESET_GAME = 'reset-game';
const NEW_FEEDBACK = 'new-feedback';
const TRANSACTION_DONE = 'transaction-done';
const TRANSACTION = 'transaction';
const TRANSFORM_DISCARDS = "transformDiscards";
const TRANSFORM_NEWCARDS = "transformNewCards";
const DEATH_IS_COMING = "death-is-coming";
const DEAD = "dead";
const NEED_ANSWER = "needAnswer";
const REMIND_DEAD = "remind-dead";
const ALIVE = "alive";
const PRISON = "prison"
const PRISON_ENDED = "prison-ended"
const PROGRESS_PRISON = "progress-prison"
const BIRTH = "birth";
const SHORT_CODE_EMIT = "sce";
const SHORT_CODE_CONFIRMED = "scc";
const SHORT_CODE_BROADCAST = "scbc";
const REFRESH_FORCE = "refresh-force";

if (typeof module !== 'undefined' && module.exports) {
    // Export the constants for use in other scripts if needed (for ES6 and later).
    module.exports = {
        OPEN:   OPEN,
        JUNE:   JUNE,
        DEBT:   DEBT,
        EVENT:  EVENT,
        MASTER: MASTER,
        BANK:   BANK,
        DEATH:  DEATH,

        CREATE_GAME:        CREATE_GAME,
        NEW_PLAYER:         NEW_PLAYER,
        COPY_PLAYER:        COPY_PLAYER,
        UPDATED_PLAYER:     UPDATED_PLAYER,
        UPDATE_GAME_OPTION: UPDATE_GAME_OPTION,
        DEAD:               DEAD,
        DEATH_IS_COMING:    DEATH_IS_COMING,
        REMIND_DEAD:        REMIND_DEAD,
        ALIVE:              ALIVE,
        NEED_ANSWER:        NEED_ANSWER,
        BIRTH:              BIRTH,

        NEW_CREDIT:           NEW_CREDIT,
        CREDITS_STARTED:      CREDITS_STARTED,
        RUNNING_CREDIT:       RUNNING_CREDIT,
        PAUSED_CREDIT:        PAUSED_CREDIT,
        PAYED_INTEREST:       PAYED_INTEREST,
        PAY_INTEREST:         PAY_INTEREST,
        TIMEOUT_CREDIT:       TIMEOUT_CREDIT,
        SETTLE_CREDIT:        SETTLE_CREDIT,
        REQUEST_CREDIT:       REQUEST_CREDIT,
        DEFAULT_CREDIT:       DEFAULT_CREDIT,
        PROGRESS_CREDIT:      PROGRESS_CREDIT,
        CREDIT_DONE:          CREDIT_DONE,
        PROGRESS_PRISON:      PROGRESS_PRISON,
        PRISON_ENDED:         PRISON_ENDED,
        PRISON:               PRISON,
        SEIZURE:              SEIZURE,
        SEIZED_DEAD:          SEIZED_DEAD,
        START_GAME:           START_GAME,
        END_GAME:             END_GAME,
        NEW_FEEDBACK:         NEW_FEEDBACK,
        START_ROUND:          START_ROUND,
        PLAYING:              PLAYING,
        TIMER_LEFT:           TIMER_LEFT,
        STOP_ROUND:           STOP_ROUND,
        INTER_ROUND:          INTER_ROUND,
        DISTRIB_DU:           DISTRIB_DU,
        INIT_DISTRIB:         INIT_DISTRIB,
        FIRST_DU:             FIRST_DU,
        RESET_GAME:           RESET_GAME,
        TRANSACTION:          TRANSACTION,
        TRANSACTION_DONE:     TRANSACTION_DONE,
        TRANSFORM_DISCARDS:   TRANSFORM_DISCARDS,
        TRANSFORM_NEWCARDS:   TRANSFORM_NEWCARDS,
        SHORT_CODE_CONFIRMED: SHORT_CODE_CONFIRMED,
        SHORT_CODE_EMIT:      SHORT_CODE_EMIT,
        SHORT_CODE_BROADCAST: SHORT_CODE_BROADCAST,
        REFRESH_FORCE:        REFRESH_FORCE,
    };
}

