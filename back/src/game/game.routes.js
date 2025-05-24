import express from 'express';
import game from './game.controller.js';
import { validate, schemas } from './game.validation.js';

const router = express.Router();

router.get('/all', game.all);
router.get('/events/:idGame', validate(schemas.idGame, 'params'), game.getEvents);
router.get('/feedbacks/:idGame', validate(schemas.idGame, 'params'), game.getFeedbacks);
router.get('/:idGame', validate(schemas.idGame, 'params'), game.getGameById);
router.get('/short/:shortId', validate(schemas.getIdGameByShortId, 'params'), game.getIdGameByShortId);
router.post('/create', validate(schemas.create), game.create);
router.post('/end', validate(schemas.end), game.end);
router.post('/delete', validate(schemas.deleteGame), game.delete);
router.post('/start-round', validate(schemas.startRound), game.startRound);
router.post('/stop-round', validate(schemas.stopRound), game.stopRound);
router.post('/inter-round', validate(schemas.interRound), game.interRound);
router.post('/kill-player', validate(schemas.killPlayer), game.killPlayer);
router.put('/start', validate(schemas.start), game.start);
router.put('/reset', validate(schemas.reset), game.reset);
router.put('/update', validate(schemas.update), game.update);
router.delete('/delete-player', validate(schemas.deletePlayer), game.deletePlayer);

export default router;
