import express from 'express';

const router = express.Router();
import bank from './bank.controller.js';

router.post('/create-credit', bank.createCredit);
router.get('/get-credits/:idGame/:idPlayer', bank.getCreditsByIdPlayer);
router.post('/settle-credit', bank.settleCredit);
router.post('/pay-interest', bank.payInterest);


export default router;
