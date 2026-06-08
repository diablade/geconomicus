import express from 'express';
import gameStateController from './game.state.controller.js';
import {stateSanitize} from './sanitizers/game.state.sanitize.js';
import {validate} from '../misc/validate.tool.js';

// import bank from './bank.controller.js';
// import {bankSanitize} from './bank.sanitize.js';

const router = express.Router();

router.post('/create', validate(stateSanitize.create), gameStateController.create);
router.post('/init', validate(stateSanitize.init), gameStateController.init);
router.post('/start', validate(stateSanitize.start), gameStateController.start);
router.post('/pause', validate(stateSanitize.pause), gameStateController.pause);
router.post('/resume', validate(stateSanitize.resume), gameStateController.resume);
router.post('/stop', validate(stateSanitize.stop), gameStateController.stop);


router.get('/:gameStateId', validate(stateSanitize.getById, 'params'), gameStateController.getById);
router.post('/produce', validate(stateSanitize.produce), gameStateController.produce);
router.get('/who-have-card/:gameStateId/:cardKey', validate(stateSanitize.whoHaveCard, 'params'), gameStateController.whoHaveCard);
// router.post('/kill-player', validate(sanitize.killPlayer), gameStateController.killPlayer);
// router.post('/refresh-force-all-players', validate(sanitize.refreshForceAllPlayers), gameStateController.refreshForceAllPlayers);
// router.post('/refresh-player', validate(sanitize.refreshPlayer), gameStateController.refreshPlayer);


router.get('/player-state/:sessionId/:gameStateId/:avatarIdx', validate(stateSanitize.getCurrentPlayerStateIdx, 'params'), gameStateController.getCurrentPlayerStateIdx);
router.get('/player-state/:sessionId/:gameStateId/:avatarIdx/:playerStateIdx', validate(stateSanitize.getPlayerState, 'params'), gameStateController.getPlayerState);
router.post('/player-state/transaction', validate(stateSanitize.transaction), gameStateController.transaction);


router.post('/bank-state/free-money', validate(stateSanitize.freeMoney), gameStateController.freeMoney);
router.post('/bank-state/create-credit', validate(stateSanitize.createCredit), gameStateController.createCredit);
router.post('/bank-state/credit-for-all', validate(stateSanitize.creditForAll), gameStateController.creditForAll);
router.post('/bank-state/cancel-credit', validate(stateSanitize.cancelCredit), gameStateController.cancelCredit);

// router.get('/get-credits/:idGame/:idPlayer', bank.getCreditsByIdPlayer);
// router.post('/settle-credit', validate(schemas.settleCredit), bank.settleCredit);
// router.post('/pay-interest', validate(schemas.payInterest), bank.payInterest);
// router.post('/seizure', validate(schemas.seizure), bank.seizure);
// router.post('/prison-break', validate(schemas.prisonBreak), bank.iveGotToBreakFree);
// router.post('/lock-down-player', validate(schemas.lockDownPlayer), bank.lockDownPlayer);

export default router;
