import express from 'express';

const router = express.Router();
import game from './game.controller.js';

router.post('/create', game.create);
router.get('/:idGame', game.getGameById);
router.post('/start-round', game.startRound);
router.post('/stop-round', game.stopRound);
router.post('/inter-round', game.interRound);
router.delete('/delete-player', game.deletePlayer);
router.post('/kill-player', game.killPlayer);
router.get('/events/:idGame', game.getEvents);
router.put('/start', game.start);
router.post('/stop', game.stop);
router.put('/reset', game.reset);
router.put('/update', game.update);

export default router;
