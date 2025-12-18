import express from 'express';
import event from './event.controller.js';
import { schemas } from './event.validation.js';
import { validate } from '../misc/validate.tool.js';

const router = express.Router();

router.post('/add', validate(schemas.addEvent), event.createEvent);
router.get('/session/:sessionId', validate(schemas.getBySessionId), event.getEventsBySessionAndGame);
router.delete('/session/:sessionId', validate(schemas.removeBySessionId), event.deleteEventsBySession);
router.delete('/game/:gameId', validate(schemas.removeByGameId), event.deleteEventsByGame);


export default router;