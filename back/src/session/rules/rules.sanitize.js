import Joi from 'joi';
import {isValidObjectId, isValidNanoId4} from '../../misc/validate.tool.js';
import { GAME_TYPE,CREDIT_STATUS } from '@geco/shared';

export const sanitize = {
	create: Joi.object({
		rules: Joi.object({
			//not commun
			typeMoney: Joi.string().default(GAME_TYPE.DEBT),
			priceWeight1: Joi.number().default(1),
			priceWeight2: Joi.number().default(2),
			priceWeight3: Joi.number().default(4),
			priceWeight4: Joi.number().default(8),

			//common
			amountCardsForProd: Joi.number().default(4),
			generatedIdenticalLetters: Joi.number().default(5),
			generatedLettersAuto: Joi.boolean().default(true),
			generatedLettersInDeck: Joi.number(),
			distribInitCards: Joi.number().default(4),
			surveyEnabled: Joi.boolean().default(true),
			roundMax: Joi.number().default(1),
			roundMinutes: Joi.number().default(20),
			autoDeath: Joi.boolean().default(true),
			deathPassTimer: Joi.number().default(5),
			timerSaveInterval: Joi.number().default(20),
			timerDUInterval: Joi.number().default(60),

			//option june
			inequalityStart: Joi.boolean().default(false),
			tauxCroissance: Joi.number().default(10),
			startAmountCoins: Joi.number().default(5),
			pctPoor: Joi.number().default(10),
			pctRich: Joi.number().default(10),

			//option debt
			defaultCreditAmount: Joi.number().default(3),
			defaultInterestAmount: Joi.number().default(1),
			durationCredit: Joi.number().default(5),
			timerPrison: Joi.number().default(5),
			manualBank: Joi.boolean().default(false),
			seizureType: Joi.string().default(CREDIT_STATUS.DECOTE),
			seizureCosts: Joi.number().default(2),
			seizureDecote: Joi.number().default(33),
		}).required(),
		sessionId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
		}),
	}),
	default: Joi.object({
		ruleIdx: Joi.number().required().messages({
			'any.invalid': 'Invalid rule ID format',
			'any.required': 'Rule ID is required',
		}),
		sessionId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
		}),
	}),
	update: Joi.object({
		updates: Joi.object({
			typeMoney: Joi.string().valid(GAME_TYPE.JUNE, GAME_TYPE.DEBT),
			priceWeight1: Joi.number().optional(),
			priceWeight2: Joi.number().optional(),
			priceWeight3: Joi.number().optional(),
			priceWeight4: Joi.number().optional(),

			amountCardsForProd: Joi.number().optional(),
			generatedIdenticalLetters: Joi.number().optional(),
			generatedLettersAuto: Joi.boolean().optional(),
			generatedLettersInDeck: Joi.number().optional(),
			distribInitCards: Joi.number().optional(),
			surveyEnabled: Joi.boolean().optional(),
			roundMax: Joi.number().optional(),
			roundMinutes: Joi.number().optional(),
			autoDeath: Joi.boolean().optional(),
			deathPassTimer: Joi.number().optional(),
			timerSaveInterval: Joi.number().optional(),
			timerDUInterval: Joi.number().optional(),

			inequalityStart: Joi.boolean().optional(),
			tauxCroissance: Joi.number().optional(),
			startAmountCoins: Joi.number().optional(),
			pctPoor: Joi.number().optional(),
			pctRich: Joi.number().optional(),

			defaultCreditAmount: Joi.number().optional(),
			defaultInterestAmount: Joi.number().optional(),
			durationCredit: Joi.number().optional(),
			timerPrison: Joi.number().optional(),
			manualBank: Joi.boolean().optional(),
			seizureType: Joi.string().optional(),
			seizureCosts: Joi.number().optional(),
			seizureDecote: Joi.number().optional(),
		}).required(),
		sessionId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
		}),
		ruleIdx: Joi.number().required().messages({
			'any.invalid': 'Invalid rule ID format',
			'any.required': 'Rule ID is required',
		}),
	}),
	getByIdx: Joi.object({
		sessionId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
		}),
		ruleIdx: Joi.number().required().messages({
			'any.invalid': 'Invalid rule ID format',
			'any.required': 'Rule ID is required',
		}),
	}),
	remove: Joi.object({
		sessionId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
		}),
		ruleIdx: Joi.number().required().messages({
			'any.invalid': 'Invalid rule ID format',
			'any.required': 'Rule ID is required',
		}),
	}),
};
