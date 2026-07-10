import Joi from 'joi';
import { isValidObjectId } from '../../misc/validate.tool.js';

export const playerStateSanitize = {
	produce: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game ID format',
			'any.required': 'Game ID is required',
		}),
		playerStateIdx: Joi.number().required().messages({
			'any.invalid': 'Invalid player index format',
			'any.required': 'Player index is required',
		}),
		cards: Joi.array()
			.min(3)
			.max(4)
			.items(
				Joi.object({
					key: Joi.string().required(),
					weight: Joi.number().min(0).max(4).required(),
					letter: Joi.string().required(),
				})
			)
			.required()
			.custom((value, helpers) => {
				// Check if first two cards have same weight and letter
				if (value[0].weight !== value[1].weight || value[0].letter !== value[1].letter) {
					return helpers.error('array.base', { message: 'First two cards must have same weight and letter' });
				}
				return value;
			})
			.messages({
				'array.min': 'At least 3 cards are required',
				'array.max': 'At most 4 cards are allowed',
				'array.base': 'Invalid cards format',
			}),
	}),
	refreshPlayer: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
	}).required(),
	refreshAllPlayers: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
	}).required(),
	getCurrentPlayerStateIdx: Joi.object({
		sessionId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
		}),
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		avatarIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid avatar index format',
			'any.required': 'Avatar index is required',
		}),
	}).required(),
	getPlayerState: Joi.object({
		sessionId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
		}),
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		avatarIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid avatar index format',
			'any.required': 'Avatar index is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
	}).required(),
	transaction: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		buyerIdx: Joi.number().required().messages({
			'any.invalid': 'Invalid buyer index format',
			'any.required': 'Buyer index is required',
		}),
		sellerIdx: Joi.number().required().messages({
			'any.invalid': 'Invalid seller index format',
			'any.required': 'Seller index is required',
		}),
		cardKey: Joi.string().required().messages({
			'any.invalid': 'Invalid card key format',
			'any.required': 'Card key is required',
		}),
	}),
};
