import express from 'express';
import gameStateController from './game.state.controller.js';
import {sanitize} from './game.state.sanitize.js';
import {validate} from '../misc/validate.tool.js';

const router = express.Router();

router.post('/launch', validate(sanitize.launch), gameStateController.create);

router.post('/produce', validate(sanitize.produce), gameStateController.produce);
router.post('/transaction', validate(sanitize.transaction), gameStateController.transaction);
// router.get('/life/:gameStateId/:lifeId',validate(sanitize.getLife), gameStateController.getLife);

router.get('/:gameStateId', validate(sanitize.getById, 'params'), gameStateController.getById);
router.get('/who-have-card/:gameStateId/:cardKey', validate(sanitize.whoHaveCard, 'params'), gameStateController.whoHaveCard);
router.post('/init-game', validate(sanitize.initGame), gameStateController.initGame);
router.post('/start', validate(sanitize.start), gameStateController.start);
router.post('/pause', validate(sanitize.pause), gameStateController.pause);
router.post('/stop', validate(sanitize.stop), gameStateController.stop);
router.post('/end', validate(sanitize.end), gameStateController.end);
router.post('/kill-player', validate(sanitize.killPlayer), gameStateController.killPlayer);
router.post('/refresh-force-all-players', validate(sanitize.refreshForceAllPlayers), gameStateController.refreshForceAllPlayers);
router.post('/refresh-player', validate(sanitize.refreshPlayer), gameStateController.refreshPlayer);

export default router;
