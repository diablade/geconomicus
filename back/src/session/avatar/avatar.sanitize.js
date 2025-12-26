import Joi from 'joi';
import { isValidObjectId } from '../../misc/validate.tool.js';

export const sanitize = {
    getById: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
        avatarId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid avatar ID format',
                'any.required': 'Avatar ID is required'
            }),
    }).required(),
    join: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
    }).required(),
    update: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
        avatarId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid avatar ID format',
                'any.required': 'Avatar ID is required'
            }),
        updates: Joi.object({
            name: Joi.string(),
            image: Joi.string(),
            eyes: Joi.number(),
            earrings: Joi.number(),
            eyebrows: Joi.number(),
            features: Joi.number(),
            hair: Joi.number(),
            glasses: Joi.number(),
            mouth: Joi.number(),
            skinColor: Joi.string(),
            hairColor: Joi.string(),
            earringsProbability: Joi.number(),
            glassesProbability: Joi.number(),
            featuresProbability: Joi.number(),
            boardConf: Joi.string(),
            boardColor: Joi.string(),
        }).required(),
    }).required(),
    delete: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
        avatarId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid avatar ID format',
                'any.required': 'Avatar ID is required'
            }),
    }).required()
};
