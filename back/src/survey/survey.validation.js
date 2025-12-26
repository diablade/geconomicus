import Joi from 'joi';
import { isValidObjectId } from '../misc/validate.tool.js';

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
        avatarId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid avatar ID format',
                'any.required': 'Avatar ID is required'
            }),
        depressedHappy: Joi.number().min(-3).max(3).required(),
        individualCollective: Joi.number().min(-3).max(3).required(),
        insatisfiedAccomplished: Joi.number().min(-3).max(3).required(),
        greedyGenerous: Joi.number().min(-3).max(3).required(),
        competitiveCooperative: Joi.number().min(-3).max(3).required(),
        anxiousConfident: Joi.number().min(-3).max(3).required(),
        agressiveAvenant: Joi.number().min(-3).max(3).required(),
        irritableTolerant: Joi.number().min(-3).max(3).required(),
        dependantAutonomous: Joi.number().min(-3).max(3).required()
    }),
    getByGameStateIdAndAvatarId: Joi.object({
        gameStateId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game state ID format',
                'any.required': 'Game state ID is required'
            }),
        avatarId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid avatar ID format',
                'any.required': 'Avatar ID is required'
            })
    }),
    getByGameStateId: Joi.object({
        gameStateId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game state ID format',
                'any.required': 'Game state ID is required'
            })
    }),
    getBySessionId: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }),
    removeAllBySessionId: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }),
    removeAllByGameStateId: Joi.object({
        gameStateId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game state ID format',
                'any.required': 'Game state ID is required'
            })
    })
};
