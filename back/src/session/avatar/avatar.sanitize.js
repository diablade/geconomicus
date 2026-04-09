import Joi from 'joi';
import {isValidObjectId} from '../../misc/validate.tool.js';

export const sanitize = {
	getByIdx: Joi.object({
		sessionId: Joi.string().custom(isValidObjectId).required()
			.messages({
				'any.invalid': 'Invalid session ID format',
				'any.required': 'Session ID is required'
			}),
		avatarIdx: Joi.number().required()
			.messages({
				'any.invalid': 'Invalid avatar ID format',
				'any.required': 'Avatar ID is required'
			}),
		fetchSession: Joi.boolean().optional(),
	}).required(),
	join: Joi.object({
		sessionId: Joi.string().custom(isValidObjectId).required()
			.messages({
				'any.invalid': 'Invalid session ID format',
				'any.required': 'Session ID is required'
			}),
		name: Joi.string().required()
			.messages({
				'any.required': 'Avatar name is required'
			}),
	}).required(),
	refresh: Joi.object({
		sessionId: Joi.string().custom(isValidObjectId).required()
			.messages({
				'any.invalid': 'Invalid session ID format',
				'any.required': 'Session ID is required'
			}),
		avatarIdx: Joi.number().required()
			.messages({
				'any.invalid': 'Invalid avatar ID format',
				'any.required': 'Avatar ID is required'
			}),
	}).required(),
	update: Joi.object({
		sessionId: Joi.string().custom(isValidObjectId).required()
			.messages({
				'any.invalid': 'Invalid session ID format',
				'any.required': 'Session ID is required'
			}),
		avatarIdx: Joi.number().required()
			.messages({
				'any.invalid': 'Invalid avatar ID format',
				'any.required': 'Avatar ID is required'
			}),
		updates: Joi.object({
			name: Joi.string().optional(),
			image: Joi.string().optional(),
			eyes: Joi.number().optional(),
			earrings: Joi.number().optional(),
			eyebrows: Joi.number().optional(),
			features: Joi.number().optional(),
			hair: Joi.number().optional(),
			glasses: Joi.number().optional(),
			mouth: Joi.number().optional(),
			skinColor: Joi.string().optional(),
			hairColor: Joi.string().optional(),
			earringsProbability: Joi.number().optional(),
			glassesProbability: Joi.number().optional(),
			featuresProbability: Joi.number().optional(),
			boardConf: Joi.string().allow('').optional(),
			boardColor: Joi.string().allow('').optional(),
		}).required(),
	}).required(),
	delete: Joi.object({
		sessionId: Joi.string().custom(isValidObjectId).required()
			.messages({
				'any.invalid': 'Invalid session ID format',
				'any.required': 'Session ID is required'
			}),
		avatarIdx: Joi.number().required()
			.messages({
				'any.invalid': 'Invalid avatar ID format',
				'any.required': 'Avatar ID is required'
			}),
	}).required()
};
