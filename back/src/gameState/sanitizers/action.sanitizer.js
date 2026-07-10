import Joi from 'joi';
import { isValidObjectId } from '../../misc/validate.tool.js';

export const actionSanitize = {
	getTargetCards: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		targetIdx: Joi.number().integer().min(0).required(),
	}).required(),
	getAvailablePlayers: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		excludeIdx: Joi.number().integer().min(0).required(),
	}).required(),
	give: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		giverIdx: Joi.number().integer().min(0).required(),
		receiverIdx: Joi.number().integer().min(0).required(),
		cardKey: Joi.string().required(),
	}).required(),
	steal: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		stealerIdx: Joi.number().integer().min(0).required(),
		victimIdx: Joi.number().integer().min(0).required(),
		cardKey: Joi.string().required(),
	}).required(),
	silentSteal: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		stealerIdx: Joi.number().integer().min(0).required(),
		victimIdx: Joi.number().integer().min(0).required(),
		cardKey: Joi.string().required(),
	}).required(),
	war: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		attackerIdx: Joi.number().integer().min(0).required(),
		victim1Idx: Joi.number().integer().min(0).required(),
		victim2Idx: Joi.number().integer().min(0).required(),
	}).required(),
	ong: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		giverIdx: Joi.number().integer().min(0).required(),
		cardKeys: Joi.array().items(Joi.string()).length(4).required(),
		manualTargetIdxs: Joi.array().items(Joi.number().integer().min(0)).length(2).optional(),
	}).required(),
	whoHaveCard: Joi.object({
		gameStateId: Joi.string().custom(isValidObjectId).required(),
		playerStateIdx: Joi.number().integer().min(0).required(),
		cardKey: Joi.string().required(),
	}).required(),
};
