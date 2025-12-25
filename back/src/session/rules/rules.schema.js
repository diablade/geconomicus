import mongoose from 'mongoose';
import * as C from '../../../../config/constantes.js';

const Schema = mongoose.Schema;

let RulesSchema = new Schema({
	ruleId: { type: String, required: true },
	gameStateId: { type: String, required: false },

	//common
	amountCardsForProd: { type: Number, required: true, default: 4 },
	generatedIdenticalLetters: { type: Number, required: true, default: 5 },
	generateLettersAuto: { type: Boolean, required: true, default: true },
	generateLettersInDeck: { type: Number, required: false },
	distribInitCards: { type: Number, required: true, default: 4 },
	surveyEnabled: { type: Boolean, required: true, default: true },
	roundMax: { type: Number, required: true, default: 1 },
	roundMinutes: { type: Number, required: true, default: 20 },
	autoDeath: { type: Boolean, required: true, default: true },
	deathPassTimer: { type: Number, required: true, default: 5 },

	//not commun
	typeMoney: { type: String, required: true, default: C.DEBT },
	priceWeight1: { type: Number, required: true, default: 1 },
	priceWeight2: { type: Number, required: true, default: 2 },
	priceWeight3: { type: Number, required: true, default: 4 },
	priceWeight4: { type: Number, required: true, default: 8 },

	//option june
	inequalityStart: { type: Boolean, required: true, default: false },
	tauxCroissance: { type: Number, required: true, default: 10 },
	startAmountCoins: { type: Number, required: true, default: 5 },
	pctPoor: { type: Number, required: true, default: 10 },
	pctRich: { type: Number, required: true, default: 10 },

	//option debt
	defaultCreditAmount: { type: Number, required: true, default: 5 },
	defaultInterestAmount: { type: Number, required: true, default: 5 },
	timerCredit: { type: Number, required: true, default: 5 },
	timerPrison: { type: Number, required: true, default: 5 },
	manualBank: { type: Boolean, required: true, default: false },
	seizureType: { type: String, required: true, enum: [C.DECOTE, C.FEES], default: C.DECOTE },
	seizureCosts: { type: Number, required: true, default: 2 },
	seizureDecote: { type: Number, required: true, default: 33 },
});


export default RulesSchema;
