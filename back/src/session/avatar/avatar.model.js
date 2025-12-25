import AvatarModel from './avatar.schema.js';
import SessionModel from './../session.schema.js';

/* Create */
AvatarModel.create = async (sessionId, nanoId, name) => {
    let newAvatar = AvatarModel({
        id: nanoId,
        name: name,
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
    });
    return await SessionModel.updateOne({ _id: sessionId }, { $push: { avatars: newAvatar } }).exec();
};

/* Retrieve */
AvatarModel.getById = async (sessionId, avatarId) => {
    return await SessionModel.findOne({
        _id: sessionId,
        'avatars.id': avatarId
    }).exec();
};

/* Update */
AvatarModel.update = async (sessionId, avatarId, updates) => {
    return await SessionModel.updateOne({
        _id: sessionId,
        'avatars.id': avatarId
    }, { $set: { 'avatars.$': updates } }).exec();
};

/* Remove */
AvatarModel.removeById = async (sessionId, avatarId) => {
    return await SessionModel.findOneAndUpdate({
        _id: sessionId,
        "avatars.id": avatarId,
        gamesRules: { $size: 0 }
    }, {
        $pull: { avatars: { id: avatarId } }
    }, { new: true });
};
AvatarModel.removeAllBySessionId = async (sessionId, avatarId) => {
    return await SessionModel.updateOne({ _id: sessionId }, { $pull: { avatars: { id: avatarId } } }).exec();
};

export default AvatarModel;
