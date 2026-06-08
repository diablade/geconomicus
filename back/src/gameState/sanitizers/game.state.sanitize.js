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
	produce: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game ID format',
			'any.required': 'Game ID is required',
		}),
		playerIdx: Joi.number().required().messages({
			'any.invalid': 'Invalid player index format',
			'any.required': 'Player index is required',
		}),
		cards: Joi.array()
			.min(3)
			.items(
				Joi.object({
					_id: Joi.string().custom(isValidObjectId).required(),
					weight: Joi.number().min(0).max(4).required(),
					letter: Joi.string().required(),
					color: Joi.string().required(),
					price: Joi.number().min(0).required(),
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
				'array.base': 'Invalid cards format',
			}),
	}),
	getById: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid session ID format',
			'any.required': 'Session ID is required',
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
	killPlayer: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
		}),
		playerStateIdx: Joi.number().integer().min(0).required().messages({
			'any.invalid': 'Invalid player state index format',
			'any.required': 'Player state index is required',
		}),
	}).required(),
	startRound: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required().messages({
			'any.invalid': 'Invalid game state ID format',
			'any.required': 'Game state ID is required',
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
};
