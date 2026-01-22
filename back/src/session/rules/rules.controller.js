import log from "#config/log";
import RulesService from './rules.service.js';
import socket from '#config/socket';
import { C } from '#constantes';

const RulesController = {};

RulesController.create = async (req, res, next) => {
    try {
        const rulesCreated = await RulesService.create(req.body.sessionId, req.body.rules);
        socket.emitTo(req.body.sessionId, C.NEW_GAMES_RULES, {
            idx: rulesCreated.idx,
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
        const rulesUpdatedAck = await RulesService.update(req.body.sessionId, req.body.ruleIdx, req.body.updates);
        if (rulesUpdatedAck.modifiedCount === 0) {
            return res.status(200).json({
                status: "not modified",
            });
        } else {
            socket.emitTo(req.body.sessionId, C.UPDATED_RULES, {
                idx: req.body.ruleIdx,
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
RulesController.getByIdx = async (req, res, next) => {
    try {
        const session = await RulesService.getByIdx(req.params.sessionId, req.params.ruleIdx);
        return res.status(200).json(session);
    }
    catch (err) {
        log.error("Rules get by idx error:", err);
        return res.status(500).json({
            message: "ERROR.GET_BY_IDX",
        });
    }
};
RulesController.remove = async (req, res, next) => {
    try {
        const ack = await RulesService.removeByIdx(req.params.sessionId, req.params.ruleIdx);
        if (ack.modifiedCount === 1) {
            socket.emitTo(req.params.sessionId, C.DELETED_RULES, {
                idx: req.params.ruleIdx,
            });
            return res.status(200).json(ack);
        } else {
            return res.status(400).send({
                status: "not removed",
            });
        }
    }
    catch (err) {
        log.error("Rules remove by idx error:", err);
        return res.status(500).json({
            message: "ERROR.REMOVE_BY_IDX",
        });
    }
};
export default RulesController;
