// ─── GAME TYPES ───────────────────────────────────────────────────────────────
export const GAME_TYPE = {
    JUNE: 'june',
    DEBT: 'debt',
};
// ─── PLAYER TYPES ─────────────────────────────────────────────────────────────
export const PLAYER_TYPE = {
    MASTER: 'master',
    BANK: 'bank',
    TABLE: 'table',
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
// ─── AUTO-BANK ────────────────────────────────────────────────────────────────
// Preset that selects the Rate Schedule when the `autoBank` toggle is on.
// See docs/adr/0003-auto-bank-rate-board.md
export const BANK_PROFILE = {
    NORMAL: 'normal',
    AGGRESSIVE: 'aggressive',
    CUSTOM: 'custom',
};
// Built-in Rate Schedules. Tiers are ordered by descending threshold; the
// deepest crossed tier wins. The last tier is a 0%, no-double relief loan that
// keeps the game alive when money nearly vanishes.
export const RATE_SCHEDULE_PRESETS = {
    normal: [
        { threshold: 1.5, amount: 4, interest: 1, allowDouble: true },
        { threshold: 1.4, amount: 5, interest: 1, allowDouble: true },
        { threshold: 1.0, amount: 6, interest: 1, allowDouble: true },
        { threshold: 0.4, amount: 3, interest: 0, allowDouble: false },
    ],
    aggressive: [
        { threshold: 1.0, amount: 4, interest: 1, allowDouble: true },
        { threshold: 0.7, amount: 5, interest: 1, allowDouble: true },
        { threshold: 0.5, amount: 6, interest: 1, allowDouble: true },
        { threshold: 0.3, amount: 3, interest: 0, allowDouble: false },
    ],
};
// How a credit came to exist — tags every created credit for the per-game panel.
export const CREDIT_ORIGIN = {
    ANIMATOR: 'animator', // manual contract dialog
    FIRST_QUESTION: 'first-question', // opening First Credit Question
    PLAYER_REQUEST: 'player-request', // self-service Credit Request
};
// A player's answer to the opening First Credit Question (stored as data).
export const CREDIT_QUESTION_ANSWER = {
    ACCEPT_SINGLE: 'accept-single',
    ACCEPT_DOUBLE: 'accept-double',
    DECLINE: 'decline',
    NO_ANSWER: 'no-answer', // round started before the player answered
};
// ─── ASSIST SESSIONS ──────────────────────────────────────────────────────────
// How an animator's secondary connection ("play the user" / 2nd cockpit) relates
// to the device already holding a Seat. See docs/adr/0002-animator-assist-sessions.md
export const ASSIST_MODE = {
    COEXIST: 'coexist', // both devices act at once
    TAKEOVER: 'takeover', // player screen overlaid + Retake; animator drives
    KICK: 'kick', // hard-disconnect the player's device
};
// Reason sent with the 'kicked' event so the displaced device shows the right message.
export const KICK_REASON = {
    ANOTHER_CONNECTION: 'another_connection', // ordinary single-session replacement
    KICKED_BY_ANIMATOR: 'kicked_by_animator', // animator chose Kick
    RETAKEN: 'retaken', // player reclaimed their Seat from a take-over
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
        CURRENT_DU: 'gcdu',
        FIRST_DU: 'gfd',
        STARTED: 'gsta',
        PAUSED: 'gpa',
        RESUMED: 'gres',
        STOPPED: 'gsto',
        RESET: 'reset',
        DEATH_IS_COMING: 'dic',
        DELETED: 'gdel',
        RECOVERY: 'grec',
    },
    PLAYER: {
        INIT: 'pi',
        JOINED: 'pj',
        DIED: 'pd',
        REINCARNATED: 'preinc',
        FEEDBACK: 'pf',
        PROD_DISCARDS: 'ppd',
        PROD_DRAW_CARDS: 'ppdc',
        PRISON_ENDED: 'ppe',
        PROGRESS_PRISON: 'ppp',
        TRANSACTION_DONE: 'td',
        DISTRIB_DU: 'du',
        CONNECTED: 'pc',
        DISCONNECTED: 'pdc',
        CONNECTIONS_SNAPSHOT: 'pcs',
        ACTION_DONE: 'pad',
        ACTION_ROBBED: 'par',
        ACTION_TOKENS_UPDATED: 'patu',
        STATE_SYNC: 'pss', // absolute LK rows of the affected players → table room (ADR-0008)
        TAKEN_OVER: 'pto', // server → player device: an animator is driving; show overlay
        RETAKE: 'prt', // player device → server: reclaim my Seat from the animator
    },
    CREDIT: {
        NEW: 'cn',
        FREE_MONEY: 'cfm',
        STARTED: 'cs',
        PROGRESS: 'cp',
        FAULT: 'cf',
        DONE: 'cdone',
        CANCELED: 'ccan',
        REQUEST: 'creq',
        SEIZURE: 'csq',
        EXTENDED: 'cext',
        RATE: 'crate', // auto-bank effective rate changed (broadcast to players)
        REFUSED: 'cref', // a player's Credit Request was refused (insolvent)
        QUESTION: 'cq', // opening First Credit Question prompt / answer round-trip
    },
    SHORT_CODE: {
        EMIT: 'sce',
        CONFIRMED: 'scc',
        BROADCAST: 'scb',
    },
    TIMER_LEFT: 'tl',
    TRANSACTION_DONE: 'td',
    DECKS_STATE_SYNC: 'dss', // absolute LK card arrays of the changed deck levels → table room (ADR-0008)
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
    GAME_RESUMED: 'game-resumed',
    GAME_ENDED: 'game-ended',
    DISTRIB_DU: 'distrib-du',
    FIRST_DU: 'first-du',
    TRANSACTION: 'transaction',
    PLAYER_BIRTH: 'player-birth',
    PLAYER_INIT: 'player-init',
    PLAYER_JOINED: 'player-joined',
    PLAYER_DIED: 'player-died',
    PRODUCTION: 'production',
    // Credit events
    FREE_MONEY: 'free-money',
    CREDIT_NEW: 'credit-new',
    CREDIT_REQUEST: 'credit-request',
    CREDIT_EXTENDED: 'credit-extended',
    CREDIT_SETTLED: 'credit-settled',
    CREDIT_FAULT: 'credit-fault',
    CREDIT_CANCELED: 'credit-canceled',
    CREDIT_SEIZURE: 'credit-seizure',
    CREDIT_SEIZED_DEAD: 'credit-seized-dead',
    CREDIT_QUESTION_ANSWERED: 'credit-question-answered',
    CREDIT_REFUSED: 'credit-refused',
    PRISON: 'prison',
    PRISON_ENDED: 'prison-ended',
    ACTION_GIVE: 'action-give',
    ACTION_STEAL: 'action-steal',
    ACTION_SILENT_STEAL: 'action-silent-steal',
    ACTION_WAR: 'action-war',
    ACTION_ONG: 'action-ong',
};
export const ROOMS = {
    session: (sessionId) => `s:${sessionId}`,
    lobbyMaster: (sessionId) => `s:${sessionId}:master`,
    lobbyAvatar: (sessionId, avatarIdx) => `s:${sessionId}:a:${avatarIdx}`,
    gameState: (gameStateId) => `gs:${gameStateId}`,
    gameStateMaster: (gameStateId) => `gs:${gameStateId}:master`,
    gameStateTable: (gameStateId) => `gs:${gameStateId}:table`,
    gameStateEvents: (gameStateId) => `gs:${gameStateId}:events`,
    playerState: (gameStateId, playerIdx) => `gs:${gameStateId}:ps:${playerIdx}`,
};
