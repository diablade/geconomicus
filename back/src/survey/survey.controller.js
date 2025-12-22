import SurveyModel from './survey.model.js';
import socket from '../../config/socket.js';
import * as C from '../../../config/constantes.js';

const SurveyController = {};

SurveyController.getByGameIdAndPlayerId = async (req, res, next) => {
    try {
        let surveyFound = await SurveyModel.getByGameIdAndPlayerId(req.params.gameId, req.params.playerId);
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
SurveyController.getByGameId = async (req, res, next) => {
    try {
        let surveyFound = await SurveyModel.getByGameId(req.params.gameId);
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
        let surveyFound = await SurveyModel.getBySessionId(req.params.sessionId);
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
        let surveyFound = await SurveyModel.getByGameIdAndPlayerId(req.body.gameId, req.body.playerId);
        if (!surveyFound) {
            let newSurvey = await SurveyModel.createNew(req.body);
            if (newSurvey && newSurvey._id) {
                socket.emitTo(req.body.gameId, C.NEW_FEEDBACK);
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

SurveyController.removeByGameId = async (req, res, next) => {
    const id = req.params.gameId;
    try {
        const result = await SurveyModel.removeByGameId(id);
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
SurveyController.removeBySessionId = async (req, res, next) => {
    const id = req.params.sessionId;
    try {
        const result = await SurveyModel.removeBySessionId(id);
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
