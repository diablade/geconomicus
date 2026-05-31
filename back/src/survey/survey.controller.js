import SurveyService from './survey.service.js';
import socket from '#config/socket';
import log from '#config/log';
import { IO, ROOMS } from '@geco/shared';

const SurveyController = {};

SurveyController.addFeedback = async (req, res, next) => {
	try {
		const { sessionId, gameStateId, avatarIdx } = req.body;
		let surveyFound = await SurveyService.getBySessionGameStateAvatarIdx(sessionId, gameStateId, avatarIdx);
		if (!surveyFound) {
			log.info(`adding new feedback for game state ${gameStateId}, avatar ${avatarIdx}`);
			let newFeedback = await SurveyService.create(req.body);
			if (newFeedback && newFeedback._id) {
				socket.emitTo(ROOMS.gameState(gameStateId), IO.SESSION.NEW_FEEDBACK, {
					sessionId,
					gameStateId,
					avatarIdx,
				});
				return res.status(200).json(newFeedback);
			} else {
				return res.status(500).json({ message: 'internal server error' });
			}
		} else {
			log.info(`updating feedback for game state ${gameStateId}, avatar ${avatarIdx}`);
			await SurveyService.update(surveyFound._id, req.body);
			return res.status(200).json({ message: 'Feedback updated successfully' });
		}
	} catch (error) {
		log.error(error);
		return res.status(500).json({ message: 'internal server error' + error });
	}
};
SurveyController.allowAvatarEditSurvey = async (req, res, next) => {
	try {
		const { sessionId, avatarIdx } = req.body;
		socket.emitAckTo(ROOMS.lobbyAvatar(sessionId, avatarIdx), IO.AVATAR.SURVEY_REDO, {
			sessionId,
			avatarIdx,
		});
		return res.status(200).json({ status: 'ok' });
	} catch (err) {
		log.error(`Session allow avatar edit survey error: ${err}`);
		return res.status(500).json({
			message: 'ERROR.ALLOW_AVATAR_EDIT_SURVEY',
		});
	}
};
SurveyController.getBySessionId = async (req, res, next) => {
	try {
		let surveyFound = await SurveyService.getBySessionId(req.params.sessionId);
		if (!surveyFound) {
			return res.status(404).json({ message: 'ERROR.NOT_FOUND' });
		} else {
			return res.status(200).json(surveyFound);
		}
	} catch (error) {
		log.error(error);
		return res.status(500).json({ message: 'internal server error' + error });
	}
};
SurveyController.getByGameStateId = async (req, res, next) => {
	try {
		let surveyFound = await SurveyService.getByGameStateId(req.params.gameStateId);
		if (!surveyFound) {
			return res.status(404).json({ message: 'ERROR.NOT_FOUND' });
		} else {
			return res.status(200).json(surveyFound);
		}
	} catch (error) {
		log.error(error);
		return res.status(500).json({ message: 'internal server error' + error });
	}
};
SurveyController.getBySessionGameStateAvatarIdx = async (req, res, next) => {
	try {
		log.info('getting survey by session game state avatar idx');
		let surveyFound = await SurveyService.getBySessionGameStateAvatarIdx(
			req.params.sessionId,
			req.params.gameStateId,
			req.params.avatarIdx
		);
		if (!surveyFound) {
			log.info('survey not found');
			return res.status(404).json({ message: 'ERROR.NOT_FOUND' });
		} else {
			log.info('survey found');
			return res.status(200).json(surveyFound);
		}
	} catch (error) {
		log.error(error);
		return res.status(500).json({ message: 'internal server error' + error });
	}
};
SurveyController.removeAllByGameStateId = async (req, res, next) => {
	const id = req.params.gameStateId;
	try {
		const result = await SurveyService.removeAllByGameStateId(id);
		if (result.deletedCount > 0) {
			return res.status(200).json(result);
		} else {
			return res.status(404).json({ message: 'ERROR.NOT_FOUND' });
		}
	} catch (error) {
		log.error(error);
		return res.status(500).json({ message: 'internal server error' + error });
	}
};
SurveyController.removeAllBySessionId = async (req, res, next) => {
	const id = req.params.sessionId;
	try {
		const result = await SurveyService.removeAllBySessionId(id);
		if (result.deletedCount > 0) {
			return res.status(200).json(result);
		} else {
			return res.status(404).json({ message: 'ERROR.NOT_FOUND' });
		}
	} catch (error) {
		log.error(error);
		return res.status(500).json({ message: 'internal server error' + error });
	}
};

export default SurveyController;
