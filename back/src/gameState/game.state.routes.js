import express from 'express';
import gameStateController from './game.state.controller.js';
import {stateSanitize} from './sanitizers/game.state.sanitize.js';
import {validate} from '../misc/validate.tool.js';

const router = express.Router();

router.post('/create', validate(stateSanitize.create), gameStateController.create);
router.post('/init', validate(stateSanitize.init), gameStateController.init);
router.post('/start', validate(stateSanitize.start), gameStateController.start);
router.post('/pause', validate(stateSanitize.pause), gameStateController.pause);
router.post('/resume', validate(stateSanitize.resume), gameStateController.resume);
router.post('/stop', validate(stateSanitize.stop), gameStateController.stop);


router.get('/:gameStateId', validate(stateSanitize.getById, 'params'), gameStateController.getById);
router.get('/who-have-card/:gameStateId/:cardKey', validate(stateSanitize.whoHaveCard, 'params'), gameStateController.whoHaveCard);

//TODOs
// router.post('/kill-player', validate(sanitize.killPlayer), gameStateController.killPlayer);
// router.post('/refresh-all', validate(sanitize.refreshAllPlayers), gameStateController.refreshAllPlayers);
// router.post('/refresh-player', validate(sanitize.refreshPlayer), gameStateController.refreshPlayer);


router.post('/player-state/produce', validate(stateSanitize.produce), gameStateController.produce);
router.get('/player-state/:sessionId/:gameStateId/:avatarIdx', validate(stateSanitize.getCurrentPlayerStateIdx, 'params'), gameStateController.getCurrentPlayerStateIdx);
router.get('/player-state/:sessionId/:gameStateId/:avatarIdx/:playerStateIdx', validate(stateSanitize.getPlayerState, 'params'), gameStateController.getPlayerState);
router.post('/player-state/transaction', validate(stateSanitize.transaction), gameStateController.transaction);

router.post('/action/get-target-cards', validate(stateSanitize.actionGetTargetCards), gameStateController.actionGetTargetCards);
router.post('/action/available-players', validate(stateSanitize.actionGetAvailablePlayers), gameStateController.actionGetAvailablePlayers);
router.post('/action/give', validate(stateSanitize.actionGive), gameStateController.actionGive);
router.post('/action/steal', validate(stateSanitize.actionSteal), gameStateController.actionSteal);
router.post('/action/silent-steal', validate(stateSanitize.actionSilentSteal), gameStateController.actionSilentSteal);
router.post('/action/war', validate(stateSanitize.actionWar), gameStateController.actionWar);
router.post('/action/ong', validate(stateSanitize.actionOng), gameStateController.actionOng);
router.post('/action/who-have-card', validate(stateSanitize.actionWhoHaveCard), gameStateController.actionWhoHaveCard);


router.post('/bank-state/free-money', validate(stateSanitize.freeMoney), gameStateController.freeMoney);
router.post('/bank-state/create-credit', validate(stateSanitize.createCredit), gameStateController.createCredit);
router.post('/bank-state/credit-for-all', validate(stateSanitize.creditForAll), gameStateController.creditForAll);
router.post('/bank-state/cancel-credit', validate(stateSanitize.cancelCredit), gameStateController.cancelCredit);
router.post('/bank-state/settle-credit', validate(stateSanitize.settleCredit), gameStateController.settleCredit);
router.post('/bank-state/extend-credit', validate(stateSanitize.extendCredit), gameStateController.extendCredit);

//TODOs
// router.post('/bank-state/seizure', validate(schemas.seizure), gameStateController.seizure);
// router.post('/bank-state/prison-free', validate(schemas.prisonFree), gameStateController.prisonFree);
// router.post('/bank-state/prison', validate(schemas.prison), gameStateController.prison);

export default router;
