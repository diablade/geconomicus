import Joi from 'joi';
import {isValidObjectId, isValidNanoId4} from '../../misc/validate.tool.js';
import {C} from '../../../../config/constantes.mjs';

export const sanitize = {
    create:  Joi.object({
        rules:     Joi.object({
            //not commun
            typeMoney:    Joi.string().default(C.DEBT),
            priceWeight1: Joi.number().default(1),
            priceWeight2: Joi.number().default(2),
            priceWeight3: Joi.number().default(4),
            priceWeight4: Joi.number().default(8),

            //common
            amountCardsForProd:        Joi.number().default(4),
            generatedIdenticalLetters: Joi.number().default(5),
            generatedLettersAuto:      Joi.boolean().default(true),
            generatedLettersInDeck:    Joi.number(),
            distribInitCards:          Joi.number().default(4),
            surveyEnabled:             Joi.boolean().default(true),
            roundMax:                  Joi.number().default(1),
            roundMinutes:              Joi.number().default(20),
            autoDeath:                 Joi.boolean().default(true),
            deathPassTimer:            Joi.number().default(5),

            //option june
            inequalityStart:  Joi.boolean().default(false),
            tauxCroissance:   Joi.number().default(10),
            startAmountCoins: Joi.number().default(5),
            pctPoor:          Joi.number().default(10),
            pctRich:          Joi.number().default(10),

            //option debt
            defaultCreditAmount:   Joi.number().default(5),
            defaultInterestAmount: Joi.number().default(5),
            timerCredit:           Joi.number().default(5),
            timerPrison:           Joi.number().default(5),
            manualBank:            Joi.boolean().default(false),
            seizureType:           Joi.string().default(C.DECOTE),
            seizureCosts:          Joi.number().default(2),
            seizureDecote:         Joi.number().default(33),
        }).required(),
        sessionId: Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid session ID format',
                           'any.required': 'Session ID is required'
                       })
    }),
    update:  Joi.object({
        updates:   Joi.object({
            typeMoney:    Joi.string(),
            priceWeight1: Joi.number(),
            priceWeight2: Joi.number(),
            priceWeight3: Joi.number(),
            priceWeight4: Joi.number(),

            amountCardsForProd:        Joi.number(),
            generatedIdenticalLetters: Joi.number(),
            generatedLettersAuto:      Joi.boolean(),
            generatedLettersInDeck:    Joi.number(),
            distribInitCards:          Joi.number(),
            surveyEnabled:             Joi.boolean(),
            roundMax:                  Joi.number(),
            roundMinutes:              Joi.number(),
            autoDeath:                 Joi.boolean(),
            deathPassTimer:            Joi.number(),

            inequalityStart:  Joi.boolean(),
            tauxCroissance:   Joi.number(),
            startAmountCoins: Joi.number(),
            pctPoor:          Joi.number(),
            pctRich:          Joi.number(),

            defaultCreditAmount:   Joi.number(),
            defaultInterestAmount: Joi.number(),
            timerCredit:           Joi.number(),
            timerPrison:           Joi.number(),
            manualBank:            Joi.boolean(),
            seizureType:           Joi.string(),
            seizureCosts:          Joi.number(),
            seizureDecote:         Joi.number(),
        }).required(),
        sessionId: Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid session ID format',
                           'any.required': 'Session ID is required'
                       }),
        ruleId:    Joi.string().custom(isValidNanoId4).required()
                       .messages({
                           'any.invalid':  'Invalid rule ID format',
                           'any.required': 'Rule ID is required'
                       })
    }),
    getById: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid session ID format',
                           'any.required': 'Session ID is required'
                       }),
        ruleId:    Joi.string().custom(isValidNanoId4).required()
                       .messages({
                           'any.invalid':  'Invalid rule ID format',
                           'any.required': 'Rule ID is required'
                       })
    }),
    remove:  Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
                       .messages({
                           'any.invalid':  'Invalid session ID format',
                           'any.required': 'Session ID is required'
                       }),
        ruleId:    Joi.string().custom(isValidNanoId4).required()
                       .messages({
                           'any.invalid':  'Invalid rule ID format',
                           'any.required': 'Rule ID is required'
                       })
    })
};
