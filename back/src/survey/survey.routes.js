import express from 'express';
import surveyController from './survey.controller.js';
import { validate } from '../misc/validate.tool.js';
import { schemas } from './survey.validation.js';

const router = express.Router();

router.get('/game/:gameId/player/:playerId', validate(schemas.getByGameIdAndPlayerId, true), surveyController.getByGameIdAndPlayerId);
router.get('/game/:gameId', validate(schemas.getByGameId, true), surveyController.getByGameId);
router.get('/session/:sessionId', validate(schemas.getBySessionId, true), surveyController.getBySessionId);
router.post('/feedback', validate(schemas.addFeedback), surveyController.addFeedback);
router.delete('/session/:sessionId', validate(schemas.removeBySessionId, true), surveyController.removeBySessionId);
router.delete('/game/:gameId', validate(schemas.removeByGameId, true), surveyController.removeByGameId);
export default router;