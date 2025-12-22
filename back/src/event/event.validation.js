import Joi from 'joi';
import {isValidObjectId} from '../misc/validate.tool.js';

export const schemas = {
    addEvent:          Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid session ID format',
                           'any.required': 'Session ID is required'
                       }),
        gameId:    Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid game ID format',
                           'any.required': 'Game ID is required'
                       }),
        typeEvent: Joi.string().required()
                       .messages({
                           'any.required': 'Event type is required'
                       }),
        emitter:   Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid emitter ID format',
                           'any.required': 'Emitter ID is required'
                       }),
        receiver:  Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid receiver ID format',
                           'any.required': 'Receiver ID is required'
                       }),
        payload:   Joi.object().required()
                       .messages({
                           'any.required': 'Payload is required'
                       })
    }),
    getBySessionId:    Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid session ID format',
                           'any.required': 'Session ID is required'
                       }),
    }),
    removeBySessionId: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid session ID format',
                           'any.required': 'Session ID is required'
                       })
    }),
    removeByGameId:    Joi.object({
        gameId: Joi.string().custom(isValidObjectId).required()
                    .messages({
                        'any.invalid':  'Invalid game ID format',
                        'any.required': 'Game ID is required'
                    })
    })
};
