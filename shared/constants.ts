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
} as const;

export type DbEvent = (typeof DB_EVENTS)[keyof typeof DB_EVENTS];

export const ROOMS = {
	session: (sessionId: string) => `s:${sessionId}`,
	lobbyMaster: (sessionId: string) => `s:${sessionId}:master`,
	lobbyAvatar: (sessionId: string, avatarIdx: number) => `s:${sessionId}:${avatarIdx}`,
	gameState: (gameStateId: string) => `gs:${gameStateId}`,
	gameStateMaster: (gameStateId: string) => `gs:${gameStateId}:master`,
	gameStateBank: (gameStateId: string) => `gs:${gameStateId}:bank`,
	gameStateEvents: (gameStateId: string) => `gs:${gameStateId}:events`,
	playerState: (gameStateId: string, avatarIdx: number, playerIdx: number) =>
		`gs:${gameStateId}:${avatarIdx}:${playerIdx}`,
};

export type Rooms = (typeof ROOMS)[keyof typeof ROOMS];
