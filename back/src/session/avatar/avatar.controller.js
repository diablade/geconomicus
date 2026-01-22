import log from '#config/log';
import socket from '#config/socket';
import { C } from '#constantes';
import AvatarService from "./avatar.service.js";
// import { nanoId4 } from '../../misc/misc.tool.js';
// import { generateToken, hashToken } from '../../misc/token.service.js';

const AvatarController = {};

AvatarController.join = async (req, res, next) => {
    const {
        sessionId,
        name
    } = req.body;
    try {
        // TODO AUTH (with token hash in ram and in db)
        // const token = generateToken();
        // const tokenHash = await hashToken(token);
        let avatar = await AvatarService.create(sessionId, name);
        if (!avatar) {
            return res.status(404).json({ message: "Session not found" });
        }
        socket.emitTo(sessionId, C.NEW_AVATAR, { name: name, avatarIdx: avatar.idx });
        return res.status(200).json({ avatarIdx: avatar.idx });
    }
    catch (err) {
        log.error(err);
        return res.status(404).json({ message: "Game not found" });
    }
};
AvatarController.getByIdx = async (req, res, next) => {
    const {
        sessionId,
        avatarIdx
    } = req.params;
    try {
        const avatar = await AvatarService.getByIdx(sessionId, avatarIdx);
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
            avatarIdx,
            updates
        } = req.body;
        const updatedAvatar = await AvatarService.update(sessionId, avatarIdx, updates);
        socket.emitTo(sessionId, C.UPDATED_AVATAR, updatedAvatar);
        return res.status(200).json(updatedAvatar);
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
            avatarIdx
        } = req.params;
        const ack = await AvatarService.delete(sessionId, avatarIdx);
        if (!ack) {
            return res.status(404).json({ message: "Cannot delete avatar" });
        }
        socket.emitTo(sessionId, C.DELETED_AVATAR, { avatarIdx });
        return res.status(200).json({ ...ack, avatarIdx });
    }
    catch (error) {
        log.error("delete avatar error:", error);
        return res.status(404).json({
            message: "can't delete avatar not found",
        });
    }
};

export default AvatarController;

