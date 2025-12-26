import SessionModel from './session.model.js';

const SessionService = {};

/* Create */
SessionService.create = async (sessionObject) => {
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
SessionService.getById = async (id) => {
    return await SessionModel.findById(id).exec();
};
SessionService.getByShortId = async (shortId) => {
    return await SessionModel.findOne({ shortId }).exec();
};
SessionService.getAll = async () => {
    //TODO pagination  one day and with filters in req 
    return await SessionModel.find({}).sort({ createdAt: 1 }).exec();
};

/* Update */
SessionService.update = async (id, updates) => {
    delete updates.gamesRules;
    delete updates.players;
    return await SessionModel.updateOne({ _id: id }, { $set: updates }).exec();
};

/* Remove */
SessionService.delete = async (id) => {
    return await SessionModel.findByIdAndDelete(id).exec();
};

export default SessionService;
