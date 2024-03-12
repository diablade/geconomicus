import express from 'express';

const router = express.Router();
import game from './game.controller.js';

router.get('/all', game.all);
router.get('/events/:idGame', game.getEvents);
router.get('/:idGame', game.getGameById);
router.get('/get-credits/:idGame/:idPlayer', game.getCreditsByIdPlayer);
router.post('/create', game.create);
router.post('/create-credit', game.createCredit);
router.post('/update-credit', game.updateCredit);
router.post('/end', game.end);
router.post('/start-round', game.startRound);
router.post('/stop-round', game.stopRound);
router.post('/inter-round', game.interRound);
router.post('/kill-player', game.killPlayer);
router.put('/start', game.start);
router.put('/reset', game.reset);
router.put('/update', game.update);
router.delete('/delete-player', game.deletePlayer);

export default router;
