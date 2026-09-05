import SessionModel from './session.model.js';
import { numbersId4 } from '../misc/misc.tool.js';
import { SESSION_STATUS, GAME_STATUS } from '@geco/shared';
import log from '#config/log';
import { defaultDebtRules, defaultJuneRules } from './rules/rules.service.js';

const withGameStatus = (sessionObj) => {
	sessionObj.gamesRules = sessionObj.gamesRules.map((rule) => ({
		...rule,
		gameStateId: rule?.gameStateId?._id ?? rule?.gameStateId,
		gameStatus: rule?.gameStateId?.status ?? GAME_STATUS.NONE,
	}));
	return sessionObj;
};

const populateStatusForGameRules = async (session) => {
	const populatedSession = await session.populate({
		path: 'gamesRules.gameStateId',
		select: 'status',
	});

	// Convertir en objet plain et remapper
	const sessionObj = withGameStatus(populatedSession.toObject());
	log.debug(
		`[SessionService] getById populated: ${sessionObj.gamesRules[0]?.gameStatus}, ${sessionObj.gamesRules[1]?.gameStatus}`
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
	if (!session || session.gamesRules.length === 0 || !tryPopulate) {
		log.debug(`[SessionService] getById returned without game status for session: ${id}`);
		return session;
	}
	if (session.gamesRules.every((gameRule) => !gameRule.gameStateId)) {
		log.debug(`[SessionService] getById game states yet not created for session: ${id}`);
		return withGameStatus(session.toObject());
	}
	return populateStatusForGameRules(session);
};
SessionService.getByShortId = async (shortId) => {
	return SessionModel.findOne({ shortId, status: { $ne: SESSION_STATUS.ENDED } }).exec();
};

SessionService.getAvatarsBySessionId = async (sessionId) => {
	return SessionModel.find({ _id: sessionId }).select('avatars').exec();
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

	const session = await SessionModel.findById(sessionId).exec();
	if (!session) {
		return null;
	}
	session.status = SESSION_STATUS.IN_PROGRESS;
	if (session.gamesRules.length === 0) {
		session.gamesRules.push({ ...defaultDebtRules, idx: session.rulesIndexSeq + 1 });
		session.gamesRules.push({ ...defaultJuneRules, idx: session.rulesIndexSeq + 2 });
		session.rulesIndexSeq += 2;
	}
	await session.save({ validateModifiedOnly: true });
	return populateStatusForGameRules(session);
};

/** Puts a started session back to OPEN so new avatars can join again. */
SessionService.reopen = async (sessionId) => {
	log.info(`[SessionService] reopen: ${sessionId}`);

	const session = await SessionModel.findById(sessionId).exec();
	if (!session) {
		return null;
	}
	session.status = SESSION_STATUS.OPEN;
	await session.save({ validateModifiedOnly: true });
	return populateStatusForGameRules(session);
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
