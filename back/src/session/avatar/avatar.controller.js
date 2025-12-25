import log from '../../../config/log.js';
import socket from '../../../config/socket.js';
import * as C from '../../../../config/constantes.js';
import SessionModel from "../../session/session.model.js";
import AvatarModel from "./avatar.model.js";
import nanoid from '../../../misc/misc.tool.js';

const AvatarController = {};

AvatarController.join = async (req, res, next) => {
    const {
        sessionId,
        name
    } = req.body;
    try {
        const nanoId = nanoid();
        let session = await AvatarModel.create(sessionId, nanoId, name);
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }
        let joinEvent = await EventModel.create(C.NEW_AVATAR, sessionId, null, nanoId, C.MASTER, { name: name });
        socket.emitTo(sessionId, C.NEW_AVATAR, joinEvent);
        return res.status(200).json({ avatarId: nanoId });
    }
    catch (err) {
        log.error(err);
        return res.status(404).json({ message: "Game not found" });
    }
};
AvatarController.getById = async (req, res, next) => {
    const {
        sessionId,
        avatarId
    } = req.params;
    try {
        const avatar = await AvatarModel.getById(sessionId, avatarId);
        return res.status(200).json(avatar);
    }
    catch (err) {
        log.error(err);
        return res.status(404).json({
            message: "Avatar not found"
        });
    }
};
AvatarController.update = async (req, res, next) => {
    try {
        const {
            sessionId,
            avatarId,
            updates
        } = req.body;
        const updatedAvatar = await AvatarModel.update(sessionId, avatarId, updates);
        socket.emitTo(sessionId, C.UPDATED_AVATAR, updatedAvatar);
        return res.status(200).json({ "status": "updated" });
    }
    catch (err) {
        log.error(err);
        return res.status(404).json({ message: err });
    }
};
AvatarController.delete = async (req, res, next) => {
    try {
        const {
            sessionId,
            avatarId
        } = req.body;
        const session = await AvatarModel.removeById(sessionId, avatarId);
        if (!session) {
            return res.status(404).json({ message: "Cannot delete avatar" });
        }
        let deleteEvent = await EventModel.create(C.DELETED_AVATAR, sessionId, null, avatarId, C.MASTER, {});
        socket.emitTo(sessionId, C.DELETED_AVATAR, deleteEvent);
        return res.status(200).json({ "status": "deleted" });
    }
    catch (error) {
        log.error("delete avatar error:", error);
        return res.status(404).json({
            message: "can't delete avatar not found",
        });
    }
};

export default AvatarController;

