import log from "../../config/log.js";
import RulesModel from './rules.model.js';

const RulesController = {};

RulesController.create = async (req, res, next) => {
    try {
        const rules = req.body.rules;
        const rulesCreatedAck = await RulesModel.create(rules);
        return res.status(200).send(rulesCreatedAck);
    }
    catch (err) {
        log.error("Rules creation error:", err);
        return res.status(500).json({
            message: "ERROR.CREATE",
        });
    }
};
RulesController.update = async (req, res, next) => {
    try {
        const rulesUpdatedAck = await RulesModel.update(req.body);
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
