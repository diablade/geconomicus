import express from 'express';
import bank from './bank.controller.js';
import { validate, schemas } from './bank.validation.js';

const router = express.Router();

router.post('/create-credit', validate(schemas.createCredit), bank.createCredit);
router.get('/get-credits/:idGame/:idPlayer', bank.getCreditsByIdPlayer);
router.post('/settle-credit', validate(schemas.settleCredit), bank.settleCredit);
router.post('/pay-interest', validate(schemas.payInterest), bank.payInterest);
router.post('/seizure', validate(schemas.seizure), bank.seizure);
router.post('/prison-break', validate(schemas.prisonBreak), bank.iveGotToBreakFree);
router.post('/lock-down-player', validate(schemas.lockDownPlayer), bank.lockDownPlayer);

export default router;
