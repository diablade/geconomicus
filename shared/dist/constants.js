// ─── GAME TYPES ───────────────────────────────────────────────────────────────
export const GAME_TYPE = {
    JUNE: 'june',
    DEBT: 'debt',
};
// ─── PLAYER TYPES ─────────────────────────────────────────────────────────────
export const PLAYER_TYPE = {
    MASTER: 'master',
    BANK: 'bank',
    RESULTS: 'results',
    AVATAR: 'avatar',
};
// ─── PLAYER STATUS ────────────────────────────────────────────────────────────
export const PLAYER_STATUS = {
    ALIVE: 'alive',
    DEAD: 'dead',
    PRISON: 'prison',
    REMIND_DEAD: 'remind-dead',
};
// ─── SESSION STATUS ───────────────────────────────────────────────────────────
export const SESSION_STATUS = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    PAUSED: 'paused',
    ENDED: 'ended',
};
// ─── GAME STATUS ──────────────────────────────────────────────────────────────
export const GAME_STATUS = {
    NONE: 'none',
    CREATED: 'created',
    INITIALIZED: 'initialized',
    PLAYING: 'playing',
    PAUSED: 'paused',
    WAITING: 'waiting',
    FINISHED: 'finished',
    STOPPED: 'stopped',
    EVENT: 'event',
};
// ─── CREDIT STATUS ────────────────────────────────────────────────────────────
export const CREDIT_STATUS = {
    PAY_INTEREST: 'credit-pay-interest',
    SEIZURE: 'seizure',
    DECOTE: 'decote',
    FEES: 'fees',
    PAUSED: 'paused',
    RUNNING: 'running',
    REQUESTING: 'requesting',
    DEFAULT: 'default-credit',
    DONE: 'credit-done',
};
// ─── SOCKET EVENTS (short for bandwidth optimization) ─────────────────────────
export const IO = {
    SESSION: {
        STARTED: 'ss',
        UPDATED: 'su',
        NEW_RULES: 'snr',
        UPDATED_RULES: 'sur',
        DELETED_RULES: 'sdr',
        GAME_STATE_CREATED: 'sgsc',
    },
    AVATAR: {
        NEW: 'an',
        UPDATED: 'au',
        DELETED: 'ad',
    },
    GAME: {
        CREATED: 'gc',
        INIT: 'gi',
        DISTRIB_DU: 'gddu',
        FIRST_DU: 'gfd',
        STARTED: 'gsta',
        PAUSED: 'gpa',
        STOPPED: 'gsto',
        FINISHED: 'gsf',
        RESET: 'reset',
        DEATH_IS_COMING: 'dic',
        DELETED: 'gdel',
    },
    PLAYER: {
        INIT: 'pi',
        JOINED: 'pj',
        DIED: 'pd',
        FEEDBACK: 'pf',
        PROD_DISCARDS: 'ppd',
        PROD_DRAW_CARDS: 'ppdc',
        PRISON_ENDED: 'ppe',
        PROGRESS_PRISON: 'ppp',
        TRANSACTION_DONE: 'td',
    },
    CREDIT: {
        NEW: 'cn',
        STARTED: 'cs',
        PROGRESS: 'cp',
        TIMEOUT: 'ct',
        DEFAULT: 'cd',
        DONE: 'cdone',
        SEIZURE: 'csq',
        PAYED_INTEREST: 'cpi',
    },
    SHORT_CODE: {
        EMIT: 'sce',
        CONFIRMED: 'scc',
        BROADCAST: 'scb',
    },
    TIMER_LEFT: 'tl',
    TRANSACTION_DONE: 'td',
    REFRESH_FORCE: 'rf',
    INFO: 'i',
    EVENT: 'ev',
};
// ─── DATABASE EVENTS (human-readable for debugging) ───────────────────────────
export const DB_EVENTS = {
    SESSION_STARTED: 'session-started',
    GAME_CREATED: 'game-created',
    GAME_INIT: 'game-init',
    PLAYER_INIT: 'player-init',
    GAME_STARTED: 'game-started',
    GAME_PAUSED: 'game-paused',
    GAME_ENDED: 'game-ended',
    PLAYER_JOINED: 'player-joined',
    DISTRIB_DU: 'distrib-du',
    FIRST_DU: 'first-du',
    TRANSACTION: 'trans',
    BIRTH: 'birth',
    // Credit events
    CREDIT_NEW: 'credit-new',
    CREDIT_SETTLE: 'credit-settle',
    CREDIT_PAYED_INTEREST: 'credit-payed-interest',
    CREDIT_SEIZED_DEAD: 'credit-seized-dead',
};
