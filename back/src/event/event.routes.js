import express from 'express';
import event from './event.controller.js';
import { schemas } from './event.validation.js';
import { validate } from '../misc/validate.tool.js';

const router = express.Router();

router.get('/session/:sessionId', validate(schemas.getBySessionId), event.getBySessionId);
router.get('/game/:gameStateId', validate(schemas.getByGameStateId), event.getByGameStateId);
// router.get('/game/:gameStateId/:avatarId', validate(schemas.getByGameStateIdAndAvatarId), event.getByGameStateIdAndAvatarId);
export default router;
