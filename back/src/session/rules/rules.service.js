import SessionModel from './../session.model.js';
import { nanoId4 } from './../../misc/misc.tool.js';

const RulesService = {};

RulesService.create = async (sessionId, rules) => {
    let newGameRules = {
        id: nanoId4(), // gameStateId, to be populated once created in game state as game laodded ready to start
        ...rules
    };

    await SessionModel.updateOne({ _id: sessionId },
        { $push: { gamesRules: newGameRules } },
        { runValidators: true }).exec();
    return newGameRules;
};
RulesService.update = async (sessionId, ruleId, updates) => {
    const set = {};
    for (const [key, value] of Object.entries(updates)) {
        set[`gamesRules.$.${key}`] = value;
    }
    return await SessionModel.updateOne({
        _id: sessionId,
        'gamesRules.id': ruleId
    }, { $set: set }, { runValidators: true }).exec();
};
RulesService.getById = async (sessionId, ruleId) => {
    const session = await SessionModel.findOne({
        _id: sessionId,
        'gamesRules.id': ruleId
    }, { 'gamesRules.$': 1 }).exec();
    return session?.gamesRules?.[0] ?? null;
};
RulesService.updateGameStateId = async (sessionId, ruleId, gameStateId) => {
    return await SessionModel.updateOne({ _id: sessionId }, { $set: { 'gamesRules.$[rule].gameStateId': gameStateId } }, { arrayFilters: [{ 'rule.id': ruleId }], runValidators: true }).exec();
};
RulesService.removeById = async (sessionId, ruleId) => {
    return await SessionModel.updateOne({ _id: sessionId }, { $pull: { gamesRules: { id: ruleId } } }).exec();
};
RulesService.removeAllBySessionId = async (sessionId) => {
    return await SessionModel.updateOne({ _id: sessionId }, { $pull: { gamesRules: {} } }).exec();
};

export default RulesService;
