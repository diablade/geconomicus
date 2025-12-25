import AvatarModel from './avatar.schema.js';
import SessionModel from './../session.schema.js';
import { nanoid } from 'nanoid';

RulesModel.create = async (sessionId, rules) => {
    let newGameRules = RulesModel({
        id: nanoid(),
        // gameStateId: "", to be populated once created in game state as game laodded ready to start
        ...rules
    });

    await SessionModel.updateOne({ _id: sessionId }, { $push: { gamesRules: newGameRules } }).exec();
    return newGameRules;
};
RulesModel.update = async (sessionId, ruleId, updates) => {
    return await SessionModel.updateOne({
        _id: sessionId,
        'gamesRules.id': ruleId
    }, { $set: { 'gamesRules.$': updates } }).exec();
};
RulesModel.getById = async (sessionId, ruleId) => {
    return await SessionModel.findOne({
        _id: sessionId,
        'gamesRules.id': ruleId
    }).exec();
};

RulesModel.removeById = async (sessionId, ruleId) => {
    return await SessionModel.updateOne({ _id: sessionId }, { $pull: { gamesRules: { id: ruleId } } }).exec();
};
RulesModel.removeAllBySessionId = async (sessionId) => {
    return await SessionModel.updateOne({ _id: sessionId }, { $pull: { gamesRules: {} } }).exec();
};

export default RulesModel;
