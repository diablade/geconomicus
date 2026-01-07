import SurveyService from './survey.service.js';
import socket from '#config/socket';
import log from '#config/log';
import { C } from '#constantes';

const SurveyController = {};

SurveyController.addFeedback = async (req, res, next) => {
    try {
        const {
            sessionId,
            gameStateId,
            avatarId
        } = req.body;
        let surveyFound = await SurveyService.getBySessionGameStateAvatarId(sessionId, gameStateId, avatarId);
        if (!surveyFound) {
            let newFeedback = await SurveyService.create(req.body);
            if (newFeedback && newFeedback._id) {
                socket.emitTo(gameStateId, C.NEW_FEEDBACK, newFeedback);
                return res.status(200).json(newFeedback);
            }
            else {
                return res.status(500).json({ message: "internal server error" });
            }
        }
        else {
            return res.status(409).json({ message: "ERROR.SURVEY_ALREADY_SUBMITTED" });
        }
    }
    catch (error) {
        log.error(error);
        return res.status(500).json({ message: "internal server error" + error });
    }
};
SurveyController.getBySessionId = async (req, res, next) => {
    try {
        let surveyFound = await SurveyService.getBySessionId(req.params.sessionId);
        if (!surveyFound) {
            return res.status(404).json({ message: "ERROR.NOT_FOUND" });
        }
        else {
            return res.status(200).json(surveyFound);
        }
    }
    catch (error) {
        log.error(error);
        return res.status(500).json({ message: "internal server error" + error });
    }
}
SurveyController.getByGameStateId = async (req, res, next) => {
    try {
        let surveyFound = await SurveyService.getByGameStateId(req.params.gameStateId);
        if (!surveyFound) {
            return res.status(404).json({ message: "ERROR.NOT_FOUND" });
        }
        else {
            return res.status(200).json(surveyFound);
        }
    }
    catch (error) {
        log.error(error);
        return res.status(500).json({ message: "internal server error" + error });
    }
}
SurveyController.getBySessionGameStateAvatarId = async (req, res, next) => {
    try {
        let surveyFound = await SurveyService.getBySessionGameStateAvatarId(req.params.sessionId, req.params.gameStateId, req.params.avatarId);
        if (!surveyFound) {
            return res.status(404).json({ message: "ERROR.NOT_FOUND" });
        }
        else {
            return res.status(200).json(surveyFound);
        }
    }
    catch (error) {
        log.error(error);
        return res.status(500).json({ message: "internal server error" + error });
    }
}
SurveyController.removeAllByGameStateId = async (req, res, next) => {
    const id = req.params.gameStateId;
    try {
        const result = await SurveyService.removeAllByGameStateId(id);
        if (result.deletedCount > 0) {
            return res.status(200).json(result);
        }
        else {
            return res.status(404).json({ message: "ERROR.NOT_FOUND" });
        }
    }
    catch (error) {
        log.error(error);
        return res.status(500).json({ message: "internal server error" + error });
    }
};
SurveyController.removeAllBySessionId = async (req, res, next) => {
    const id = req.params.sessionId;
    try {
        const result = await SurveyService.removeAllBySessionId(id);
        if (result.deletedCount > 0) {
            return res.status(200).json(result);
        }
        else {
            return res.status(404).json({ message: "ERROR.NOT_FOUND" });
        }
    }
    catch (error) {
        log.error(error);
        return res.status(500).json({ message: "internal server error" + error });
    }
}

export default SurveyController;
