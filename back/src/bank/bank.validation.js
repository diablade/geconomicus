import Joi from 'joi';
import mongoose from 'mongoose';

const isValidObjectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
};

export const schemas = {
    createCredit: Joi.object({
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
        interest: Joi.number().min(0).required()
            .messages({
                'number.min': 'Interest cannot be negative',
                'any.required': 'Interest is required'
            }),
        amount: Joi.number().min(0).required()
            .messages({
                'number.min': 'Amount cannot be negative',
                'any.required': 'Amount is required'
            })
    }),

    settleCredit: Joi.object({
        credit: Joi.object({
            _id: Joi.string().custom(isValidObjectId).required(),
            idGame: Joi.string().custom(isValidObjectId).required(),
            idPlayer: Joi.string().custom(isValidObjectId).required(),
            amount: Joi.number().min(0).required(),
            interest: Joi.number().min(0).required(),
            status: Joi.string().required()
        }).required()
            .messages({
                'any.required': 'Credit object is required'
            })
    }),

    payInterest: Joi.object({
        credit: Joi.object({
            _id: Joi.string().custom(isValidObjectId).required(),
            idGame: Joi.string().custom(isValidObjectId).required(),
            idPlayer: Joi.string().custom(isValidObjectId).required(),
            interest: Joi.number().min(0).required()
        }).required()
            .messages({
                'any.required': 'Credit object is required'
            })
    }),

    seizure: Joi.object({
        credit: Joi.object({
            _id: Joi.string().custom(isValidObjectId).required(),
            idGame: Joi.string().custom(isValidObjectId).required(),
            idPlayer: Joi.string().custom(isValidObjectId).required(),
            interest: Joi.number().min(0).required()
        }).required()
            .messages({
                'any.required': 'Credit object is required'
            }),
        seizure: Joi.object({
            coins: Joi.number().min(0).required(),
            cards: Joi.array().items(
                Joi.object({
                    _id: Joi.string().custom(isValidObjectId).required(),
                    price: Joi.number().min(0).required()
                })
            ).required(),
            prisonTime: Joi.number().min(0)
        }).required()
            .messages({
                'any.required': 'Seizure object is required'
            })
    }),

    prisonBreak: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid game ID format',
                'any.required': 'Game ID is required'
            }),
        idPlayerToFree: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid player ID format',
                'any.required': 'Player ID is required'
            })
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