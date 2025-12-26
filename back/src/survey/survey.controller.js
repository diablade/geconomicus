import SurveyService from './survey.service.js';
import socket from '../../config/socket.js';
import * as C from '../../../config/constantes.js';

const SurveyController = {};

SurveyController.getByGameStateIdAndAvatarId = async (req, res, next) => {
    try {
        let surveyFound = await SurveyService.getByGameStateIdAndAvatarId(req.params.gameStateId, req.params.avatarId);
        if (!surveyFound) {
            next({
                status: 404,
                message: "ERROR.NOT_FOUND"
            });
        }
        else {
            return res.json(surveyFound);
        }
    }
    catch (error) {
        next({
            status: 500,
            message: "internal server error" + error
        });
    }
}
SurveyController.getByGameStateId = async (req, res, next) => {
    try {
        let surveyFound = await SurveyService.getByGameStateId(req.params.gameStateId);
        if (!surveyFound) {
            next({
                status: 404,
                message: "ERROR.NOT_FOUND"
            });
        }
        else {
            return res.json(surveyFound);
        }
    }
    catch (error) {
        next({
            status: 500,
            message: "internal server error" + error
        });
    }
}
SurveyController.getBySessionId = async (req, res, next) => {
    try {
        let surveyFound = await SurveyService.getBySessionId(req.params.sessionId);
        if (!surveyFound) {
            next({
                status: 404,
                message: "ERROR.NOT_FOUND"
            });
        }
        else {
            return res.json(surveyFound);
        }
    }
    catch (error) {
        next({
            status: 500,
            message: "internal server error" + error
        });
    }
}
SurveyController.addFeedback = async (req, res, next) => {
    try {
        let surveyFound = await SurveyService.getByGameStateIdAndAvatarId(req.body.gameStateId, req.body.avatarId);
        if (!surveyFound) {
            let newSurvey = await SurveyService.create(req.body);
            if (newSurvey && newSurvey._id) {
                socket.emitTo(req.body.gameStateId, C.NEW_FEEDBACK);
                return res.status(200).json(newSurvey);
            }
            else {
                next({
                    status: 500,
                    message: "internal server error"
                });
            }
        }
        else {
            next({
                status: 409,
                message: "ERROR.SURVEY_ALREADY_EXISTS"
            });
        }
    }
    catch (error) {
        next({
            status: 500,
            message: "internal server error"
        });
    }
};
SurveyController.removeAllByGameStateId = async (req, res, next) => {
    const id = req.params.gameStateId;
    try {
        const result = await SurveyService.removeAllByGameStateId(id);
        if (result.deletedCount > 0) {
            return res.json(result);
        }
        else {
            next({
                status: 404,
                message: "ERROR.NOT_FOUND"
            });
        }
    }
    catch (error) {
        next({
            status: 500,
            message: "internal server error"
        });
    }
};
SurveyController.removeAllBySessionId = async (req, res, next) => {
    const id = req.params.sessionId;
    try {
        const result = await SurveyService.removeAllBySessionId(id);
        if (result.deletedCount > 0) {
            return res.json(result);
        }
        else {
            next({
                status: 404,
                message: "ERROR.NOT_FOUND"
            });
        }
    }
    catch (error) {
        next({
            status: 500,
            message: "internal server error" + error
        });
    }
}

export default SurveyController;
