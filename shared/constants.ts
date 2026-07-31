// ─── GAME TYPES ───────────────────────────────────────────────────────────────
export const GAME_TYPE = {
	JUNE: 'june',
	DEBT: 'debt',
} as const;
export type GameType = (typeof GAME_TYPE)[keyof typeof GAME_TYPE];

// ─── PLAYER TYPES ─────────────────────────────────────────────────────────────
export const PLAYER_TYPE = {
	MASTER: 'master',
	BANK: 'bank',
	TABLE: 'table',
	RESULTS: 'results',
	AVATAR: 'avatar',
} as const;
export type PlayerType = (typeof PLAYER_TYPE)[keyof typeof PLAYER_TYPE];

// ─── PLAYER STATUS ────────────────────────────────────────────────────────────
export const PLAYER_STATUS = {
	ALIVE: 'alive',
	DEAD: 'dead',
	PRISON: 'prison',
	REMIND_DEAD: 'remind-dead',
} as const;
export type PlayerStatus = (typeof PLAYER_STATUS)[keyof typeof PLAYER_STATUS];

// ─── SESSION STATUS ───────────────────────────────────────────────────────────
export const SESSION_STATUS = {
	OPEN: 'open',
	IN_PROGRESS: 'in_progress',
	PAUSED: 'paused',
	ENDED: 'ended',
} as const;
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

// ─── GAME STATUS ──────────────────────────────────────────────────────────────
export const GAME_STATUS = {
    NONE: 'none',
	CREATED: 'created',
	INITIALIZED: 'initialized',
	PLAYING: 'playing',
	PAUSED: 'paused',
	STOPPED: 'stopped',
} as const;
export type GameStatus = (typeof GAME_STATUS)[keyof typeof GAME_STATUS];

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
} as const;
export type CreditStatus = (typeof CREDIT_STATUS)[keyof typeof CREDIT_STATUS];

// ─── SEIZURE TYPE ───────────────────────────────────────────────────────────
export const SEIZURE_TYPE = {
    DECOTE: 'decote',
    FEES: 'fees',
} as const;
export type SeizureType = (typeof SEIZURE_TYPE)[keyof typeof SEIZURE_TYPE];

// ─── AUTO-BANK ────────────────────────────────────────────────────────────────
// Preset that selects the Rate Schedule when the `autoBank` toggle is on.
// See docs/adr/0003-auto-bank-rate-board.md
export const BANK_PROFILE = {
	NORMAL: 'normal',
	AGGRESSIVE: 'aggressive',
	CUSTOM: 'custom',
} as const;
export type BankProfile = (typeof BANK_PROFILE)[keyof typeof BANK_PROFILE];

// One step of the Rate Schedule: below `threshold` average money, credit is
// offered at `amount` for `interest` (rate = interest/amount). `allowDouble`
// enables the ×2 option on that tier (the 0% relief tier disables it).
export interface RateTier {
	threshold: number;
	amount: number;
	interest: number;
	allowDouble: boolean;
}

// Built-in Rate Schedules. Tiers are ordered by descending threshold; the
// deepest crossed tier wins. The last tier is a 0%, no-double relief loan that
// keeps the game alive when money nearly vanishes.
export const RATE_SCHEDULE_PRESETS: Record<'normal' | 'aggressive', RateTier[]> = {
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
} as const;
export type CreditOrigin = (typeof CREDIT_ORIGIN)[keyof typeof CREDIT_ORIGIN];

// A player's answer to the opening First Credit Question (stored as data).
export const CREDIT_QUESTION_ANSWER = {
	PENDING: 'pending',
	ACCEPT_SINGLE: 'accept-single',
	ACCEPT_DOUBLE: 'accept-double',
	DECLINE: 'decline',
	NO_ANSWER: 'no-answer', // round started before the player answered
} as const;
export type CreditQuestionAnswer = (typeof CREDIT_QUESTION_ANSWER)[keyof typeof CREDIT_QUESTION_ANSWER];

// ─── ASSIST SESSIONS ──────────────────────────────────────────────────────────
// How an animator's secondary connection ("play the user" / 2nd cockpit) relates
// to the device already holding a Seat. See docs/adr/0010-animator-assist-sessions.md
export const ASSIST_MODE = {
	COEXIST: 'coexist', // both devices act at once
	TAKEOVER: 'takeover', // player screen overlaid + Retake; animator drives
	KICK: 'kick', // hard-disconnect the player's device
} as const;
export type AssistMode = (typeof ASSIST_MODE)[keyof typeof ASSIST_MODE];

// Reason sent with the 'kicked' event so the displaced device shows the right message.
export const KICK_REASON = {
	ANOTHER_CONNECTION: 'another_connection', // ordinary single-session replacement
	KICKED_BY_ANIMATOR: 'kicked_by_animator', // animator chose Kick
	RETAKEN: 'retaken', // player reclaimed their Seat from a take-over
} as const;
export type KickReason = (typeof KICK_REASON)[keyof typeof KICK_REASON];

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
		QUESTION_ANSWERED: 'cqa',
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
} as const;

export type IoSession = (typeof IO.SESSION)[keyof typeof IO.SESSION];
export type IoAvatar = (typeof IO.AVATAR)[keyof typeof IO.AVATAR];
export type IoGame = (typeof IO.GAME)[keyof typeof IO.GAME];
export type IoPlayer = (typeof IO.PLAYER)[keyof typeof IO.PLAYER];
export type IoCredit = (typeof IO.CREDIT)[keyof typeof IO.CREDIT];
export type IoShortCode = (typeof IO.SHORT_CODE)[keyof typeof IO.SHORT_CODE];

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
	CREDIT_QUESTION_ASKED: 'credit-question-asked',
	CREDIT_QUESTION_ANSWERED: 'credit-question-answered',
	CREDIT_REFUSED: 'credit-refused',
	PRISON: 'prison',
	PRISON_ENDED: 'prison-ended',
	ACTION_GIVE: 'action-give',
	ACTION_STEAL: 'action-steal',
	ACTION_SILENT_STEAL: 'action-silent-steal',
	ACTION_ASSOCIATION: 'action-association',
	ACTION_WAR: 'action-war',
	ACTION_ONG: 'action-ong',
} as const;

export type DbEvent = (typeof DB_EVENTS)[keyof typeof DB_EVENTS];

export const ROOMS = {
	session: (sessionId: string) => `s:${sessionId}`,
	lobbyMaster: (sessionId: string) => `s:${sessionId}:master`,
	lobbyAvatar: (sessionId: string, avatarIdx: number) => `s:${sessionId}:a:${avatarIdx}`,
	gameState: (gameStateId: string) => `gs:${gameStateId}`,
	gameStateMaster: (gameStateId: string) => `gs:${gameStateId}:master`,
	gameStateTable: (gameStateId: string) => `gs:${gameStateId}:table`,
	gameStateEvents: (gameStateId: string) => `gs:${gameStateId}:events`,
	playerState: (gameStateId: string, playerIdx: number) => `gs:${gameStateId}:ps:${playerIdx}`,
};

export type Rooms = (typeof ROOMS)[keyof typeof ROOMS];
