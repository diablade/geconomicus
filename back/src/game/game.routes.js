import express from 'express';

const router = express.Router();
import game from './game.controller.js';

router.post('/create', game.create);
router.get('/:idGame', game.getGameById);
router.post('/update', game.update);
router.post('/start-round', game.startRound);
router.post('/stop-round', game.stopRound);
router.post('/inter-round', game.interRound);
router.delete('/delete-player', game.deletePlayer);
router.get('/events/:idGame', game.getEvents);
router.put('/start', game.start);
router.post('/stop', game.stop);
router.put('/reset', game.reset);

// router.post('/import', game.import);
// router.get('/export', game.export);

export default router;
