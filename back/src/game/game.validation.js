import Joi from 'joi';
import mongoose from 'mongoose';

const isValidObjectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
};

export const schemas = {
    create: Joi.object({
        name:     Joi.string().min(2).max(50).required()
                      .messages({
                          'string.min':   'Name must be at least 2 characters long',
                          'string.max':   'Name cannot exceed 50 characters',
                          'any.required': 'Name is required'
                      }),
        animator: Joi.string(),
        location: Joi.string(),
    }),

    start: Joi.object({
        idGame:    Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid game ID format',
                           'any.required': 'Game ID is required'
                       }),
        typeMoney: Joi.string().required()
                       .messages({
                           'any.required': 'Type of money is required'
                       })
    }),

    update: Joi.object({
        idGame:                  Joi.string().custom(isValidObjectId).required()
                                     .messages({
                                         'any.invalid':  'Invalid game ID format',
                                         'any.required': 'Game ID is required'
                                     }),
        name:                    Joi.string().min(1).max(50).required()
                                     .messages({
                                         'any.invalid':  'Invalid game name',
                                         'any.required': 'Game name is required'
                                     }),
        animator:                Joi.string(),
        location:                Joi.string(),
        typeMoney:               Joi.string(),
        surveyEnabled:           Joi.boolean(),
        devMode:                 Joi.boolean(),
        autoDeath:               Joi.boolean(),
        deathPassTimer:          Joi.number().integer().min(0).max(5),
        priceWeight1:            Joi.number().integer().min(0),
        priceWeight2:            Joi.number().integer().min(0),
        priceWeight3:            Joi.number().integer().min(0),
        priceWeight4:            Joi.number().integer().min(0),
        round:                   Joi.number().integer().min(0),
        roundMax:                Joi.number().integer().min(1),
        roundMinutes:            Joi.number().integer().min(1).max(30),
        amountCardsForProd:      Joi.number().integer().min(3).max(5),
        generatedIdenticalCards: Joi.number().integer().min(0),
        generateLettersAuto:     Joi.boolean(),
        generateLettersInDeck:   Joi.number().integer().min(0),
        distribInitCards:        Joi.number().integer().min(0),

        // June options
        tauxCroissance:   Joi.number().min(0),
        inequalityStart:  Joi.boolean(),
        startAmountCoins: Joi.number().integer().min(0),
        pctPoor:          Joi.number().min(0).max(100),
        pctRich:          Joi.number().min(0).max(100),

        // Debt options
        defaultCreditAmount:   Joi.number().integer().min(0),
        defaultInterestAmount: Joi.number().integer().min(0),
        timerCredit:           Joi.number().min(0).max(20),
        timerPrison:           Joi.number().integer().min(0).max(20),
        manualBank:            Joi.boolean(),
        seizureType:           Joi.string(),
        seizureCosts:          Joi.number().integer().min(0),
        seizureDecote:         Joi.number().min(0).max(100)
    }),

    startRound: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
                    .messages({
                        'any.invalid':  'Invalid game ID format',
                        'any.required': 'Game ID is required'
                    }),
        round:  Joi.number().integer().min(0).required()
                    .messages({
                        'number.base':  'Round must be a number',
                        'any.required': 'Round number is required'
                    })
    }),

    stopRound: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
                    .messages({
                        'any.invalid':  'Invalid game ID format',
                        'any.required': 'Game ID is required'
                    }),
        round:  Joi.number().integer().min(0).required()
                    .messages({
                        'number.base':  'Round must be a number',
                        'any.required': 'Round number is required'
                    })
    }),

    interRound: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
                    .messages({
                        'any.invalid':  'Invalid game ID format',
                        'any.required': 'Game ID is required'
                    })
    }),

    end: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
                    .messages({
                        'any.invalid':  'Invalid game ID format',
                        'any.required': 'Game ID is required'
                    })
    }),

    deleteGame: Joi.object({
        idGame:   Joi.string().custom(isValidObjectId).required()
                      .messages({
                          'any.invalid':  'Invalid game ID format',
                          'any.required': 'Game ID is required'
                      }),
        password: Joi.string().required()
                      .messages({
                          'any.required': 'Password is required'
                      })
    }),

    idGame: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
                    .messages({
                        'any.invalid':  'Invalid game ID format',
                        'any.required': 'Game ID is required'
                    })
    }),

    getIdGameByShortId: Joi.object({
        shortId: Joi.string().pattern(/^[a-z0-9]{4}$/).required()
                     .messages({
                         'any.required':        'Short ID is required',
                         'string.pattern.base': 'Short ID must be 4 characters long and contain only letters and numbers'
                     })
    }),

    deletePlayer: Joi.object({
        idGame:   Joi.string().custom(isValidObjectId).required()
                      .messages({
                          'any.invalid':  'Invalid game ID format',
                          'any.required': 'Game ID is required'
                      }),
        idPlayer: Joi.string().custom(isValidObjectId).required()
                      .messages({
                          'any.invalid':  'Invalid player ID format',
                          'any.required': 'Player ID is required'
                      })
    }),

    killPlayer: Joi.object({
        idGame:   Joi.string().custom(isValidObjectId).required()
                      .messages({
                          'any.invalid':  'Invalid game ID format',
                          'any.required': 'Game ID is required'
                      }),
        idPlayer: Joi.string().custom(isValidObjectId).required()
                      .messages({
                          'any.invalid':  'Invalid player ID format',
                          'any.required': 'Player ID is required'
                      })
    }),

    reset: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
                    .messages({
                        'any.invalid':  'Invalid game ID format',
                        'any.required': 'Game ID is required'
                    })
    }),

    refreshForceAllPlayers: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
                    .messages({
                        'any.invalid':  'Invalid game ID format',
                        'any.required': 'Game ID is required'
                    })
    }),
    refreshPlayer: Joi.object({
        idGame: Joi.string().custom(isValidObjectId).required()
                    .messages({
                        'any.invalid':  'Invalid game ID format',
                        'any.required': 'Game ID is required'
                    }),
        idPlayer: Joi.string().custom(isValidObjectId).required()
                    .messages({
                        'any.invalid':  'Invalid player ID format',
                        'any.required': 'Player ID is required'
                    })
    })
};

export const validate = (schema, params = false) => {
    return (req, res, next) => {
        const {error} = schema.validate(params ? req.params : req.body, {abortEarly: false});

        if (error) {
            const errors = error.details.map(detail => ({
                field:   detail.path.join('.'),
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
