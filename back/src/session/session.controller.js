import env from '#config/env';
import log from "#config/log";
import socket from '#config/socket';
import { IO, DB_EVENTS, PLAYER_TYPE } from '@geco/shared';

import SessionService from "./session.service.js";
import RulesService from "./rules/rules.service.js";
import EventService from "../event/event.service.js";
import SurveyService from "../survey/survey.service.js";
import GameStateService from "../gameState/services/game.state.service.js";
import bcrypt from "bcrypt";
import { defaultDebtRules, defaultJuneRules } from "./rules/rules.service.js";

const SessionController = {};

SessionController.getById = async (req, res, next) => {
    try {
        const session = await SessionService.getById(req.params.sessionId);
        return res.status(200).json(session);
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
        return res.status(200).json(session);
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
        return res.status(200).json(session);
    }
    catch (err) {
        log.error("Session creation error:", err);
        return res.status(500).json({
            message: "ERROR.CREATE",
        });
    }
};
SessionController.start = async (req, res, next) => {
    try {
        const sessionUpdated = await SessionService.start(req.body.sessionId);
        await EventService.postNow(DB_EVENTS.SESSION_STARTED, sessionUpdated._id, "-", PLAYER_TYPE.MASTER, '-', {gamesRules_idx: sessionUpdated.gamesRules});//.map(rule => rule.idx)}
        socket.emitAckTo(req.body.sessionId, IO.SESSION.STARTED, {gamesRules: sessionUpdated.gamesRules});
        return res.status(200).json(sessionUpdated);
    }
    catch (err) {
        log.error("Session start error:", err);
        return res.status(500).json({message: "ERROR.START"});
    }
};
SessionController.update = async (req, res, next) => {
    try {
        const sessionUpdated = await SessionService.update(req.body.sessionId, req.body.updates);
        const sessionLight = {
            _id: sessionUpdated._id,
            name: sessionUpdated.name,
            animator: sessionUpdated.animator,
            status: sessionUpdated.status,
            theme: sessionUpdated.theme
        };
        console.log("Session updated:", sessionLight);
        socket.emitTo(req.body.sessionId, IO.SESSION.UPDATED, sessionLight);
        return res.status(200).json(sessionUpdated);
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
        return res.status(200).json(sessions);
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
        const password = req.body.password;
        const sessionId = req.body.sessionId;
        if ((env.environment === "production" && bcrypt.compareSync(password, env.admin_password)) || (env.environment !== "production" && password
            === "admin")) {
            await EventService.removeAllBySessionId(sessionId);
            await SurveyService.removeAllBySessionId(sessionId);
            await GameStateService.removeAllBySessionId(sessionId);
            const deletedSession = await SessionService.delete(sessionId);
            return res.status(200).json(deletedSession);
        }
        else {
            return res.status(500).json({
                message: "ERROR.SESSION_REMOVE_BY_ID",
            });
        }
    }
    catch (err) {
        log.error("try remove session with error:", err);
        return res.status(500).json({
            message: "ERROR.SESSION_REMOVE_BY_ID",
        });
    }
};

SessionController.killGame = async (req, res, next) => {
    try {
        const sessionUpdated = await RulesService.resetDefault(req.body.sessionId, req.body.ruleIdx);
        await GameStateService.delete(req.body.gameStateId);
        delete sessionUpdated.players;
        let response = {
            gameStatus: sessionUpdated.gameStatus,
            gameStateId: "",
            idx: req.body.ruleIdx
        }
        socket.emitTo(req.body.sessionId, IO.GAME.KILLED, response);
        return res.status(200).json(response);
    }
    catch (err) {
        log.error("Session kill game error:", err);
        return res.status(500).json({
            message: "ERROR.KILL_GAME",
        });
    }
};

export default SessionController;
