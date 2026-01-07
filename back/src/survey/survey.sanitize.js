import Joi from 'joi';
import { isValidNanoId4, isValidObjectId } from '../misc/validate.tool.js';

export const sanitize = {
    addFeedback: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
        gameStateId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game state ID format',
                'any.required': 'Game state ID is required'
            }),
        avatarId: Joi.string().custom(isValidNanoId4).required()
            .messages({
                'any.invalid': 'Invalid avatar ID format',
                'any.required': 'Avatar ID is required'
            }),
        depressedHappy: Joi.number().min(-3).max(3).default(0),
        individualCollective: Joi.number().min(-3).max(3).default(0),
        insatisfiedAccomplished: Joi.number().min(-3).max(3).default(0),
        greedyGenerous: Joi.number().min(-3).max(3).default(0),
        competitiveCooperative: Joi.number().min(-3).max(3).default(0),
        anxiousConfident: Joi.number().min(-3).max(3).default(0),
        agressiveAvenant: Joi.number().min(-3).max(3).default(0),
        irritableTolerant: Joi.number().min(-3).max(3).default(0),
        dependantAutonomous: Joi.number().min(-3).max(3).default(0)
    }).required(),
    getBySessionGameStateAvatarId: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
        gameStateId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game state ID format',
                'any.required': 'Game state ID is required'
            }),
        avatarId: Joi.string().custom(isValidNanoId4).required()
            .messages({
                'any.invalid': 'Invalid avatar ID format',
                'any.required': 'Avatar ID is required'
            })
    }).required(),
    getBySessionId: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }).required(),
    getByGameStateId: Joi.object({
        gameStateId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game state ID format',
                'any.required': 'Game state ID is required'
            })
    }).required(),
    removeAllBySessionId: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }).required(),
    removeAllByGameStateId: Joi.object({
        gameStateId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game state ID format',
                'any.required': 'Game state ID is required'
            })
    }).required()
};
