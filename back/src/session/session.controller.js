import log from "../../config/log.js";
import SessionService from "./session.service.js";
import EventService from "../event/event.service.js";
import SurveyService from "../survey/survey.service.js";
import GameStateService from "../gameState/game.state.service.js";

const SessionController = {};

SessionController.getById = async (req, res, next) => {
    try {
        const session = await SessionService.getById(req.params.sessionId);
        return res.status(200).send(session);
    }
    catch (err) {
        log.error("Session get by id error:", err);
        return res.status(500).json({
            message: "ERROR.GET_BY_ID",
        });
    }
};
SessionController.getByShortId = async (req, res, next) => {
    try {
        const session = await SessionService.getByShortId(req.params.shortId);
        return res.status(200).send(session);
    }
    catch (err) {
        log.error("Session get by short id error:", err);
        return res.status(500).json({
            message: "ERROR.GET_BY_SHORT_ID",
        });
    }
};
SessionController.create = async (req, res, next) => {
    try {
        const session = await SessionService.create(req.body);
        return res.status(200).send(session);
    }
    catch (err) {
        log.error("Session creation error:", err);
        return res.status(500).json({
            message: "ERROR.CREATE",
        });
    }
};
SessionController.update = async (req, res, next) => {
    try {
        const sessionUpdated = await SessionService.update(req.body.sessionId, req.body.updates);
        return res.status(200).send(sessionUpdated);
    }
    catch (err) {
        log.error("Session update error:", err);
        return res.status(500).json({
            message: "ERROR.UPDATE",
        });
    }

};
SessionController.getAll = async (req, res, next) => {
    try {
        //TODO pagination  one day and with filters in req
        const sessions = await SessionService.getAll();
        return res.status(200).send(sessions);
    }
    catch (err) {
        log.error("get all sessions error:", err);
        return res.status(500).json({
            message: "ERROR.GET_ALL",
        });
    }
};
SessionController.delete = async (req, res, next) => {
    try {
        //todo rules manager to delete all rules associated
        await EventService.removeAllBySessionId(req.params.sessionId);
        await SurveyService.removeAllBySessionId(req.params.sessionId);
        await GameStateService.removeAllBySessionId(req.params.sessionId);
        const deletedSession = await SessionService.delete(req.params.sessionId);
        return res.status(200).send(deletedSession);
    }
    catch (err) {
        log.error("try remove session with error:", err);
        return res.status(500).json({
            message: "ERROR.SESSION_REMOVE_BY_ID",
        });
    }
};
export default SessionController;
