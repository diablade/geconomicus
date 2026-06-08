import log from '#config/log';
import socket from '#config/socket';
import { IO, ROOMS } from '@geco/shared';
import AvatarService from "./avatar.service.js";
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
            return res.status(404).json({message: "Session not found"});
        }
        socket.emitTo(ROOMS.session(sessionId), IO.AVATAR.NEW, {
            name:   name,
            avatar: avatar
        });
        return res.status(200).json({avatarIdx: avatar.idx});
    }
    catch (err) {
        log.error(err);
        return res.status(404).json({message: "Game not found"});
    }
};
AvatarController.getByIdx = async (req, res, next) => {
    const {
        sessionId,
        avatarIdx,
        fetchSession
    } = req.params;
    try {
        const obj = await AvatarService.getByIdx(sessionId, avatarIdx, fetchSession);
        return res.status(200).json(obj);
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
        socket.emitTo(ROOMS.session(sessionId), IO.AVATAR.UPDATED, {updatedAvatar});
        return res.status(200).json(updatedAvatar);
    }
    catch (err) {
        log.error(err);
        return res.status(404).json({message: err});
    }
};
AvatarController.refresh = async (req, res, next) => {
    try {
        const {
            sessionId,
            avatarIdx
        } = req.body;
        socket.emitTo(ROOMS.avatar(sessionId, avatarIdx), IO.REFRESH_FORCE);
        return res.status(200).json({status: 'ok'});
    }
    catch (err) {
        log.error(err);
        return res.status(404).json({message: err});
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
            return res.status(404).json({message: "ERROR.DELETE_AVATAR"});
        }
        socket.emitTo(ROOMS.session(sessionId), IO.AVATAR.DELETED, {avatarIdx});
        return res.status(200).json({
            ...ack,
            avatarIdx
        });
    }
    catch (error) {
        log.error(`delete avatar error: `, error);
        return res.status(404).json({
            message: "can't delete avatar not found",
        });
    }
};

export default AvatarController;

