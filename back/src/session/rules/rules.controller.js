import log from "../../../config/log.js";
import RulesService from './rules.service.js';
import socket from '../../../config/socket.js';
import { C } from '../../../../config/constantes.mjs';

const RulesController = {};

RulesController.create = async (req, res, next) => {
    try {
        const rulesCreated = await RulesService.create(req.body.sessionId, req.body.rules);
        socket.emitTo(req.body.sessionId, C.NEW_GAMES_RULES, {
            id: rulesCreated.id,
            typeMoney: rulesCreated.typeMoney
        });
        return res.status(200).json(rulesCreated);
    }
    catch (err) {
        log.error("Rules creation error:", err);
        return res.status(500).json({
            message: "ERROR.CREATE",
        });
    }
    ;
}
RulesController.update = async (req, res, next) => {
    try {
        const rulesUpdatedAck = await RulesService.update(req.body.sessionId, req.body.ruleId, req.body.updates);
        if (rulesUpdatedAck.modifiedCount === 0) {
            return res.status(200).json({
                status: "not modified",
            });
        } else {
            socket.emitTo(req.body.sessionId, C.UPDATED_RULES, {
                id: req.body.ruleId,
                typeMoney: req.body.updates.typeMoney
            });
        }
        return res.status(200).json({
            status: "updated",
        });
    }
    catch (err) {
        log.error("Rules update error:", err);
        return res.status(500).json({
            message: "ERROR.UPDATE",
        });
    }
};
RulesController.getById = async (req, res, next) => {
    try {
        const session = await RulesService.getById(req.params.sessionId, req.params.ruleId);
        return res.status(200).json(session);
    }
    catch (err) {
        log.error("Rules get by id error:", err);
        return res.status(500).json({
            message: "ERROR.GET_BY_ID",
        });
    }
};
RulesController.remove = async (req, res, next) => {
    try {
        const ack = await RulesService.removeById(req.body.sessionId, req.body.ruleId);
        if (ack.modifiedCount === 1) {
            socket.emitTo(req.body.sessionId, C.DELETED_RULES, {
                id: req.body.ruleId,
            });
            return res.status(200).json(ack);
        } else {
            return res.status(400).send({
                status: "not removed",
            });
        }
    }
    catch (err) {
        log.error("Rules remove by id error:", err);
        return res.status(500).json({
            message: "ERROR.REMOVE_BY_ID",
        });
    }
};
export default RulesController;
