import Joi from 'joi';
import mongoose from 'mongoose';

const isValidObjectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
};

export const schemas = {
    

    join: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game ID format',
                'any.required': 'Game ID is required'
            }),
        name: Joi.string().min(1).max(30).required()
            .messages({
                'string.min': 'Name must be at least 1 character long',
                'string.max': 'Name cannot exceed 30 characters',
                'any.required': 'Name is required'
            })
    }),

    update: Joi.object({
        _id: Joi.string().custom(isValidObjectId).required(),
        idGame: Joi.string().custom(isValidObjectId).required(),
        name: Joi.string().min(1).max(30).required(),
        image: Joi.string().allow(''),
        eyes: Joi.number().allow(''),
        eyebrows: Joi.number().allow(''),
        earrings: Joi.number().allow(''),
        features: Joi.number().allow(''),
        hair: Joi.number().allow(''),
        glasses: Joi.number().allow(''),
        mouth: Joi.number().allow(''),
        skinColor: Joi.string().allow(''),
        hairColor: Joi.string().allow(''),
        boardConf: Joi.string().allow(''),
        boardColor: Joi.string().allow('')
    }),

    isReincarnated: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required(),
        fromId: Joi.string().custom(isValidObjectId).required()
    }),

    joinReincarnate: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required(),
        name: Joi.string().min(1).max(30).required(),
        fromId: Joi.string().custom(isValidObjectId).required()
    }),

    addFeedback: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required(),
        idPlayer: Joi.string().custom(isValidObjectId).required(),
        depressedHappy: Joi.number().min(-3).max(3).required(),
        individualCollective: Joi.number().min(-3).max(3).required(),
        insatisfiedAccomplished: Joi.number().min(-3).max(3).required(),
        greedyGenerous: Joi.number().min(-3).max(3).required(),
        competitiveCooperative: Joi.number().min(-3).max(3).required(),
        anxiousConfident: Joi.number().min(-3).max(3).required(),
        agressiveAvenant: Joi.number().min(-3).max(3).required(),
        irritableTolerant: Joi.number().min(-3).max(3).required(),
        dependantAutonomous: Joi.number().min(-3).max(3).required()
    })
};

export const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                status: 'validation_error',
                errors
            });
        }

        next();
    };
};
