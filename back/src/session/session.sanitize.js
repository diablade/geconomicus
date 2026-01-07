import Joi from 'joi';
import { isValidObjectId, isValidNanoId4 } from '../misc/validate.tool.js';

export const sanitize = {
    getById: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
    }),
    getByShortId: Joi.object({
        shortId: Joi.string().custom(isValidNanoId4).required()
            .messages({
                'any.invalid': 'Invalid short ID format',
                'any.required': 'Short ID is required'
            }),
    }),
    create: Joi.object({
        name: Joi.string().required(),
        animator: Joi.string().default("-"),
        location: Joi.string().default("-"),
        devMode: Joi.boolean().default(false),
        theme: Joi.string().default("CLASSIC")
    }).required(),
    update: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
        updates: Joi.object({
            name: Joi.string().required(),
            animator: Joi.string(),
            location: Joi.string(),
            devMode: Joi.boolean(),
            theme: Joi.string(),
        }).required(),
    }).required(),
    deleteSession: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }),
};
