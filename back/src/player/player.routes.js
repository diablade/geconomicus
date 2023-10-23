import express from 'express';

const router = express.Router();
import player from './player.controller.js';

router.post('/join', player.join);
router.post('/joinInGame', player.joinInGame);
router.post('/joinReincarnate', player.joinReincarnate);
router.post('/update', player.update);
router.post('/transaction', player.transaction);
router.post('/produceFromSquare', player.produceFromSquare);
router.get('/:idGame/:idPlayer', player.getById);

export default router;
