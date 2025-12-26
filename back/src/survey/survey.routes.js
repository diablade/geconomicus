import express from 'express';
import surveyController from './survey.controller.js';
import { validate } from '../misc/validate.tool.js';
import { sanitize } from './survey.sanitize.js';

const router = express.Router();

router.get('/:gameStateId/:avatarId', validate(sanitize.getByGameStateIdAndAvatarId, true), surveyController.getByGameStateIdAndAvatarId);
router.get('/game/:gameStateId', validate(sanitize.getByGameStateId, true), surveyController.getByGameStateId);
router.get('/session/:sessionId', validate(sanitize.getBySessionId, true), surveyController.getBySessionId);
router.post('/feedback', validate(sanitize.addFeedback), surveyController.addFeedback);
router.delete('/session/:sessionId', validate(sanitize.removeAllBySessionId, true), surveyController.removeAllBySessionId);
router.delete('/game/:gameStateId', validate(sanitize.removeAllByGameStateId, true), surveyController.removeAllByGameStateId);
export default router;