import SessionModel from './session.model.js';
import { numbersId4 } from '../misc/misc.tool.js';
import { SESSION_STATUS } from '@geco/shared';
import log from '#config/log';
import { defaultDebtRules, defaultJuneRules } from './rules/rules.service.js';

const populateStatusForGameRules = async (session) => {
	const populatedSession = await session.populate({
		path: 'gamesRules.gameStateId',
		select: 'status',
	});

	// Convertir en objet plain et remapper
	const sessionObj = populatedSession.toObject();
	sessionObj.gamesRules = sessionObj.gamesRules.map((rule) => ({
		...rule,
		gameStateId: rule.gameStateId?._id ?? rule.gameStateId,
		gameStatus: rule.gameStateId?.status ?? rule.gameStatus,
	}));
	log.debug(
		`[SessionService] getById populated: ${sessionObj.gamesRules[0].gameStatus}, ${sessionObj.gamesRules[1].gameStatus}`
	);
	return sessionObj;
};

const SessionService = {};

/* Create */
SessionService.create = async (sessionObject) => {
	const newSession = new SessionModel({
		name: sessionObject.name || '',
		animator: sessionObject.animator || '',
		location: sessionObject.location || '',
		devMode: sessionObject.devMode || false,
		theme: sessionObject.theme || 'CLASSIC',
		shortId: numbersId4(),
	});
	return newSession.save();
};

/* Retrieve */
SessionService.getById = async (id, tryPopulate = false) => {
	log.debug(`[SessionService] getById tryPopulate: ${tryPopulate}`);
	const session = await SessionModel.findById(id).exec();
	if (!session || session.gamesRules.length === 0) {
		log.debug(`[SessionService] getById no game states found for session: ${id}`);
		return session;
	}
	if (session.gamesRules.every((gameRule) => !gameRule.gameStateId)) {
		log.debug(`[SessionService] getById game states yet not created for session: ${id}`);
		return session;
	}
	if (tryPopulate) {
		return populateStatusForGameRules(session);
	}
	return session;
};
SessionService.getByShortId = async (shortId) => {
	return SessionModel.findOne({ shortId, status: SESSION_STATUS.OPEN }).exec();
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
				devMode: 1,
				shortId: 1,
				status: 1,
				modifiedAt: 1,
				createdAt: 1,
				gamesRulesCount: {
					$size: '$gamesRules',
				},
				avatarsCount: {
					$size: '$avatars',
				},
			},
		},
	]).sort({ createdAt: 1 });
};
SessionService.start = async (sessionId) => {
	log.info(`[SessionService] start: ${sessionId}`);

	const session = await SessionModel.findOneAndUpdate(
		{ _id: sessionId },
		[
			{ $set: { status: SESSION_STATUS.IN_PROGRESS } },
			{ $set: { rulesIndexSeq: { $ifNull: ['$rulesIndexSeq', 0] } } },

			// Debt
			{ $set: { rulesIndexSeq: { $add: ['$rulesIndexSeq', 1] } } },
			{
				$set: {
					gamesRules: {
						$concatArrays: [
							{ $ifNull: ['$gamesRules', []] },
							[{ idx: '$rulesIndexSeq', ...defaultDebtRules }],
						],
					},
				},
			},

			// June
			{ $set: { rulesIndexSeq: { $add: ['$rulesIndexSeq', 1] } } },
			{
				$set: {
					gamesRules: { $concatArrays: ['$gamesRules', [{ idx: '$rulesIndexSeq', ...defaultJuneRules }]] },
				},
			},
		],
		{
			new: true,
			runValidators: true,
		}
	);
	return session;
};

/* Update */
SessionService.update = async (sessionId, updates) => {
	delete updates.gamesRules;
	delete updates.avatars;
	const set = {};
	for (const [key, value] of Object.entries(updates)) {
		set[key] = value;
	}
	const session = await SessionModel.findOneAndUpdate(
		{ _id: sessionId },
		{ $set: set },
		{ new: true, runValidators: true }
	);
	return populateStatusForGameRules(session);
};

/* Remove */
SessionService.delete = async (sessionId) => {
	return SessionModel.findByIdAndDelete(sessionId).exec();
};

export default SessionService;
