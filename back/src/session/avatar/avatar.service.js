import SessionModel from './../session.model.js';

const AvatarService = {};

AvatarService.create = async (sessionId, nanoId, name) => {
    let newAvatar = {
        id: nanoId,
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
    return SessionModel.updateOne({ _id: sessionId }, { $push: { players: newAvatar } }, { runValidators: true }).exec();
};

AvatarService.getById = async (sessionId, avatarId) => {
    const session = await SessionModel.findOne({
        _id: sessionId,
        'players.id': avatarId
    }, { 'players.$': 1 }).exec();
    return session?.players?.[0] ?? null;
};

AvatarService.update = async (sessionId, avatarId, updates) => {
    const set = {};
    for (const [key, value] of Object.entries(updates)) {
        set[`players.$.${key}`] = value;
    }
    const session = await SessionModel.findOneAndUpdate({
        _id: sessionId,
        'players.id': avatarId
    }, { $set: set }, {
        runValidators: true,
        new: true
    });
    return session?.players?.[0] ?? null;
};

AvatarService.delete = async (sessionId, avatarId) => {
    return SessionModel.updateOne({
        _id: sessionId,
        "players.id": avatarId,
        gamesRules: { $size: 0 }
    }, { $pull: { players: { id: avatarId } } });
};

export default AvatarService;
