import Joi from 'joi';
import mongoose from 'mongoose';

const isValidObjectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
};

export const schemas = {
    transaction: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game ID format',
                'any.required': 'Game ID is required'
            }),
        idBuyer: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid buyer ID format',
                'any.required': 'Buyer ID is required'
            }),
        idSeller: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid seller ID format',
                'any.required': 'Seller ID is required'
            }),
        idCard: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid card ID format',
                'any.required': 'Card ID is required'
            })
    }),

    produce: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game ID format',
                'any.required': 'Game ID is required'
            }),
        idPlayer: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid player ID format',
                'any.required': 'Player ID is required'
            }),
        cards: Joi.array().min(3).items(
            Joi.object({
                _id: Joi.string().custom(isValidObjectId).required(),
                weight: Joi.number().min(0).max(3).required(),
                letter: Joi.string().required()
            })
        ).required()
            .custom((value, helpers) => {
                // Check if first two cards have same weight and letter
                if (value[0].weight !== value[1].weight || value[0].letter !== value[1].letter) {
                    return helpers.error('array.base', { message: 'First two cards must have same weight and letter' });
                }
                return value;
            })
            .messages({
                'array.min': 'At least 3 cards are required',
                'array.base': 'Invalid cards format'
            })
    }),

    join: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game ID format',
                'any.required': 'Game ID is required'
            }),
        name: Joi.string().min(2).max(30).required()
            .messages({
                'string.min': 'Name must be at least 2 characters long',
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
        name: Joi.string().min(2).max(30).required(),
        fromId: Joi.string().custom(isValidObjectId).required()
    }),

    addFeedback: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required(),
        idPlayer: Joi.string().custom(isValidObjectId).required(),
        depressedHappy: Joi.number().min(-5).max(5).required(),
        individualCollective: Joi.number().min(-5).max(5).required(),
        aloneIntegrated: Joi.number().min(-5).max(5).required(),
        greedyGenerous: Joi.number().min(-5).max(5).required(),
        competitiveCooperative: Joi.number().min(-5).max(5).required(),
        anxiousConfident: Joi.number().min(-5).max(5).required(),
        agressiveAvenant: Joi.number().min(-5).max(5).required(),
        irritableTolerant: Joi.number().min(-5).max(5).required(),
        dependantAutonomous: Joi.number().min(-5).max(5).required()
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