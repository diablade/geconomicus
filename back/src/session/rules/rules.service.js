import SessionModel from './../session.model.js';
import { GAME_TYPE, GAME_STATUS } from '@geco/shared';
import log from '#config/log';

export const defaultDebtRules = {
	typeMoney: GAME_TYPE.DEBT,
	gameStatus: GAME_STATUS.NONE,
	priceWeight1: 1,
	priceWeight2: 2,
	priceWeight3: 4,
	priceWeight4: 8,
};
export const defaultJuneRules = {
	typeMoney: GAME_TYPE.JUNE,
	gameStatus: GAME_STATUS.NONE,
	priceWeight1: 3,
	priceWeight2: 6,
	priceWeight3: 9,
	priceWeight4: 12,
};

const RulesService = {};

RulesService.create = async (sessionId, rules) => {
	log.debug(`[RulesService] create: Creating rules for session ${sessionId}`);
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
	log.debug(`[RulesService] update: Updating rules for session ${sessionId}, ruleIdx: ${ruleIdx}`);
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
RulesService.updateGameStateId = async (sessionId, ruleIdx, gameStateId) => {
	log.debug(`[RulesService] Updating game state id ${gameStateId} in rules of session ${sessionId}, ruleIdx: ${ruleIdx}`);
	// only for optimisation, to avoid querying the session to get the game state id
	// await RulesService.updateGameStateStatus(
	// 	gameState.sessionId,
	// 	gameState.ruleIdx,
	// 	body.gameStateId,
	// 	GAME_STATUS.INITIALIZED
	// );
	const result = await SessionModel.updateOne(
		{ _id: sessionId },
		{
			$set: {
				'gamesRules.$[rule].gameStateId': gameStateId,
				// 'gamesRules.$[rule].status': status, // TODO: uncomment when status is needed in rules
			},
		},
		{
			arrayFilters: [{ 'rule.idx': ruleIdx }],
			new: true,
			runValidators: true,
		}
	).lean();
	return result;
};
RulesService.removeByIdx = async (sessionId, ruleIdx) => {
	return await SessionModel.updateOne({ _id: sessionId }, { $pull: { gamesRules: { idx: ruleIdx } } }).exec();
};
RulesService.removeAllBySessionId = async (sessionId) => {
	return await SessionModel.updateOne({ _id: sessionId }, { $pull: { gamesRules: {} } }).exec();
};

export default RulesService;
