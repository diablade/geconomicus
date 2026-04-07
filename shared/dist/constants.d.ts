export declare const GAME_TYPE: {
    readonly JUNE: "june";
    readonly DEBT: "debt";
};
export type GameType = typeof GAME_TYPE[keyof typeof GAME_TYPE];
export declare const PLAYER_TYPE: {
    readonly MASTER: "master";
    readonly BANK: "bank";
    readonly AVATAR: "avatar";
};
export type PlayerType = typeof PLAYER_TYPE[keyof typeof PLAYER_TYPE];
export declare const PLAYER_STATUS: {
    readonly ALIVE: "alive";
    readonly DEAD: "dead";
    readonly PRISON: "prison";
    readonly REMIND_DEAD: "remind-dead";
};
export type PlayerStatus = typeof PLAYER_STATUS[keyof typeof PLAYER_STATUS];
export declare const SESSION_STATUS: {
    readonly OPEN: "open";
    readonly IN_PROGRESS: "in_progress";
    readonly PAUSED: "paused";
    readonly ENDED: "ended";
};
export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS];
export declare const GAME_STATUS: {
    readonly NONE: "none";
    readonly CREATED: "created";
    readonly STARTED: "started";
    readonly PLAYING: "playing";
    readonly PAUSED: "paused";
    readonly WAITING: "waiting";
    readonly FINISHED: "finished";
    readonly STOPPED: "stopped";
    readonly EVENT: "event";
};
export type GameStatus = typeof GAME_STATUS[keyof typeof GAME_STATUS];
export declare const CREDIT_STATUS: {
    readonly PAY_INTEREST: "credit-pay-interest";
    readonly SEIZURE: "seizure";
    readonly DECOTE: "decote";
    readonly FEES: "fees";
    readonly PAUSED: "paused";
    readonly RUNNING: "running";
    readonly REQUESTING: "requesting";
    readonly DEFAULT: "default-credit";
    readonly DONE: "credit-done";
};
export type CreditStatus = typeof CREDIT_STATUS[keyof typeof CREDIT_STATUS];
export declare const IO: {
    readonly SESSION: {
        readonly STARTED: "ss";
        readonly UPDATED: "su";
        readonly NEW_RULES: "snr";
        readonly UPDATED_RULES: "sur";
        readonly DELETED_RULES: "sdr";
        readonly GAME_STATE_CREATED: "sgsc";
    };
    readonly AVATAR: {
        readonly NEW: "an";
        readonly UPDATED: "au";
        readonly DELETED: "ad";
    };
    readonly GAME: {
        readonly CREATED: "gc";
        readonly SETUP: "gs";
        readonly DISTRIB: "gd";
        readonly DISTRIB_DU: "gddu";
        readonly FIRST_DU: "gfd";
        readonly STARTED: "gsta";
        readonly PAUSED: "gpa";
        readonly STOPPED: "gsto";
        readonly FINISHED: "gsf";
        readonly RESET: "reset";
        readonly DEATH_IS_COMING: "dic";
        readonly KILLED: "gk";
    };
    readonly PLAYER: {
        readonly JOINED: "pj";
        readonly DIED: "pd";
        readonly FEEDBACK: "pf";
        readonly PROD_DISCARDS: "ppd";
        readonly PROD_DRAW_CARDS: "ppdc";
        readonly PRISON_ENDED: "ppe";
        readonly PROGRESS_PRISON: "ppp";
    };
    readonly CREDIT: {
        readonly NEW: "cn";
        readonly STARTED: "cs";
        readonly PROGRESS: "cp";
        readonly TIMEOUT: "ct";
        readonly DEFAULT: "cd";
        readonly DONE: "cdone";
        readonly SEIZURE: "csq";
        readonly PAYED_INTEREST: "cpi";
    };
    readonly SHORT_CODE: {
        readonly EMIT: "sce";
        readonly CONFIRMED: "scc";
        readonly BROADCAST: "scb";
    };
    readonly TIMER_LEFT: "tl";
    readonly TRANSACTION_DONE: "td";
    readonly REFRESH_FORCE: "rf";
};
export type IoSession = typeof IO.SESSION[keyof typeof IO.SESSION];
export type IoAvatar = typeof IO.AVATAR[keyof typeof IO.AVATAR];
export type IoGame = typeof IO.GAME[keyof typeof IO.GAME];
export type IoPlayer = typeof IO.PLAYER[keyof typeof IO.PLAYER];
export type IoCredit = typeof IO.CREDIT[keyof typeof IO.CREDIT];
export type IoShortCode = typeof IO.SHORT_CODE[keyof typeof IO.SHORT_CODE];
export declare const DB_EVENTS: {
    readonly SESSION_STARTED: "session-started";
    readonly GAME_CREATED: "game-created";
    readonly GAME_STARTED: "game-started";
    readonly GAME_PAUSED: "game-paused";
    readonly GAME_ENDED: "game-ended";
    readonly PLAYER_JOINED: "player-joined";
    readonly DISTRIB_INIT: "distrib-init";
    readonly DISTRIB_DU: "distrib-du";
    readonly FIRST_DU: "first-du";
    readonly TRANSACTION: "trans";
    readonly BIRTH: "birth";
    readonly CREDIT_NEW: "credit-new";
    readonly CREDIT_SETTLE: "credit-settle";
    readonly CREDIT_PAYED_INTEREST: "credit-payed-interest";
    readonly CREDIT_SEIZED_DEAD: "credit-seized-dead";
};
export type DbEvent = typeof DB_EVENTS[keyof typeof DB_EVENTS];
