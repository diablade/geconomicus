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
        return res.status(200).send(rulesCreated);
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
        const rulesUpdatedAck = await RulesService.update(req.body.sessionId, req.body.ruleId, req.body.rules);
        return res.status(200).send({
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
        const session = await RulesModel.getById(req.params.sessionId, req.params.ruleId);
        return res.status(200).send(session);
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
        await RulesModel.removeById(req.body.sessionId, req.body.ruleId);
        return res.status(200).send({
            status: "removed",
        });
    }
    catch (err) {
        log.error("Rules remove by id error:", err);
        return res.status(500).json({
            message: "ERROR.REMOVE_BY_ID",
        });
    }
};
export default RulesController;
