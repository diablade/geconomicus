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
};
