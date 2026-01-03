import SessionModel from './session.model.js';
import { nanoId4 } from "../misc/misc.tool.js";

const SessionService = {};

/* Create */
SessionService.create = async (sessionObject) => {
    const newSession = new SessionModel({
        name: sessionObject.name || '',
        animator: sessionObject.animator || '',
        location: sessionObject.location || '',
        devMode: sessionObject.devMode || false,
        theme: sessionObject.theme || 'CLASSIC',
        shortId: nanoId4()
    });
    return newSession.save();
};

/* Retrieve */
SessionService.getById = async (id) => {
    return SessionModel.findById(id).exec();
};
SessionService.getByShortId = async (shortId) => {
    return SessionModel.findOne({ shortId }).exec();
};
SessionService.getAll = async () => {
    //TODO pagination  one day and with filters in req
    //and aggregate with status of gamesState
    return SessionModel.aggregate([
        {
            $project: {
                name: 1,
                animator: 1,
                location: 1,
                theme: 1,
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
    ]).sort({ createdAt: 1 });
};

/* Update */
SessionService.update = async (sessionId, updates) => {
    delete updates.gamesRules;
    delete updates.players;
    const set = {};
    for (const [key, value] of Object.entries(updates)) {
        set[key] = value;
    }
    return SessionModel.updateOne({ _id: sessionId }, { $set: set }, { runValidators: true }).exec();
};

/* Remove */
SessionService.delete = async (sessionId) => {
    return SessionModel.findByIdAndDelete(sessionId).exec();
};

export default SessionService;
