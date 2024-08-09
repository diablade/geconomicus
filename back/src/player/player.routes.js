import express from 'express';

const router = express.Router();
import player from './player.controller.js';

router.get('/:idGame/:idPlayer', player.getById);
router.post('/join', player.join);
router.post('/joinInGame', player.joinInGame);
router.post('/joinReincarnate', player.joinReincarnate);
router.post('/isReincarnated', player.isReincarnated);
router.post('/update', player.update);
router.post('/transaction', player.transaction);
router.post('/produce', player.produce);
router.post('/survey/:idGame/:idPlayer', player.addFeedback);

export default router;
