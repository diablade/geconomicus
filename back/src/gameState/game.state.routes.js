import express from 'express';
import gameStateController from './game.state.controller.js';
import {stateSanitize} from './sanitizers/game.state.sanitize.js';
import {bankStateSanitize} from './sanitizers/bank.state.sanitizer.js';
import {playerStateSanitize} from './sanitizers/player.state.sanitizer.js';
import {actionSanitize} from './sanitizers/action.sanitizer.js';
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

router.post('/refresh-player', validate(playerStateSanitize.refreshPlayer), gameStateController.refreshPlayer);
router.post('/refresh-all', validate(playerStateSanitize.refreshAllPlayers), gameStateController.refreshAllPlayers);

router.post('/kill-player', validate(playerStateSanitize.killPlayer), gameStateController.killPlayer);


router.post('/player-state/produce', validate(playerStateSanitize.produce), gameStateController.produce);
router.get('/player-state/:sessionId/:gameStateId/:avatarIdx', validate(playerStateSanitize.getCurrentPlayerStateIdx, 'params'), gameStateController.getCurrentPlayerStateIdx);
router.get('/player-state/:sessionId/:gameStateId/:avatarIdx/:playerStateIdx', validate(playerStateSanitize.getPlayerState, 'params'), gameStateController.getPlayerState);
router.post('/player-state/transaction', validate(playerStateSanitize.transaction), gameStateController.transaction);

router.post('/action/get-target-cards', validate(actionSanitize.getTargetCards), gameStateController.actionGetTargetCards);
router.post('/action/available-players', validate(actionSanitize.getAvailablePlayers), gameStateController.actionGetAvailablePlayers);
router.post('/action/give', validate(actionSanitize.give), gameStateController.actionGive);
router.post('/action/steal', validate(actionSanitize.steal), gameStateController.actionSteal);
router.post('/action/silent-steal', validate(actionSanitize.silentSteal), gameStateController.actionSilentSteal);
router.post('/action/war', validate(actionSanitize.war), gameStateController.actionWar);
router.post('/action/ong', validate(actionSanitize.ong), gameStateController.actionOng);
router.post('/action/who-have-card', validate(actionSanitize.whoHaveCard), gameStateController.actionWhoHaveCard);


router.post('/bank-state/free-money', validate(bankStateSanitize.freeMoney), gameStateController.freeMoney);
router.post('/bank-state/create-credit', validate(bankStateSanitize.createCredit), gameStateController.createCredit);
router.post('/bank-state/credit-for-all', validate(bankStateSanitize.creditForAll), gameStateController.creditForAll);
router.post('/bank-state/cancel-credit', validate(bankStateSanitize.cancelCredit), gameStateController.cancelCredit);
router.post('/bank-state/settle-credit', validate(bankStateSanitize.settleCredit), gameStateController.settleCredit);
router.post('/bank-state/extend-credit', validate(bankStateSanitize.extendCredit), gameStateController.extendCredit);
router.post('/bank-state/seizure', validate(bankStateSanitize.seizure), gameStateController.seizure);
router.post('/bank-state/prison-break', validate(bankStateSanitize.prisonBreak), gameStateController.prisonBreak);

export default router;
