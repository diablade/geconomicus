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
