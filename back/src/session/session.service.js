import SessionModel from './session.model.js';
import { nanoId4 } from "../misc/misc.tool.js";

const SessionService = {};

/* Create */
SessionService.create = async (sessionObject) => {
    const newSession = new SessionModel({
        name: sessionObject.name || '',
        animator: sessionObject.animator || '',
        location: sessionObject.location || '',
        shortId: nanoId4(), // devMode: sessionObject.devMode || false,
        // theme: sessionObject.theme || 'CLASSIC',
        // gamesRules: sessionObject.gamesRules || [],
        // players: sessionObject.players || [],
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
    //and aggregate with status of gamesState
    return await SessionModel.aggregate([
        {
            $project: {
                name: 1,
                animator: 1,
                location: 1,
                modifiedAt: 1,
                createdAt: 1,
                gamesRulesCount: {
                    $size: "$gamesRules"
                },
                playersCount: {
                    $size: "$players"
                },
            },
        },
    ])
        .exec();
    // return await SessionModel.find({}).sort({ createdAt: 1 }).exec();
};

/* Update */
SessionService.update = async (sessionId, updates) => {
    delete updates.gamesRules;
    delete updates.players;
    return await SessionModel.updateOne({ _id: sessionId }, { $set: updates }).exec();
};

/* Remove */
SessionService.delete = async (sessionId) => {
    return await SessionModel.findByIdAndDelete(sessionId).exec();
};

export default SessionService;
