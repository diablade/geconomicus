// (ES5 compatible)

// GAME TYPE
const JUNE = 'june';
const DEBT = 'debt';

const EVENT = 'event';

//PLAYERS Master & Bank
const MASTER = 'master';
const BANK = 'bank';
const DEATH = 'death';

//PLAYER STATUS
const ALIVE = 'alive';
const DEAD = 'dead';
const PRISON = 'prison';
const NEED_ANSWER = "needAnswer";
const REMIND_DEAD = "rd";

//GAME STATUS
const OPEN = 'open';
const ENDED = 'ended';
const STARTED = 'started';
const PLAYING = 'playing';
const PAUSING = 'pausing';
const WAITING = 'waiting';
const STOPED = 'stoped';

//GAME EVENTS & SOCKETS
const SESSION_CREATED = "sc";
const GAME_STATE_CREATED = "gsc";
const PLAYER_JOIN = "pj";
const PLAYER_UPDATED = "pu";
const RULES_UPDATED = "ru";

//CREDITS
const NEW_CREDIT = "new-credit";
const CREDITS_STARTED = "credits-started";
const SETTLE_CREDIT = "settle-credit";
const PROGRESS_CREDIT = "credit-progress";
const TIMEOUT_CREDIT = "timeout-credit";
const PAY_INTEREST = "pay-interest";
const PAYED_INTEREST = "payed-interest";
const SEIZED_DEAD = "seized-dead";
const SEIZURE = "seizure";
const DECOTE = "decote";
const FEES = "fees";
//STATUS CREDIT
const PAUSED_CREDIT = "paused";
const RUNNING_CREDIT = "running";
const REQUEST_CREDIT = "requesting";
const DEFAULT_CREDIT = "default-credit";
const CREDIT_DONE = "credit-done";

//PUR SOCKET EVENTS :
const RESET = 'reset';
const TIMER_LEFT = 'tl';
const DISTRIB_DU = 'ddu';
const INIT_DISTRIB = 'id';
const FIRST_DU = 'fdu';
const NEW_FEEDBACK = 'nfb';
const TRANSACTION_DONE = 'td';
const TRANSACTION = 't';
const TRANSFORM_DISCARDS = "tD";
const TRANSFORM_NEWCARDS = "tNC";
const DEATH_IS_COMING = "dic";
const PRISON_ENDED = "pe";
const PROGRESS_PRISON = "pp";
const BIRTH = "birth";
const SHORT_CODE_EMIT = "sce";
const SHORT_CODE_CONFIRMED = "scc";
const SHORT_CODE_BROADCAST = "scbc";
const REFRESH_FORCE = "rf";

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

        // CREATE_GAME: this.CREATE_GAME, // NEW_PLAYER: NEW_PLAYER,
        // UPDATED_PLAYER: UPDATED_PLAYER,
        // UPDATE_GAME_OPTION: UPDATE_GAME_OPTION,
        DEAD:            DEAD,
        DEATH_IS_COMING: DEATH_IS_COMING,
        REMIND_DEAD:     REMIND_DEAD,
        ALIVE:           ALIVE,
        NEED_ANSWER:     NEED_ANSWER,
        BIRTH:           BIRTH,

        // START_GAME: START_GAME,
        STARTED: STARTED,
        PLAYING: PLAYING,
        PAUSING: PAUSING,
        ENDED:   ENDED,

        NEW_CREDIT:      NEW_CREDIT,
        CREDITS_STARTED: CREDITS_STARTED,
        RUNNING_CREDIT:  RUNNING_CREDIT,
        PAUSED_CREDIT:   PAUSED_CREDIT,
        PAYED_INTEREST:  PAYED_INTEREST,
        PAY_INTEREST:    PAY_INTEREST,
        TIMEOUT_CREDIT:  TIMEOUT_CREDIT,
        SETTLE_CREDIT:   SETTLE_CREDIT,
        REQUEST_CREDIT:  REQUEST_CREDIT,
        DEFAULT_CREDIT:  DEFAULT_CREDIT,
        PROGRESS_CREDIT: PROGRESS_CREDIT,
        CREDIT_DONE:     CREDIT_DONE,
        PROGRESS_PRISON: PROGRESS_PRISON,
        PRISON_ENDED:    PRISON_ENDED,
        PRISON:          PRISON,
        SEIZURE:         SEIZURE,
        DECOTE:          DECOTE,
        FEES:            FEES,
        SEIZED_DEAD:     SEIZED_DEAD,

        DISTRIB_DU:           DISTRIB_DU,
        FIRST_DU:             FIRST_DU,
        NEW_FEEDBACK:         NEW_FEEDBACK,
        TIMER_LEFT:           TIMER_LEFT,
        INIT_DISTRIB:         INIT_DISTRIB, // RESET_GAME:           RESET_GAME,
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

