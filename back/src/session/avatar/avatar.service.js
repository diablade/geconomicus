import SessionModel from './../session.model.js';

const AvatarService = {};

AvatarService.create = async (sessionId, name) => {
    let newAvatar = {
        name,
        image: "",
        eyes: 1,
        earrings: 1,
        eyebrows: 1,
        features: 1,
        hair: 1,
        glasses: 1,
        mouth: 1,
        skinColor: "",
        hairColor: "",
        earringsProbability: 100,
        glassesProbability: 100,
        featuresProbability: 100,
        boardConf: "",
        boardColor: "",
    };

    const session = await SessionModel.findOneAndUpdate(
        { _id: sessionId },
        [
            { $set: { avatarIndexSeq: { $add: ['$avatarIndexSeq', 1] } } },
            {
                $set: {
                    players: {
                        $concatArrays: [
                            '$players',
                            [{ idx: '$avatarIndexSeq', ...newAvatar }]
                        ]
                    }
                }
            }
        ],
        { returnDocument: 'after' }
    )
    const idx = session.avatarIndexSeq
    return {
        idx,
        ...newAvatar
    };

};

AvatarService.getByIdx = async (sessionId, avatarIdx) => {
    const session = await SessionModel.findOne({
        _id: sessionId,
        'players.idx': avatarIdx
    }, { 'players.$': 1 }).exec();
    return session?.players?.[0] ?? null;
};

AvatarService.update = async (sessionId, avatarIdx, updates) => {
    const set = {};
    for (const [key, value] of Object.entries(updates)) {
        set[`players.$.${key}`] = value;
    }
    const session = await SessionModel.findOneAndUpdate({
        _id: sessionId,
        'players.idx': avatarIdx
    }, { $set: set }, {
        runValidators: true,
        new: true
    });
    return session?.players?.[0] ?? null;
};

AvatarService.delete = async (sessionId, avatarIdx) => {
    return SessionModel.updateOne(
        {
            _id: sessionId,
            "players.idx": avatarIdx,
            $or: [
                { gamesRules: { $size: 0 } },
                { "gamesRules.gameStateId": { $exists: false } }
            ]
        },
        {
            $pull: { players: { idx: avatarIdx } }
        }
    );
};

export default AvatarService;
