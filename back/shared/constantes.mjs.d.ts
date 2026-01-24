// constantes.mjs.
declare const C: {
	// GAME TYPE
	JUNE: string,
	DEBT: string,

	//PLAYERS Master & Bank
	MASTER: string,
	BANK: string,
	DEATH: string,

	//PLAYER STATUS
	ALIVE: string,
	DEAD: string,
	PRISON: string,
	NEED_ANSWER: string,
	REMIND_DEAD: string,

	//GAME & session STATUS
	OPEN: string,
	UPDATED_SESSION: string;
	IN_PROGRESS: string,
	ENDED: string,
	END_GAME: string,
	STARTED: string,
	PLAYING: string,
	PAUSING: string,
	WAITING: string,
	STOPED: string,

	//GAME EVENTS & SOCKETS
	NEW_AVATAR: string,
	UPDATED_AVATAR: string,
	DELETED_AVATAR: string,
	SESSION_CREATED: string,
	NEW_GAMES_RULES: string,
	GAME_STATE_CREATED: string,
	PLAYER_JOIN: string,
	UPDATED_RULES: string,
	DELETED_RULES: string,

	//CREDITS
	NEW_CREDIT: string,
	CREDITS_STARTED: string,
	SETTLE_CREDIT: string,
	PROGRESS_CREDIT: string,
	TIMEOUT_CREDIT: string,
	PAY_INTEREST: string,
	PAYED_INTEREST: string,
	SEIZED_DEAD: string,
	SEIZURE: string,
	DECOTE: string,
	FEES: string, //STATUS CREDIT
	PAUSED_CREDIT: string,
	RUNNING_CREDIT: string,
	REQUEST_CREDIT: string,
	DEFAULT_CREDIT: string,
	CREDIT_DONE: string,

	//PUR SOCKET EVENTS :
	EVENT: string,
	RESET: string,
	TIMER_LEFT: string,
	DISTRIB_DU: string,
	INIT_DISTRIB: string,
	FIRST_DU: string,
	NEW_FEEDBACK: string,
	TRANSACTION_DONE: string,
	TRANSACTION: string,
	TRANSFORM_DISCARDS: string,
	TRANSFORM_NEWCARDS: string,
	DEATH_IS_COMING: string,
	PRISON_ENDED: string,
	PROGRESS_PRISON: string,
	BIRTH: string,
	SHORT_CODE_EMIT: string,
	SHORT_CODE_CONFIRMED: string,
	SHORT_CODE_BROADCAST: string,
	REFRESH_FORCE: string,
};

export default C;



