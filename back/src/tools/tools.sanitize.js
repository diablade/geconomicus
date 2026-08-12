import Joi from 'joi';
import { GAME_TYPE, CREDIT_STATUS } from '@geco/shared';

export const sanitize = {
	simulate: Joi.object({
		players: Joi.number().integer().min(2).max(120).required(),
		typeMoney: Joi.string()
			.valid(...Object.values(GAME_TYPE))
			.default(GAME_TYPE.JUNE),
		seed: Joi.number().integer().min(0).max(2147483647).default(1),
		rounds: Joi.number().integer().min(1).max(1000).empty([null, '']).default(50),
		encountersPerRound: Joi.number().min(0.25).max(20).default(3.25),
		animatorCreditsPerRound: Joi.number().min(1).max(50).default(1),
		logActions: Joi.boolean().default(true),
		rules: Joi.object({
			amountCardsForProd: Joi.number().integer().min(2).max(8).default(4),
			generatedIdenticalLetters: Joi.number().integer().min(2).max(12).default(5),
			generateLettersAuto: Joi.boolean().default(true),
			generateLettersInDeck: Joi.number().integer().min(1).max(200).empty([null, '']).optional(),
			distribInitCards: Joi.number().integer().min(1).max(12).default(4),
			autoDeath: Joi.boolean().default(true),
			inequalityStart: Joi.boolean().default(false),
			startAmountCoins: Joi.number().min(0).max(100).default(5),
			tauxCroissance: Joi.number().min(0).max(100).default(10),
			timerDUInterval: Joi.number().min(5).max(600).default(60),
			durationCredit: Joi.number().min(1).max(60).default(5),
			timerPrison: Joi.number().min(1).max(60).default(5),
			defaultCreditAmount: Joi.number().min(1).max(50).default(3),
			defaultInterestAmount: Joi.number().min(0).max(50).default(1),
			priceWeight1: Joi.number().min(1).max(100).default(1),
			priceWeight2: Joi.number().min(1).max(100).default(2),
			priceWeight3: Joi.number().min(1).max(100).default(4),
			priceWeight4: Joi.number().min(1).max(100).default(8),
			autoBank: Joi.boolean().default(false),
			autoSeizure: Joi.boolean().default(false),
			techShiftEnabled: Joi.boolean().default(false),
			techShiftExchangeRatio: Joi.number().valid(1, 2).empty([null, '']).default(1),
			firstCreditAcceptance: Joi.number().min(0).max(100).empty([null, '']).default(0),
			seizureType: Joi.string().valid(CREDIT_STATUS.DECOTE, CREDIT_STATUS.FEES).default(CREDIT_STATUS.DECOTE),
			seizureDecote: Joi.number().min(0).max(100).default(33),
			seizureCosts: Joi.number().min(0).max(100).default(2),
		}).default({}),
		thresholds: Joi.object({
			latentFloor: Joi.number().min(0).max(200).empty([null, '']).optional(),
			strandedCeiling: Joi.number().min(0).max(1).empty([null, '']).optional(),
			deadlockGraceRounds: Joi.number().integer().min(0).max(500).empty([null, '']).optional(),
			temperatureTolerance: Joi.number().min(1.1).max(10).empty([null, '']).optional(),
			techShiftFloorRound: Joi.number().min(0).max(1000).empty([null, '']).optional(),
		}).default({}),
	}),
};
