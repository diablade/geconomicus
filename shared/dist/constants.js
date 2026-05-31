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
    STOPPED: 'stopped',
};
// ─── CREDIT STATUS ────────────────────────────────────────────────────────────
export const CREDIT_STATUS = {
    PAY_INTEREST: 'credit-pay-interest',
    SEIZURE: 'seizure',
    DECOTE: 'decote',
    FEES: 'fees',
    IDLE: 'idle',
    PAUSED: 'paused',
    RUNNING: 'running',
    REQUESTING: 'requesting',
    FAULT: 'fault',
    CANCELED: 'canceled',
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
        NEW_FEEDBACK: 'snf',
    },
    AVATAR: {
        NEW: 'an',
        UPDATED: 'au',
        DELETED: 'ad',
        SURVEY_REDO: 'asr',
    },
    GAME: {
        CREATED: 'gc',
        INIT: 'gi',
        DISTRIB_DU: 'gddu',
        FIRST_DU: 'gfd',
        STARTED: 'gsta',
        PAUSED: 'gpa',
        STOPPED: 'gsto',
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
        CONNECTED: 'pc',
        DISCONNECTED: 'pdc',
    },
    CREDIT: {
        NEW: 'cn',
        STARTED: 'cs',
        PROGRESS: 'cp',
        TIMEOUT: 'ct',
        FAULT: 'cf',
        DONE: 'cdone',
        CANCELED: 'ccan',
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
    SESSION_ENDED: 'session-ended',
    GAME_CREATED: 'game-created',
    GAME_INIT: 'game-init',
    GAME_STARTED: 'game-started',
    GAME_PAUSED: 'game-paused',
    GAME_ENDED: 'game-ended',
    DISTRIB_DU: 'distrib-du',
    FIRST_DU: 'first-du',
    TRANSACTION: 'transaction',
    PLAYER_BIRTH: 'player-birth',
    PLAYER_INIT: 'player-init',
    PLAYER_JOINED: 'player-joined',
    PLAYER_DIED: 'player-died',
    // Credit events
    CREDIT_NEW: 'credit-new',
    CREDIT_REQUEST: 'credit-request',
    CREDIT_SETTLE: 'credit-settle',
    CREDIT_FAULT: 'credit-fault',
    CREDIT_CANCELED: 'credit-canceled',
    CREDIT_PAYED_INTEREST: 'credit-payed-interest',
    CREDIT_SEIZED_DEAD: 'credit-seized-dead',
};
export const ROOMS = {
    session: (sessionId) => `s:${sessionId}`,
    lobbyMaster: (sessionId) => `s:${sessionId}:master`,
    lobbyAvatar: (sessionId, avatarIdx) => `s:${sessionId}:${avatarIdx}`,
    gameState: (gameStateId) => `gs:${gameStateId}`,
    gameStateMaster: (gameStateId) => `gs:${gameStateId}:master`,
    gameStateBank: (gameStateId) => `gs:${gameStateId}:bank`,
    gameStateEvents: (gameStateId) => `gs:${gameStateId}:events`,
    playerState: (gameStateId, avatarIdx, playerIdx) => `gs:${gameStateId}:${avatarIdx}:${playerIdx}`,
};
