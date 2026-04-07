import express from 'express';
import gameStateController from './game.state.controller.js';
import {stateSanitize} from './sanitizers/game.state.sanitize.js';
import {validate} from '../misc/validate.tool.js';

// import bank from './bank.controller.js';
// import {bankSanitize} from './bank.sanitize.js';

const router = express.Router();

router.post('/create', validate(stateSanitize.create), gameStateController.create);
router.post('/setup-game', validate(stateSanitize.setupGame), gameStateController.setupGame);

router.get('/:gameStateId', validate(stateSanitize.getById, 'params'), gameStateController.getById);
// router.get('/who-have-card/:gameStateId/:cardKey', validate(stateSanitize.whoHaveCard, 'params'), gameStateController.whoHaveCard);
// router.post('/start', validate(stateSanitize.start), gameStateController.start);
// router.post('/pause', validate(sanitize.pause), gameStateController.pause);
// router.post('/stop', validate(sanitize.stop), gameStateController.stop);
// router.post('/end', validate(sanitize.end), gameStateController.end);
// router.post('/kill-player', validate(sanitize.killPlayer), gameStateController.killPlayer);
// router.post('/refresh-force-all-players', validate(sanitize.refreshForceAllPlayers), gameStateController.refreshForceAllPlayers);
// router.post('/refresh-player', validate(sanitize.refreshPlayer), gameStateController.refreshPlayer);

// router.post('/produce', validate(sanitize.produce), gameStateController.produce);
// router.post('/transaction', validate(sanitize.transaction), gameStateController.transaction);
// router.get('/life/:gameStateId/:lifeId',validate(sanitize.getLife), gameStateController.getLife);

// router.get('/:idGame/:idPlayer', player.getById);
// router.post('/transaction', validate(schemas.transaction), player.transaction);
// router.post('/produce', validate(schemas.produce), player.produce);
// router.post('/create-credit', validate(schemas.createCredit), bank.createCredit);
// router.get('/get-credits/:idGame/:idPlayer', bank.getCreditsByIdPlayer);
// router.post('/settle-credit', validate(schemas.settleCredit), bank.settleCredit);
// router.post('/pay-interest', validate(schemas.payInterest), bank.payInterest);
// router.post('/seizure', validate(schemas.seizure), bank.seizure);
// router.post('/prison-break', validate(schemas.prisonBreak), bank.iveGotToBreakFree);
// router.post('/lock-down-player', validate(schemas.lockDownPlayer), bank.lockDownPlayer);

export default router;
