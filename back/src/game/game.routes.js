import express from 'express';
import game from './game.controller.js';
import {validate, schemas} from './game.validation.js';

const router = express.Router();

router.get('/all', game.all);
router.get('/events/:idGame', validate(schemas.idGame, 'params'), game.getEvents);
router.get('/feedbacks/:idGame', validate(schemas.idGame, 'params'), game.getFeedbacks);
router.get('/:idGame', validate(schemas.idGame, 'params'), game.getGameById);
router.get('/short/:shortId', validate(schemas.getIdGameByShortId, 'params'), game.getIdGameByShortId);
router.get('/who-have-card/:idGame/:cardKey', validate(schemas.whoHaveCard, 'params'), game.whoHaveCard);
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
router.post('/refresh-force-all-players', validate(schemas.refreshForceAllPlayers), game.refreshForceAllPlayers);
router.post('/refresh-player', validate(schemas.refreshPlayer), game.refreshPlayer);
router.post('/copy', validate(schemas.copyGame), game.copyGame);
export default router;
