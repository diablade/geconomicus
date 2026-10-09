import Joi from 'joi';
import { isValidObjectId } from '../misc/validate.tool.js';

export const sanitize = {
    getBySessionId: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
    }),
    getByGameStateId: Joi.object({
        gameStateId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game state ID format',
                'any.required': 'Game state ID is required'
            }),
    }),
};
