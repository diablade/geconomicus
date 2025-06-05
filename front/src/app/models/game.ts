export class Card {
	_id = "";
	color = "";
	weight = 0;
	price = 0;
	letter = "";

	displayed = true;
	count = 1;
}

export class Credit {
	_id = "";
	idPlayer = "";
	idGame = "";
	amount = 0;
	interest = 0;
	extended = 0;
	status = "created"
	// created,paused,running,requesting,settled
	progress = 0;
	// @ts-ignore
	createDate: Date = undefined;
	// @ts-ignore
	startDate: Date = undefined;
	// @ts-ignore
	endDate: Date = undefined;
}

export class Feedback {
	depressedHappy = 0;
	individualCollective = 0;
	insatisfiedAccomplished = 0;
	greedyGenerous = 0;
	competitiveCooperative = 0;
	anxiousConfident = 0;
	agressiveAvenant = 0;
	irritableTolerant = 0;
	dependantAutonomous = 0;
}

export class EventGeco {
	typeEvent = "";
	emitter = "";
	receiver = "";
	amount = 0;
	resources: any[] = [];
	// @ts-ignore
	date: Date = Date.now();
}

export class Player {
	name = "";
	_id = "";
	idx = 0;
	image = "";
	coins = 0;
	cards: Card[] = [];
	survey: Feedback | undefined;
	eyes = 3;
	earrings = 0;
	eyebrows = 0;
	features = 0;
	hair = 3;
	glasses = 0;
	mouth = 14;
	earringsProbability = 100;
	glassesProbability = 100;
	featuresProbability = 100;
	skinColor = "#ECAD80";
	hairColor = "#3EAC2C";
	boardConf = "wood";
	boardColor = "";
	status = "alive";
	progressPrison = 0;
	reincarnateFromId: string | undefined;
}

export class Game {
	_id = "";
	status = "";
	name = "";
	animator = "";
	location = "";
	shortId = "";
	typeMoney = "june";
	players: Player[] = [];
	decks: Card[][] = [[]];
	events: EventGeco[] = [];

	//option general
	devMode = false;
	priceWeight1 = 1;
	priceWeight2 = 2;
	priceWeight3 = 4;
	priceWeight4 = 8;
	currentMassMonetary = 0;
	amountCardsForProd = 4;
	distribInitCards = 4;
	generateLettersInDeck = 0;
	generateLettersAuto = true;
	generatedIdenticalCards = 4;
	surveyEnabled = true;
	round = 0;
	roundMax = 1;
	roundMinutes = 20;
	autoDeath = true;
	deathPassTimer = 4;

	//option june
	currentDU = 0;
	inequalityStart = false;
	tauxCroissance = 5;
	startAmountCoins = 5;
	pctPoor = 10;
	pctRich = 10;

	//option debt
	credits: Credit[] = [];
	bankInterestEarned = 0;
	bankGoodsEarned = 0;
	bankMoneyLost = 0;
	defaultCreditAmount = 3;
	defaultInterestAmount = 1;
	timerCredit = 5;
	timerPrison = 5;
	manualBank = true;
	seizureType = "decote";
	seizureCosts = 2;
	seizureDecote = 33;

	// @ts-ignore
	modified: Date = Date.now();
	// @ts-ignore
	created: Date = Date.now();
}
