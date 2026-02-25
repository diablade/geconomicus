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
	playerLifeId: string = '';
	status: string = '';
	extended: number = 0;
	createDate: Date = new Date();
	startDate: Date = new Date();
	endDate: Date = new Date();
}

export class PlayerLife {
	idx: number = 0;
	name: string = '';
	avatarId: string = '';
	idxLife: number = 0;
	status: string = '';
	coins: number = 0;
	cards: Card[] = [];
}

export class GameState {
	typeMoney: string = '';
	sessionId: string = '';
	ruleId: string = '';
	status: string = '';
	decks: Card[][] = [];
	playerLifeIndexSeq: number = 0;
	playersLifes: PlayerLife[] = [];
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
