import express from 'express';
import player from './player.controller.js';
import { validate, schemas } from './player.validation.js';

const router = express.Router();

router.get('/:idGame/:idPlayer', player.getById);
router.post('/transaction', validate(schemas.transaction), player.transaction);
router.post('/produce', validate(schemas.produce), player.produce);

export default router;
