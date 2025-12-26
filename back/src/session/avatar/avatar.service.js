import SessionModel from './../session.schema.js';

/* Create */
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
    return await SessionModel.updateOne({ _id: sessionId }, { $push: { avatars: newAvatar } }, { runValidators: true }).exec();
};

/* Retrieve */
AvatarService.getById = async (sessionId, avatarId) => {
    return await SessionModel.findOne({
        _id: sessionId,
        'avatars.id': avatarId
    }).exec();
};

/* Update */
AvatarService.update = async (sessionId, avatarId, updates) => {
    return await SessionModel.updateOne({
        _id: sessionId,
        'avatars.id': avatarId
    }, { $set: { 'avatars.$': updates } }, { runValidators: true }).exec();
};

/* Remove */
AvatarService.removeById = async (sessionId, avatarId) => {
    return await SessionModel.findOneAndUpdate({
        _id: sessionId,
        "avatars.id": avatarId,
        gamesRules: { $size: 0 }
    }, {
        $pull: { avatars: { id: avatarId } }
    }, { new: true });
};
AvatarService.removeAllBySessionId = async (sessionId) => {
    return await SessionModel.updateOne({ _id: sessionId }, { $pull: { avatars: { id: avatarId } } }).exec();
};

export default AvatarService;
