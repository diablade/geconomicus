import Joi from 'joi';
import { isValidObjectId } from '../../misc/validate.tool.js';

export const bankStateSanitize = {
	freeMoney: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
		amount: Joi.number().min(0).required().messages({
			'any.invalid': 'Invalid amount format',
			'any.required': 'Amount is required',
		}),
	}).required(),
	createCredit: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
		amount: Joi.number().min(0).required().messages({
			'any.invalid': 'Invalid amount format',
			'any.required': 'Amount is required',
		}),
		interest: Joi.number().min(0).required().messages({
			'any.invalid': 'Invalid interest format',
			'any.required': 'Interest is required',
		}),
	}).required(),
	creditForAll: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
	}).required(),
	quoteCredit: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
	}).required(),
	requestCredit: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
		double: Joi.boolean().default(false),
	}).required(),
	cancelCredit: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		creditId: Joi.string().required().messages({
			'any.invalid': 'Invalid credit ID format',
			'any.required': 'Credit ID is required',
		}),
	}).required(),
	settleCredit: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
		creditId: Joi.string().required().messages({
			'any.invalid': 'Invalid credit ID format',
			'any.required': 'Credit ID is required',
		}),
	}).required(),
	extendCredit: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
		creditId: Joi.string().required().messages({
			'any.invalid': 'Invalid credit ID format',
			'any.required': 'Credit ID is required',
		}),
	}).required(),
	seizure: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		creditId: Joi.string().required().messages({
			'any.invalid': 'Invalid credit ID format',
			'any.required': 'Credit ID is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
		seizure: Joi.object({
			coins: Joi.number().min(0).required().messages({
				'any.invalid': 'Invalid coins format',
				'any.required': 'Coins is required',
			}),
			cards: Joi.array()
				.items(
					Joi.object({
						key: Joi.string().required().messages({
							'any.required': 'Card key is required',
						}),
						price: Joi.number().min(0).required().messages({
							'any.invalid': 'Invalid price format',
							'any.required': 'Price is required',
						}),
						letter: Joi.string().required().messages({
							'any.required': 'Letter is required',
						}),
						color: Joi.string().required().messages({
							'any.required': 'Color is required',
						}),
						weight: Joi.number().min(0).required().messages({
							'any.invalid': 'Invalid weight format',
							'any.required': 'Weight is required',
						}),
					})
				)
				.required()
				.messages({
					'array.base': 'Cards must be an array',
					'any.required': 'Cards array is required',
				}),
			prisonTime: Joi.number().min(0).max(20).optional().messages({
				'any.invalid': 'Invalid prison time format',
			}),
		})
			.required()
			.messages({
				'object.base': 'Seizure must be an object',
				'any.required': 'Seizure details are required',
			}),
	}).required(),
	prisonBreak: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
	}).required(),
};
