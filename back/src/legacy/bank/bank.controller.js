import GameModel from "../game/game.model.js";
import log from "../../../config/log.js";
import bankTimerManager from "./BankTimerManager.js";
import bankService from './bank.service.js';

export default {
    createCredit:         async (req, res, next) => {
        const {
            idGame,
            idPlayer,
            interest,
            amount,
            startNow
        } = req.body;
        try {
            const credit = await bankService.createCredit(idGame, idPlayer, amount, interest, startNow);
            return res.status(200).json(credit);
        }
        catch (err) {
            log.error(err);
            next({
                status:  400,
                message: "ERROR.CREATE_CREDIT",
            });
        }
    },
    getCreditsByIdPlayer: async (req, res, next) => {
        const {
            idGame,
            idPlayer
        } = req.params;
        try {
            const game = await GameModel.findById(idGame)
            if (game) {
                let credits = game.credits.filter(c => c.idPlayer === idPlayer);
                return res.status(200).json(credits);
            }
            log.error("Cannot get credits, Game not found");
            next({
                status:  400,
                message: "ERROR.GET_CREDITS",
            });
        }
        catch (err) {
            log.error(err);
            next({
                status:  400,
                message: "ERROR.GET_CREDITS",
            });
        }
    },
    settleCredit:         async (req, res, next) => {
        const {
            idCredit,
            idGame,
            idPlayer
        } = req.body;
        try {
            const creditUpdated = await bankService.settleCredit(idCredit, idGame, idPlayer);
            return res.status(200).json(creditUpdated);
        }
        catch (err) {
            log.error(err);
            next({
                status:  400,
                message: "ERROR.REPAY_CREDIT",
            });
        }
    },
    payInterest:          async (req, res, next) => {
        const {
            idGame,
            idPlayer,
            idCredit
        } = req.body;
        try {
            const creditUpdated = await bankService.payInterest(idCredit, idGame, idPlayer);
            return res.status(200).json(creditUpdated);
        }
        catch (err) {
            log.error(err);
            next({
                status:  400,
                message: "ERROR.PAY_INTEREST",
            });
        }
    },
    seizure:              async (req, res, next) => {
        const {
            idCredit,
            idGame,
            idPlayer,
            seizure
        } = req.body;
        try {
            const result = await bankService.seizure(idCredit, idGame, idPlayer, seizure);
            return res.status(200).json(result);
        }
        catch (err) {
            log.error(err);
            next({
                status:  400,
                message: "ERROR.SEIZURE",
            });
        }
    },
    lockDownPlayer:       async (req, res, next) => {
        try {
            await bankService.lockDownPlayer(req.idPlayer, req.idGame, req.prisonTime);
            return res.status(200).json({});
        }
        catch (err) {
            log.error(err);
            next({
                status:  400,
                message: "ERROR.LOCK_DOWN_PLAYER",
            });
        }
    },
    iveGotToBreakFree:    async (req, res, next) => {
        const {
            idGame,
            idPlayerToFree
        } = req.body;
        try {
            let timer = await bankTimerManager.getTimer(idPlayerToFree);
            if (timer) {
                await bankService.timeoutPrison(timer);
            }
            else {
                await bankService.getOut(idGame, idPlayerToFree);
            }
            return res.status(200).json({});
        }
        catch (err) {
            log.error(err);
            next({
                status:  500,
                message: err
            });
        }
    },
};
