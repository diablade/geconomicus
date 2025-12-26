import Joi from 'joi';
import { isValidObjectId } from '../misc/validate.tool.js';

export const inputs = {
    getById: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
    }),
    getByShortId: Joi.object({
        shortId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid short ID format',
                'any.required': 'Short ID is required'
            }),
    }),
    create: Joi.object({
        name: Joi.string().required(),
        animator: Joi.string(),
        location: Joi.string(),
        devMode: Joi.boolean(),
        theme: Joi.string(),
        games: Joi.array(),
        players: Joi.array()
    }).required(),
    update: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
        name: Joi.string().required(),
        animator: Joi.string(),
        location: Joi.string(),
        devMode: Joi.boolean(),
        theme: Joi.string(),
    }).required(),
    deleteSession: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }),
};
