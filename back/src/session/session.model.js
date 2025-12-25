import SessionModel from './session.schema.js';

/* Create */
SessionModel.create = async (sessionObject) => {
    const newSession = new SessionModel({
        name: sessionObject.name || '',
        animator: sessionObject.animator || '',
        location: sessionObject.location || '',
        shortId: sessionObject.shortId || '',
        devMode: sessionObject.devMode || '',
        theme: sessionObject.theme || '',
        gamesRules: sessionObject.gamesRules || [],
        players: sessionObject.players || [],
    });
    return await newSession.save();
};

/* Retrieve */
SessionModel.getById = async (id) => {
    return await SessionModel.findById(id).exec();
};
SessionModel.getByShortId = async (shortId) => {
    return await SessionModel.findOne({ shortId }).exec();
};
SessionModel.getAll = async () => {
    //TODO pagination  one day and with filters in req 
    return await SessionModel.find({}).sort({ createdAt: 1 }).exec();
};

/* Update */
SessionModel.update = async (id, updates) => {
    delete updates.gamesRules;
    delete updates.players;
    return await SessionModel.updateOne({ _id: id }, { $set: updates }).exec();
};

/* Remove */
SessionModel.delete = async (id) => {
    return await SessionModel.findByIdAndDelete(id).exec();
};

export default SessionModel;
