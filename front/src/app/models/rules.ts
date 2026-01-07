export class Rules {
	id: string = "";
	gameStateId: string = "";

	//common
	amountCardsForProd: number = 0;
	generatedIdenticalLetters: number = 0;
	generateLettersAuto: boolean = false;
	generateLettersInDeck: number = 0;
	distribInitCards: number = 0;
	surveyEnabled: boolean = false;
	roundMax: number = 0;
	roundMinutes: number = 0;
	autoDeath: boolean = false;
	deathPassTimer: number = 0;

	//not commun
	typeMoney: string = "";
	priceWeight1: number = 0;
	priceWeight2: number = 0;
	priceWeight3: number = 0;
	priceWeight4: number = 0;

	//option june
	inequalityStart: boolean = false;
	tauxCroissance: number = 0;
	startAmountCoins: number = 0;
	pctPoor: number = 0;
	pctRich: number = 0;

	//option debt
	defaultCreditAmount: number = 0;
	defaultInterestAmount: number = 0;
	timerCredit: number = 0;
	timerPrison: number = 0;
	manualBank: boolean = false;
	seizureType: string = "";
	seizureCosts: number = 0;
	seizureDecote: number = 0;
	modifiedAt: Date = new Date();
	createdAt: Date = new Date();
}
