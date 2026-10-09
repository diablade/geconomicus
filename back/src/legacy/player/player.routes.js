import express from 'express';
import player from './player.controller.js';
import { validate, schemas } from './player.validation.js';

const router = express.Router();

router.get('/:idGame/:idPlayer', player.getById);
router.post('/joinInGame', player.joinInGame);
router.post('/join', validate(schemas.join), player.join);
router.post('/joinReincarnate', validate(schemas.joinReincarnate), player.joinReincarnate);
router.post('/isReincarnated', validate(schemas.isReincarnated), player.isReincarnated);
router.post('/update', validate(schemas.update), player.update);
router.post('/transaction', validate(schemas.transaction), player.transaction);
router.post('/produce', validate(schemas.produce), player.produce);
router.post('/survey',validate(schemas.addFeedback), player.addFeedback);

export default router;
