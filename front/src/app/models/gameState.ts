export class Card {
	key: string = '';
	letter: string = '';
	color: string = '';
	weight: number = 0;
	price: number = 0;

	displayed = true;
	count = 1;
}

export class Credit {
	idx: number = 0;
	amount: number = 0;
	interest: number = 0;
	playerStateIdx: number = 0;
	status: string = '';
	extended: number = 0;
	progress: number = 0;
	createDate: Date = new Date();
	startDate: Date = new Date();
	endDate: Date = new Date();
}

export class PlayerState {
	idx: number = 0;
	name: string = '';
	avatarIdx: number = 0;
	status: string = '';
	coins: number = 0;
	cards: Card[] = [];
	progressPrison: number = 0;
}

export class GameState {
	typeMoney: string = '';
	sessionId: string = '';
	ruleIdx: number = 0;
	status: string = '';
	decks: Card[][] = [];
	playerStateIndexSeq: number = 0;
	playersStates: PlayerState[] = [];
	currentMassMonetary: number = 0;

	//state june
	currentDU: number = 0;
	//state debt
	creditIndexSeq: number = 0;
	credits: Credit[] = [];
	bankInterestEarned: number = 0;
	bankGoodsEarned: number = 0;
	bankMoneyLost: number = 0;

	modifiedAt: Date = new Date();
	createdAt: Date = new Date();
}
