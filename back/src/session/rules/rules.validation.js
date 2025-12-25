import Joi from 'joi';
import { isValidObjectId } from '../../misc/validate.tool.js';

export const schemas = {
    create: Joi.object({
        rules: Joi.object({
            typeMoney: Joi.string(),
            priceWeight1: Joi.number(),
            priceWeight2: Joi.number(),
            priceWeight3: Joi.number(),
            priceWeight4: Joi.number(),

            amountCardsForProd: Joi.number(),
            generatedIdenticalLetters: Joi.number(),
            generatedLettersAuto: Joi.boolean(),
            generatedLettersInDeck: Joi.number(),
            distribInitCards: Joi.number(),
            surveyEnabled: Joi.boolean(),
            roundMax: Joi.number(),
            roundMinutes: Joi.number(),
            autoDeath: Joi.boolean(),
            deathPassTimer: Joi.number(),

            inequalityStart: Joi.boolean(),
            tauxCroissance: Joi.number(),
            startAmountCoins: Joi.number(),
            pctPoor: Joi.number(),
            pctRich: Joi.number(),

            defaultCreditAmount: Joi.number(),
            defaultInterestAmount: Joi.number(),
            timerCredit: Joi.number(),
            timerPrison: Joi.number(),
            manualBank: Joi.boolean(),
            seizureType: Joi.string(),
            seizureCosts: Joi.number(),
            seizureDecote: Joi.number(),
        }).required(),
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }),
    update: Joi.object({
        rules: Joi.object({
            typeMoney: Joi.string(),
            priceWeight1: Joi.number(),
            priceWeight2: Joi.number(),
            priceWeight3: Joi.number(),
            priceWeight4: Joi.number(),

            amountCardsForProd: Joi.number(),
            generatedIdenticalLetters: Joi.number(),
            generatedLettersAuto: Joi.boolean(),
            generatedLettersInDeck: Joi.number(),
            distribInitCards: Joi.number(),
            surveyEnabled: Joi.boolean(),
            roundMax: Joi.number(),
            roundMinutes: Joi.number(),
            autoDeath: Joi.boolean(),
            deathPassTimer: Joi.number(),

            inequalityStart: Joi.boolean(),
            tauxCroissance: Joi.number(),
            startAmountCoins: Joi.number(),
            pctPoor: Joi.number(),
            pctRich: Joi.number(),

            defaultCreditAmount: Joi.number(),
            defaultInterestAmount: Joi.number(),
            timerCredit: Joi.number(),
            timerPrison: Joi.number(),
            manualBank: Joi.boolean(),
            seizureType: Joi.string(),
            seizureCosts: Joi.number(),
            seizureDecote: Joi.number(),
        }).required(),
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }),
    reset: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            })
    }),
    getById: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
        ruleId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid rule ID format',
                'any.required': 'Rule ID is required'
            })
    }),
    remove: Joi.object({
        sessionId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid session ID format',
                'any.required': 'Session ID is required'
            }),
        ruleId: Joi.string().custom(isValidObjectId).required()
            .messages({
                'any.invalid': 'Invalid rule ID format',
                'any.required': 'Rule ID is required'
            })
    })
};
