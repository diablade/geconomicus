import express from 'express';
import event from './event.controller.js';
import { sanitize } from './event.sanitize.js';
import { validate } from '../misc/validate.tool.js';

const router = express.Router();

router.get('/session/:sessionId', validate(sanitize.getBySessionId), event.getBySessionId);
router.get('/game/:gameStateId', validate(sanitize.getByGameStateId), event.getByGameStateId);
// router.get('/game/:gameStateId/:avatarId', validate(sanitize.getByGameStateIdAndAvatarId), event.getByGameStateIdAndAvatarId);
export default router;
