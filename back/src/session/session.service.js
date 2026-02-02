import SessionModel from './session.model.js';
import {nanoId4} from "../misc/misc.tool.js";
import C from "../../shared/constantes.mjs";
import log from "#config/log";

const SessionService = {};

/* Create */
SessionService.create = async (sessionObject) => {
    const newSession = new SessionModel({
        name:     sessionObject.name || '',
        animator: sessionObject.animator || '',
        location: sessionObject.location || '',
        devMode:  sessionObject.devMode || false,
        theme:    sessionObject.theme || 'CLASSIC',
        shortId:  nanoId4()
    });
    return newSession.save();
};

/* Retrieve */
SessionService.getById = async (id) => {
    return SessionModel.findById(id).exec();
};
SessionService.getByShortId = async (shortId) => {
    return SessionModel.findOne({shortId}).exec();
};
SessionService.getAll = async () => {
    //TODO pagination  one day and with filters in req
    //and aggregate with status of gamesState
    return SessionModel.aggregate([
        {
            $project: {
                name:            1,
                animator:        1,
                location:        1,
                theme:           1,
                devMode:         1,
                shortId:         1,
                status:          1,
                modifiedAt:      1,
                createdAt:       1,
                gamesRulesCount: {
                    $size: "$gamesRules"
                },
                playersCount:    {
                    $size: "$players"
                },
            },
        },
    ]).sort({createdAt: 1});
};
SessionService.start = async (sessionId) => {
    log.info("Session.start:", sessionId);
    const rulesDebt = {
        typeMoney:    C.DEBT,
        gameStatus:   C.CREATED,
        priceWeight1: 1,
        priceWeight2: 2,
        priceWeight3: 4,
        priceWeight4: 8,
    };
    const rulesJune = {
        typeMoney:    C.JUNE,
        gameStatus:   C.CREATED,
        priceWeight1: 3,
        priceWeight2: 6,
        priceWeight3: 9,
        priceWeight4: 12,
    };
    const session = await SessionModel.findOneAndUpdate({_id: sessionId}, [
        {$set: {status: C.IN_PROGRESS}}, {$set: {rulesIndexSeq: {$ifNull: ['$rulesIndexSeq', 0]}}},

        // Debt
        {$set: {rulesIndexSeq: {$add: ['$rulesIndexSeq', 1]}}},
        {$set: {gamesRules: {$concatArrays: [{$ifNull: ['$gamesRules', []]}, [{idx: '$rulesIndexSeq', ...rulesDebt}]]}}},

        // June
        {$set: {rulesIndexSeq: {$add: ['$rulesIndexSeq', 1]}}}, {$set: {gamesRules: {$concatArrays: ['$gamesRules', [{idx: '$rulesIndexSeq', ...rulesJune}]]}}}
    ], {
        new:           true,
        runValidators: true
    });
    return session;
};

/* Update */
SessionService.update = async (sessionId, updates) => {
    delete updates.gamesRules;
    delete updates.players;
    const set = {};
    for (const [key, value] of Object.entries(updates)) {
        set[key] = value;
    }
    return SessionModel.updateOne({_id: sessionId}, {$set: set}, {runValidators: true}).exec();
};

/* Remove */
SessionService.delete = async (sessionId) => {
    return SessionModel.findByIdAndDelete(sessionId).exec();
};

export default SessionService;
