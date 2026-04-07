import SessionModel from './../session.model.js';
import { GAME_TYPE, GAME_STATUS } from '@geco/shared';

export const defaultDebtRules = {
	typeMoney: GAME_TYPE.DEBT,
    status: GAME_STATUS.NONE,
	priceWeight1: 1,
	priceWeight2: 2,
	priceWeight3: 4,
	priceWeight4: 8,
};
export const defaultJuneRules = {
	typeMoney: GAME_TYPE.JUNE,
    status: GAME_STATUS.NONE,
	priceWeight1: 3,
	priceWeight2: 6,
	priceWeight3: 9,
	priceWeight4: 12,
};

const RulesService = {};

RulesService.create = async (sessionId, rules) => {
	const session = await SessionModel.findOneAndUpdate(
		{ _id: sessionId },
		[
			{ $set: { rulesIndexSeq: { $ifNull: ['$rulesIndexSeq', 0] } } },
			{ $set: { rulesIndexSeq: { $add: ['$rulesIndexSeq', 1] } } },
			{
				$set: {
					gamesRules: {
						$concatArrays: [{ $ifNull: ['$gamesRules', []] }, [{ idx: '$rulesIndexSeq', ...rules }]],
					},
				},
			},
		],
		{
			new: true,
			runValidators: true,
		}
	);

	const idx = session.rulesIndexSeq;

	return {
		idx,
		...rules,
	};
};
RulesService.update = async (sessionId, ruleIdx, updates) => {
	const set = {};
	for (const [key, value] of Object.entries(updates)) {
		set[`gamesRules.$.${key}`] = value;
	}
	return await SessionModel.updateOne(
		{
			_id: sessionId,
			'gamesRules.idx': ruleIdx,
		},
		{ $set: set },
		{ runValidators: true }
	).exec();
};
RulesService.resetDefault = async (sessionId, ruleIdx) => {
	const result = await SessionModel.findOneAndUpdate(
		{
			_id: sessionId,
			'gamesRules.idx': ruleIdx,
		},
		[
			{
				$set: {
					gamesRules: {
						$map: {
							input: '$gamesRules',
							as: 'rule',
							in: {
								$cond: {
									if: { $eq: ['$$rule.idx', ruleIdx] },
									then: {
										$cond: {
											if: { $eq: ['$$rule.typeMoney', GAME_TYPE.JUNE] },
											then: { ...defaultJuneRules, idx: ruleIdx },
											else: { ...defaultDebtRules, idx: ruleIdx },
										},
									},
									else: '$$rule',
								},
							},
						},
					},
				},
			},
		],
		{
			new: true,
			runValidators: true,
		}
	).exec();
	return result.gamesRules.find((rule) => rule.idx === ruleIdx);
};
RulesService.getByIdx = async (sessionId, ruleIdx) => {
	const session = await SessionModel.findOne(
		{
			_id: sessionId,
			'gamesRules.idx': ruleIdx,
		},
		{ 'gamesRules.$': 1 }
	).exec();
	return session?.gamesRules?.[0] ?? null;
};
RulesService.updateFromCreatedGameStateId = async (sessionId, ruleIdx, gameStateId) => {
	const result = await SessionModel.updateOne(
		{ _id: sessionId },
		{
			$set: {
				'gamesRules.$[rule].gameStateId': gameStateId,
				'gamesRules.$[rule].gameStatus': GAME_STATUS.CREATED,
			},
		},
		{
			arrayFilters: [{ 'rule.idx': ruleIdx }],
			runValidators: true,
		}
	).exec();
	return result;
};
RulesService.removeByIdx = async (sessionId, ruleIdx) => {
	return await SessionModel.updateOne({ _id: sessionId }, { $pull: { gamesRules: { idx: ruleIdx } } }).exec();
};
RulesService.removeAllBySessionId = async (sessionId) => {
	return await SessionModel.updateOne({ _id: sessionId }, { $pull: { gamesRules: {} } }).exec();
};

export default RulesService;
