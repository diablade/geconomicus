import express from 'express';
import surveyController from './survey.controller.js';
import { sanitize } from './survey.sanitize.js';
import { validate } from '../misc/validate.tool.js';

const router = express.Router();

router.post('/feedback', validate(sanitize.addFeedback), surveyController.addFeedback);
router.get('/session/:sessionId', validate(sanitize.getBySessionId, true), surveyController.getBySessionId);
router.get('/:sessionId/:gameStateId/:avatarId', validate(sanitize.getBySessionGameStateAvatarId, true), surveyController.getBySessionGameStateAvatarId);
router.get('/game/:gameStateId', validate(sanitize.getByGameStateId, true), surveyController.getByGameStateId);
router.delete('/session/:sessionId', validate(sanitize.removeAllBySessionId, true), surveyController.removeAllBySessionId);
router.delete('/game/:gameStateId', validate(sanitize.removeAllByGameStateId, true), surveyController.removeAllByGameStateId);
export default router;