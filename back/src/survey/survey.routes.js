import express from 'express';
import surveyController from './survey.controller.js';
import { validate } from '../misc/validate.tool.js';
import { schemas } from './survey.validation.js';

const router = express.Router();

router.get('/:gameStateId/:avatarId', validate(schemas.getByGameStateIdAndAvatarId, true), surveyController.getByGameStateIdAndAvatarId);
router.get('/game/:gameStateId', validate(schemas.getByGameStateId, true), surveyController.getByGameStateId);
router.get('/session/:sessionId', validate(schemas.getBySessionId, true), surveyController.getBySessionId);
router.post('/feedback', validate(schemas.addFeedback), surveyController.addFeedback);
router.delete('/session/:sessionId', validate(schemas.removeAllBySessionId, true), surveyController.removeAllBySessionId);
router.delete('/game/:gameStateId', validate(schemas.removeAllByGameStateId, true), surveyController.removeAllByGameStateId);
export default router;