import mongoose from 'mongoose';
import { GAME_TYPE, CREDIT_STATUS, BANK_PROFILE, RATE_SCHEDULE_PRESETS } from '@geco/shared';

const Schema = mongoose.Schema;

let RulesSchema = new Schema(
	{
		idx: { type: Number, required: true },
		gameStateId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'GameState', // le nom de votre modèle
			required: false,
		},

		//common
		amountCardsForProd: { type: Number, required: true, default: 4 },
		generatedIdenticalLetters: { type: Number, required: true, default: 5 },
		generateLettersAuto: { type: Boolean, required: true, default: true },
		generateLettersInDeck: { type: Number, required: false },
		distribInitCards: { type: Number, required: true, default: 4 },
		surveyEnabled: { type: Boolean, required: true, default: true },
		roundMinutes: { type: Number, required: true, default: 20 },
		autoDeath: { type: Boolean, required: true, default: true },
		deathPassTimer: { type: Number, required: true, default: 5 },
		timerSaveInterval: { type: Number, required: true, default: 10 },
		timerDUInterval: { type: Number, required: true, default: 60 },

		//not commun
		typeMoney: { type: String, required: true, default: GAME_TYPE.DEBT },
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
		defaultCreditAmount: { type: Number, required: true, default: 3 },
		defaultInterestAmount: { type: Number, required: true, default: 1 },
		durationCredit: { type: Number, required: true, default: 5 },
		timerPrison: { type: Number, required: true, default: 5 },
		manualBank: { type: Boolean, required: true, default: false }, // deprecated — superseded by autoBank

		//auto-bank (see docs/adr/0003-auto-bank-rate-board.md)
		autoBank: { type: Boolean, required: true, default: false },
		//auto-seizure (see docs/adr/0005-auto-seizure.md) — independent of autoBank
		autoSeizure: { type: Boolean, required: true, default: false },
		bankProfile: {
			type: String,
			required: true,
			enum: Object.values(BANK_PROFILE),
			default: BANK_PROFILE.NORMAL,
		},
		rateSchedule: {
			type: [
				{
					threshold: { type: Number, required: true },
					amount: { type: Number, required: true },
					interest: { type: Number, required: true },
					allowDouble: { type: Boolean, required: true, default: true },
					_id: false,
				},
			],
			default: () => RATE_SCHEDULE_PRESETS.normal,
		},
		seizureType: {
			type: String,
			required: true,
			enum: [CREDIT_STATUS.DECOTE, CREDIT_STATUS.FEES],
			default: CREDIT_STATUS.DECOTE,
		},
		seizureCosts: { type: Number, required: true, default: 2 },
		seizureDecote: { type: Number, required: true, default: 33 },

		//actions
		startingTokens: { type: Number, required: true, default: 1 },
		actions: {
			type: [
				{
					key: { type: String, required: true },
					labelKey: { type: String, required: true },
					descriptionKey: { type: String, required: true },
					cost: { type: Number, required: true },
					enabled: { type: Boolean, required: true, default: true },
					_id: false,
				},
			],
			default: [
				{ key: 'whoHaveCard', labelKey: 'ACTION.WHO_HAVE_CARD.LABEL', descriptionKey: 'ACTION.WHO_HAVE_CARD.DESC', cost: 1, enabled: true },
				{ key: 'give', labelKey: 'ACTION.GIVE.LABEL', descriptionKey: 'ACTION.GIVE.DESC', cost: 2, enabled: true },
				{ key: 'steal', labelKey: 'ACTION.STEAL.LABEL', descriptionKey: 'ACTION.STEAL.DESC', cost: 2, enabled: true },
				{ key: 'silentSteal', labelKey: 'ACTION.SILENT_STEAL.LABEL', descriptionKey: 'ACTION.SILENT_STEAL.DESC', cost: 3, enabled: true },
				{ key: 'war', labelKey: 'ACTION.WAR.LABEL', descriptionKey: 'ACTION.WAR.DESC', cost: 6, enabled: true },
				{ key: 'ong', labelKey: 'ACTION.ONG.LABEL', descriptionKey: 'ACTION.ONG.DESC', cost: 6, enabled: true },
			],
		},
	},
	{ _id: false }
);

export default RulesSchema;
