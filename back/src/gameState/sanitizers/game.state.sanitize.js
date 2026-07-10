import Joi from 'joi';
import { isValidNanoId4, isValidObjectId } from '../../misc/validate.tool.js';

export const stateSanitize = {
	create: Joi.object({
		sessionId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
		}),
		ruleIdx: Joi.number().required().messages({
			'any.invalid': 'Invalid rule ID format',
			'any.required': 'Rule ID is required',
		}),
	}).required(),
	start: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game ID format',
			'any.required': 'Game ID is required',
		}),
	}),
	pause: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game ID format',
			'any.required': 'Game ID is required',
		}),
	}),
	resume: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game ID format',
			'any.required': 'Game ID is required',
		}),
	}),
	stop: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game ID format',
			'any.required': 'Game ID is required',
		}),
	}),
	getById: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
		}),
	}).required(),
	whoHaveCard: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
		}),
		cardKey: Joi.string().required().messages({
			'any.invalid': 'Invalid card key format',
			'any.required': 'Card key is required',
		}),
	}).required(),
	actionWhoHaveCard: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		playerStateIdx: Joi.number().integer().min(0).required(),
		cardKey: Joi.string().required(),
	}).required(),
	init: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
	}).required(),
	startRound: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
	}).required(),
	actionGive: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		giverIdx: Joi.number().integer().min(0).required(),
		receiverIdx: Joi.number().integer().min(0).required(),
		cardKey: Joi.string().required(),
	}).required(),
	actionSteal: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		stealerIdx: Joi.number().integer().min(0).required(),
		victimIdx: Joi.number().integer().min(0).required(),
		cardKey: Joi.string().required(),
	}).required(),
	actionSilentSteal: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		stealerIdx: Joi.number().integer().min(0).required(),
		victimIdx: Joi.number().integer().min(0).required(),
		cardKey: Joi.string().required(),
	}).required(),
	actionWar: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		attackerIdx: Joi.number().integer().min(0).required(),
		victim1Idx: Joi.number().integer().min(0).required(),
		victim2Idx: Joi.number().integer().min(0).required(),
	}).required(),
	actionOng: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		giverIdx: Joi.number().integer().min(0).required(),
		cardKeys: Joi.array().items(Joi.string()).length(4).required(),
		manualTargetIdxs: Joi.array().items(Joi.number().integer().min(0)).length(2).optional(),
	}).required(),
	actionGetTargetCards: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		targetIdx: Joi.number().integer().min(0).required(),
	}).required(),
	actionGetAvailablePlayers: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		excludeIdx: Joi.number().integer().min(0).required(),
	}).required(),
};
