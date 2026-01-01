export const C = {
    // GAME TYPE
    JUNE: 'june',
    DEBT: 'debt',

    //PLAYERS Master & Bank
    MASTER: 'master',
    BANK: 'bank',
    DEATH: 'death',

    //PLAYER STATUS
    ALIVE: 'alive',
    DEAD: 'dead',
    PRISON: 'prison',
    NEED_ANSWER: "needAnswer",
    REMIND_DEAD: "rd",

    //GAME STATUS
    OPEN: 'open',
    ENDED: 'ended',
    STARTED: 'started',
    PLAYING: 'playing',
    PAUSING: 'pausing',
    WAITING: 'waiting',
    STOPED: 'stoped',

    //GAME EVENTS & SOCKETS
    NEW_AVATAR: "na",
    UPDATED_AVATAR: "ua",
    DELETED_AVATAR: "da",
    SESSION_CREATED: "sc",
    NEW_GAMES_RULES: "ngr",
    GAME_STATE_CREATED: "gsc",
    PLAYER_JOIN: "pj",
    PLAYER_UPDATED: "pu",
    RULES_UPDATED: "ru",

    //CREDITS
    NEW_CREDIT: "new-credit",
    CREDITS_STARTED: "credits-started",
    SETTLE_CREDIT: "settle-credit",
    PROGRESS_CREDIT: "credit-progress",
    TIMEOUT_CREDIT: "timeout-credit",
    PAY_INTEREST: "pay-interest",
    PAYED_INTEREST: "payed-interest",
    SEIZED_DEAD: "seized-dead",
    SEIZURE: "seizure",
    DECOTE: "decote",
    FEES: "fees", //STATUS CREDIT
    PAUSED_CREDIT: "paused",
    RUNNING_CREDIT: "running",
    REQUEST_CREDIT: "requesting",
    DEFAULT_CREDIT: "default-credit",
    CREDIT_DONE: "credit-done",

    //PUR SOCKET EVENTS :
    EVENT: 'event',
    RESET: 'reset',
    TIMER_LEFT: 'tl',
    DISTRIB_DU: 'ddu',
    INIT_DISTRIB: 'id',
    FIRST_DU: 'fdu',
    NEW_FEEDBACK: 'nfb',
    TRANSACTION_DONE: 'td',
    TRANSACTION: 't',
    TRANSFORM_DISCARDS: "tD",
    TRANSFORM_NEWCARDS: "tNC",
    DEATH_IS_COMING: "dic",
    PRISON_ENDED: "pe",
    PROGRESS_PRISON: "pp",
    BIRTH: "birth",
    SHORT_CODE_EMIT: "sce",
    SHORT_CODE_CONFIRMED: "scc",
    SHORT_CODE_BROADCAST: "scbc",
    REFRESH_FORCE: "rf",
};

export default C;



