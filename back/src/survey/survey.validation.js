import Joi from 'joi';

export const schemas = {
    addFeedback: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
        gameId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game ID format',
                'any.required': 'Game ID is required'
            }),
        playerId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid player ID format',
                'any.required': 'Player ID is required'
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
    getByGameIdAndPlayerId: Joi.object({
        gameId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game ID format',
                'any.required': 'Game ID is required'
            }),
        playerId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid player ID format',
                'any.required': 'Player ID is required'
            })
    }),
    getByGameId: Joi.object({
        gameId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game ID format',
                'any.required': 'Game ID is required'
            })
    }),
    getBySessionId: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }),
    removeBySessionId: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }),
    removeByGameId: Joi.object({
        gameId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game ID format',
                'any.required': 'Game ID is required'
            })
    })
};
