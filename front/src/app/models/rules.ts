export class Rules {
	idx = 0;
	gameStateId = '';
	gameStatus = 'none';
	rotate = false;
	typeMoney = 'june';

	//common
	amountCardsForProd = 0;
	generatedIdenticalLetters = 0;
	generateLettersAuto = false;
	generateLettersInDeck = 0;
	distribInitCards = 0;
	surveyEnabled = false;
	roundMax = 0;
	roundMinutes = 0;
	autoDeath = false;
	deathPassTimer = 0;

	//not commun
	priceWeight1 = 0;
	priceWeight2 = 0;
	priceWeight3 = 0;
	priceWeight4 = 0;

	//option june
	inequalityStart = false;
	tauxCroissance = 0;
	startAmountCoins = 0;
	pctPoor = 0;
	pctRich = 0;

	//option debt
	defaultCreditAmount = 0;
	defaultInterestAmount = 0;
	timerCredit = 0;
	timerPrison = 0;
	manualBank = false;
	seizureType = '';
	seizureCosts = 0;
	seizureDecote = 0;
	modifiedAt = new Date();
	createdAt: Date = new Date();
}
