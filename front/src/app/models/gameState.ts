import { PlayerStatus } from '@geco/shared';

export class Card {
	key = '';
	letter = '';
	color = '';
	weight = 0;
	price = 0;

	displayed = true;
	count = 1;
}

export class Credit {
	id = '';
	amount = 0;
	interest = 0;
	playerStateIdx = 0;
	status = '';
	extended = 0;
	progress = 0;
	createdAt = new Date();
	startedAt = new Date();
	remainingTime = 0;
	endAt = new Date();
}

export class PlayerState {
	idx = 0;
	name = '';
	avatarIdx = 0;
	status: PlayerStatus | null = null;
	coins = 0;
	cards = [];
	progressPrison = 0;
}

export class ConnectionStatus {
	idx = 0;
	isConnected = false;
	lastSeen: Date | null = null;
}

export class DeathState {
	intervalDeath = 0;
	intervalDeathLeft = 0;
	deathQueue = [];
}

export class GameState {
	typeMoney = '';
	sessionId = '';
	ruleIdx = 0;
	status = '';
	decks: Card[][] = [];
	playerStateIndexSeq = 0;
	playersStates: PlayerState[] = [];
	currentMassMonetary = 0;

	timerLeft = 0;
	deathState = new DeathState();

	//state june
	currentDU = 0;
	//state debt
	creditIndexSeq = 0;
	credits = [];
	bankInterestEarned = 0;
	bankGoodsEarned = 0;
	bankMoneyLost = 0;

	modifiedAt = new Date();
	createdAt = new Date();
}
