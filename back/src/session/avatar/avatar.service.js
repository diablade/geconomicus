import SessionModel from './../session.model.js';

const AvatarService = {};

AvatarService.create = async (sessionId, name) => {
    let newAvatar = {
        name,
        image:               "",
        eyes:                1,
        earrings:            1,
        eyebrows:            1,
        features:            1,
        hair:                1,
        glasses:             1,
        mouth:               1,
        skinColor:           "",
        hairColor:           "",
        earringsProbability: 100,
        glassesProbability:  100,
        featuresProbability: 100,
        boardConf:           "wood",
        boardColor:          "",
    };

    const session = await SessionModel.findOneAndUpdate({_id: sessionId}, [
        {$set: {avatarIndexSeq: {$add: ['$avatarIndexSeq', 1]}}}, {
            $set: {
                avatars: {
                    $concatArrays: [
                        '$avatars', [{idx: '$avatarIndexSeq', ...newAvatar}]
                    ]
                }
            }
        }
    ], {returnDocument: 'after'})
    const idx = session.avatarIndexSeq
    return {
        idx, ...newAvatar
    };

};

AvatarService.getByIdx = async (sessionId, avatarIdx, fetchSession) => {
    const session = await SessionModel.findOne({
        _id:           sessionId,
        'avatars.idx': Number(avatarIdx)
    }).lean();
    const avatar = session?.avatars?.find(p => p.idx === Number(avatarIdx)) ?? null;
    delete session.avatars;
    if (fetchSession) {
        return {
            avatar:  avatar,
            session: session
        };
    }
    return {
        avatar: avatar
    };
};

AvatarService.update = async (sessionId, avatarIdx, updates) => {
    const s = SessionModel.find({}).lean();
    const set = {};
    for (const [key, value] of Object.entries(updates)) {
        set[`avatars.$.${key}`] = value;
    }
    const session = await SessionModel.findOneAndUpdate({
        _id:           sessionId,
        'avatars.idx': Number(avatarIdx)
    }, {$set: set}, {
        runValidators: true,
        new:           true
    });
    return session?.avatars?.find(p => p.idx === Number(avatarIdx)) ?? null;
};

AvatarService.delete = async (sessionId, avatarIdx) => {
    return SessionModel.updateOne({
        _id:           sessionId,
        "avatars.idx": Number(avatarIdx),
        $or:           [
            {gamesRules: {$size: 0}}, {"gamesRules.gameStateId": {$exists: false}}
        ]
    }, {
        $pull: {avatars: {idx: avatarIdx}}
    });
};

export default AvatarService;
