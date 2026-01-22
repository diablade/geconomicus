import SessionModel from './../session.model.js';

const RulesService = {};

RulesService.create = async (sessionId, rules) => {
    const session = await SessionModel.findOneAndUpdate(
        { _id: sessionId },
        [
            { $set: { rulesIndexSeq: { $add: ['$rulesIndexSeq', 1] } } },
            {
                $set: {
                    gamesRules: {
                        $concatArrays: [
                            '$gamesRules',
                            [{ idx: '$rulesIndexSeq', ...rules }]
                        ]
                    }
                }
            }
        ],
        { returnDocument: 'after' }
    )

    const idx = session.rulesIndexSeq

    return {
        idx,
        ...rules
    };
};
RulesService.update = async (sessionId, ruleIdx, updates) => {
    const set = {};
    for (const [key, value] of Object.entries(updates)) {
        set[`gamesRules.$.${key}`] = value;
    }
    return await SessionModel.updateOne({
        _id: sessionId,
        'gamesRules.idx': ruleIdx
    }, { $set: set }, { runValidators: true }).exec();
};
RulesService.getByIdx = async (sessionId, ruleIdx) => {
    const session = await SessionModel.findOne({
        _id: sessionId,
        'gamesRules.idx': ruleIdx
    }, { 'gamesRules.$': 1 }).exec();
    return session?.gamesRules?.[0] ?? null;
};
RulesService.updateGameStateId = async (sessionId, ruleIdx, gameStateId) => {
    return await SessionModel.updateOne({ _id: sessionId }, { $set: { 'gamesRules.$[rule].gameStateId': gameStateId } }, { arrayFilters: [{ 'rule.idx': ruleIdx }], runValidators: true }).exec();
};
RulesService.removeByIdx = async (sessionId, ruleIdx) => {
    return await SessionModel.updateOne({ _id: sessionId }, { $pull: { gamesRules: { idx: ruleIdx } } }).exec();
};
RulesService.removeAllBySessionId = async (sessionId) => {
    return await SessionModel.updateOne({ _id: sessionId }, { $pull: { gamesRules: {} } }).exec();
};

export default RulesService;
