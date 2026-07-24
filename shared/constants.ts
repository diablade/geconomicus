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

// ─── ASSIST SESSIONS ──────────────────────────────────────────────────────────
// How an animator's secondary connection ("play the user" / 2nd cockpit) relates
// to the device already holding a Seat. See docs/adr/0002-animator-assist-sessions.md
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
	PRISON: 'prison',
	PRISON_ENDED: 'prison-ended',
	ACTION_GIVE: 'action-give',
	ACTION_STEAL: 'action-steal',
	ACTION_SILENT_STEAL: 'action-silent-steal',
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
	gameStateBank: (gameStateId: string) => `gs:${gameStateId}:bank`,
	gameStateEvents: (gameStateId: string) => `gs:${gameStateId}:events`,
	playerState: (gameStateId: string, playerIdx: number) => `gs:${gameStateId}:ps:${playerIdx}`,
};

export type Rooms = (typeof ROOMS)[keyof typeof ROOMS];
