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
	timerSaveInterval = 10;
	timerDUInterval = 60;

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
	durationCredit = 0;
	timerPrison = 0;
	manualBank = false;
	seizureType = '';
	seizureCosts = 0;
	seizureDecote = 0;

	//actions
	startingTokens = 1;
	actions: ActionConfig[] = [
		{ key: 'whoHaveCard', labelKey: 'ACTION.WHO_HAVE_CARD.LABEL', descriptionKey: 'ACTION.WHO_HAVE_CARD.DESC', cost: 1, enabled: true },
		{ key: 'give', labelKey: 'ACTION.GIVE.LABEL', descriptionKey: 'ACTION.GIVE.DESC', cost: 2, enabled: true },
		{ key: 'steal', labelKey: 'ACTION.STEAL.LABEL', descriptionKey: 'ACTION.STEAL.DESC', cost: 2, enabled: true },
		{ key: 'silentSteal', labelKey: 'ACTION.SILENT_STEAL.LABEL', descriptionKey: 'ACTION.SILENT_STEAL.DESC', cost: 3, enabled: true },
		{ key: 'war', labelKey: 'ACTION.WAR.LABEL', descriptionKey: 'ACTION.WAR.DESC', cost: 6, enabled: true },
		{ key: 'ong', labelKey: 'ACTION.ONG.LABEL', descriptionKey: 'ACTION.ONG.DESC', cost: 6, enabled: true },
	];

	modifiedAt = new Date();
	createdAt: Date = new Date();
}

export class ActionConfig {
	key = '';
	labelKey = '';
	descriptionKey = '';
	cost = 0;
	enabled = true;
}
