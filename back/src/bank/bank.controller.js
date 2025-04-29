import GameModel, {constructor} from "../game/game.model.js";
import * as C from "../../../config/constantes.js";
import mongoose from "mongoose";
import socket from "../../config/socket.js";
import log from "../../config/log.js";
import _ from "lodash";
import Timer from "../misc/Timer.js";
import bankTimerManager from "./BankTimerManager.js";
import {differenceInMilliseconds} from "date-fns";
import bankService from "./bank.service.js";
import decksService from "../misc/decks.service.js";

const minute = 60 * 1000;
const fiveSeconds = 5 * 1000;

function addDebtTimer(id, startTickNow, duration, data) {
    bankTimerManager.addTimer(
        new Timer(
            id,
            duration * minute,
            fiveSeconds,
            data,
            (timer) => {
                let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
                let totalTime = differenceInMilliseconds(
                    timer.endTime,
                    timer.startTime
                );

                const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
                socket.emitTo(timer.data.idGame + C.BANK, C.PROGRESS_CREDIT, {
                    id,
                    progress,
                });
                socket.emitTo(timer.data.idPlayer, C.PROGRESS_CREDIT, {id, progress});
            },
            (timer) => {
                timeoutCredit(timer);
            }
        ),
        startTickNow
    );
}

function addPrisonTimer(id, duration, data) {
    bankTimerManager.addTimer(
        new Timer(
            id,
            duration * minute,
            fiveSeconds,
            data,
            (timer) => {
                let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
                let totalTime = differenceInMilliseconds(
                    timer.endTime,
                    timer.startTime
                );

                const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
                socket.emitTo(timer.data.idGame + C.BANK, C.PROGRESS_PRISON, {
                    id,
                    progress,
                    remainingTime,
                });
                socket.emitTo(timer.data.idPlayer, C.PROGRESS_PRISON, {
                    id,
                    progress,
                    remainingTime,
                });
            },
            (timer) => {
                timeoutPrison(timer);
            }
        ),
        true
    );
}

async function timeoutCredit(timer) {
    if (timer) {
        const credit = timer.data;
        await bankTimerManager.stopAndRemoveTimer(timer.id).then(async () => {
            bankService
                .checkAbilityPayment(credit.idGame, credit.idPlayer, credit.interest)
                .then((check) => {
                    if (check && check.canPay) {
                        let newEvent = constructor.event(
                            C.REQUEST_CREDIT,
                            C.MASTER,
                            credit.idPlayer,
                            credit.amount,
                            [credit],
                            Date.now()
                        );
                        GameModel.findOneAndUpdate(
                            {_id: credit.idGame, "credits._id": credit._id},
                            {
                                $set: {"credits.$.status": C.REQUEST_CREDIT},
                                $push: {events: newEvent},
                            }
                        )
                            .then((result) => {
                                credit.status = C.REQUEST_CREDIT;
                                socket.emitTo(credit.idGame + C.EVENT, C.EVENT, newEvent);
                                socket.emitTo(credit.idPlayer, C.TIMEOUT_CREDIT, credit);
                                socket.emitTo(credit.idGame + C.BANK, C.TIMEOUT_CREDIT, credit);
                            })
                            .catch((error) => {
                                log.error(error);
                            });
                    } else {
                        let newEvent = constructor.event(
                            C.DEFAULT_CREDIT,
                            C.MASTER,
                            credit.idPlayer,
                            credit.amount,
                            [credit],
                            Date.now()
                        );
                        GameModel.findOneAndUpdate(
                            {_id: credit.idGame, "credits._id": credit._id},
                            {
                                $set: {"credits.$.status": C.DEFAULT_CREDIT},
                                $push: {events: newEvent},
                            }
                        )
                            .then((update) => {
                                credit.status = C.DEFAULT_CREDIT;
                                socket.emitTo(credit.idGame + C.EVENT, C.EVENT, newEvent);
                                socket.emitTo(credit.idGame + C.BANK, C.DEFAULT_CREDIT, credit);
                                if (check && check.player.status !== C.DEAD) {
                                    socket.emitTo(credit.idPlayer, C.DEFAULT_CREDIT, credit);
                                }
                            })
                            .catch((error) => {
                                log.error(error);
                            });
                    }
                });
        });
    }
}

async function timeoutPrison(timer) {
    if (timer) {
        const data = timer.data;
        await bankTimerManager.stopAndRemoveTimer(timer.id);
        await getOut(data.idGame, data.idPlayer);
    }
}

async function getOut(idGame, idPlayer) {
    try {
        let game = await GameModel.findById(idGame);
        const shuffledDeck = _.shuffle(game.decks[0]);
        // Draw new cards for the player
        const newCards = shuffledDeck.slice(0, 4); //same weight
        // draw newCards in bdd
        await GameModel.updateOne(
            {_id: idGame},
            {
                $pull: {
                    [`decks.${0}`]: {_id: {$in: newCards.map((c) => c._id)}},
                },
            }
        );
        // and Add new cards to player's hand and event
        let newEvent = constructor.event(
            C.PRISON_ENDED,
            C.MASTER,
            idPlayer,
            0,
            newCards,
            Date.now()
        );
        await GameModel.updateOne(
            {_id: idGame, "players._id": idPlayer},
            {
                $set: {"players.$.status": C.ALIVE},
                $push: {
                    "players.$.cards": {$each: newCards},
                    events: newEvent,
                },
            }
        );
        socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
        socket.emitTo(idPlayer, C.PRISON_ENDED, {cards: newCards});
        socket.emitTo(idGame + C.BANK, C.PRISON_ENDED, {
            idPlayer: idPlayer,
            cards: newCards,
        });
    } catch (error) {
        log.error(error);
    }
}

export default {
    createCredit: async (req, res, next) => {
        const {idGame, idPlayer, interest, amount} = req.body;
        GameModel.findOneAndUpdate(
            {_id: idGame, "players._id": idPlayer},
            {
                $inc: {"players.$.coins": amount},
            },
            {new: true}
        )
            .then((updatedGame) => {
                const startNow = updatedGame.status == C.PLAYING;
                let id = new mongoose.Types.ObjectId();
                const credit = constructor.credit(
                    id,
                    amount,
                    interest,
                    idGame,
                    idPlayer,
                    startNow ? "running" : "paused",
                    Date.now(),
                    startNow ? Date.now() : null,
                    null
                );
                let newEvent = constructor.event(
                    C.NEW_CREDIT,
                    C.MASTER,
                    idPlayer,
                    amount,
                    [credit],
                    Date.now()
                );
                GameModel.findByIdAndUpdate(
                    idGame,
                    {
                        $push: {credits: credit, events: newEvent},
                        $inc: {currentMassMonetary: amount},
                    },
                    {
                        new: true,
                    }
                )
                    .then((newUpdatedGame) => {
                        addDebtTimer(
                            id.toString(),
                            startNow,
                            newUpdatedGame.timerCredit,
                            credit
                        );
                        socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
                        socket.emitTo(idPlayer, C.NEW_CREDIT, credit);
                        return res.status(200).json(credit);
                    })
                    .catch((error) => {
                        log.error(error);
                        return res.status(404).json({message: "Cannot create credit"});
                    });
            })
            .catch((error) => {
                log.error(error);
                return res.status(404).json({message: "Cannot create credit"});
            });
    },
    getCreditsByIdPlayer: async (req, res, next) => {
        const {idGame, idPlayer} = req.params;
        GameModel.findById(idGame)
            .then((game) => {
                if (game) {
                    let credits = game.credits.filter(c => c.idPlayer === idPlayer);
                    return res.status(200).json(credits);
                }
                return res
                    .status(404)
                    .json({message: "Cannot get credits, Game not found"});
            })
            .catch((error) => {
                log.error("get game error", error);
                return res
                    .status(404)
                    .json({message: "Cannot get credits, Game not found"});
            });
    },
    settleCredit: async (req, res, next) => {
        const {credit} = req.body;
        try {
            const creditUpdated = await bankService.settleCredit(credit);
            return res.status(200).json(creditUpdated);
        } catch (e) {
            next({
                status: 400,
                message: "can't settle credit",
            });
        }
    },
    payInterest: async (req, res, next) => {
        const credit = req.body.credit;
        if (!credit) {
            next({
                status: 400,
                message: "bad request",
            });
        } else {
            let newEvent = constructor.event(
                C.PAYED_INTEREST,
                credit.idPlayer,
                C.BANK,
                credit.interest,
                [credit],
                Date.now()
            );
            GameModel.findOneAndUpdate(
                {_id: credit.idGame, "players._id": credit.idPlayer},
                {
                    $inc: {
                        "players.$.coins": -credit.interest,
                        'currentMassMonetary': -credit.interest,
                        'bankInterestEarned': credit.interest,
                    },
                    $push: {events: newEvent},
                },
                {new: true}
            )
                .then((updatedGame) => {
                    if (updatedGame) {
                        GameModel.findOneAndUpdate(
                            {_id: credit.idGame, "credits._id": credit._id},
                            {
                                $set: {"credits.$.status": C.RUNNING_CREDIT},
                                $inc: {"credits.$.extended": 1},
                            },
                            {new: true}
                        )
                            .then((updatedGame) => {
                                if (updatedGame) {
                                    const creditUpdated = updatedGame.credits.find(c => c._id == credit._id);
                                    addDebtTimer(credit._id.toString(), true, updatedGame.timerCredit, creditUpdated);
                                    socket.emitTo(credit.idGame + C.EVENT, C.EVENT, newEvent);
                                    socket.emitTo(
                                        credit.idGame + C.BANK,
                                        C.PAYED_INTEREST,
                                        creditUpdated
                                    );
                                    return res.status(200).json(creditUpdated);
                                }
                            })
                            .catch((error) => {
                                log.error(error);
                                return res
                                    .status(500)
                                    .json({message: "coins updated but credit not found ??"});
                            });
                    } else {
                        log.error("Not enough coins to remove or player not found.");
                    }
                })
                .catch((error) => {
                    log.error(error);
                    return res
                        .status(404)
                        .json({message: "Cannot pay interest, Game not found"});
                });
        }
    },
    seizure: async (req, res, next) => {
        const {credit, seizure} = req.body;
        try {
            let newEvent = constructor.event(
                C.SEIZURE,
                credit.idPlayer,
                C.BANK,
                seizure.coins,
                seizure.cards,
                Date.now()
            );
            let interestSeized =
                credit.interest >= seizure.coins ? credit.interest : 0;
            let cardsValue = seizure.cards.reduce((acc, c) => c.price + acc, 0);

            // remove card and coins of player
            await GameModel.updateOne(
                {_id: credit.idGame, "players._id": credit.idPlayer},
                {
                    $pull: {
                        "players.$.cards": {
                            _id: {$in: seizure.cards.map((c) => c._id)},
                        },
                    },
                    $inc: {"players.$.coins": -seizure.coins},
                    $push: {events: newEvent},
                }
            );

            //PUT BACK CARDS IN THE DECKs
            await decksService.pushCardsInDecks(credit.idGame, seizure.cards);
            // remove coins MMonetary and update status credit
            await GameModel.updateOne(
                {_id: credit.idGame, "credits._id": credit._id},
                {
                    $inc: {
                        currentMassMonetary: -seizure.coins,
                        bankInterestEarned: +interestSeized,
                        bankGoodsEarned: cardsValue,
                    },
                    $set: {
                        "credits.$.status": C.CREDIT_DONE,
                        "credits.$.endDate": Date.now(),
                    },
                }
            );
            credit.status = C.CREDIT_DONE;
            credit.endDate = Date.now();
            socket.emitTo(credit.idGame + C.EVENT, C.EVENT, newEvent);
            // PRISON OU PAS ...
            if (seizure.prisonTime && seizure.prisonTime > 0) {
                let newEvent2 = constructor.event(
                    C.PRISON,
                    C.BANK,
                    credit.idPlayer,
                    seizure.prisonTime,
                    [],
                    Date.now()
                );
                GameModel.findOneAndUpdate(
                    {_id: credit.idGame, "players._id": credit.idPlayer},
                    {
                        $set: {"players.$.status": C.PRISON},
                        $push: {events: newEvent2},
                    },
                    {new: true}
                ).then((updatedGame) => {
                    let prisoner = updatedGame.players.find(p => p._id === credit.idPlayer);
                    addPrisonTimer(credit.idPlayer, seizure.prisonTime, {
                        idPlayer: credit.idPlayer,
                        idGame: credit.idGame,
                    });
                    socket.emitTo(credit.idGame + C.EVENT, C.EVENT, newEvent2);
                    socket.emitTo(credit.idPlayer, C.SEIZURE, {
                        credit: credit,
                        seizure: seizure,
                        prisoner: prisoner,
                    });
                    return res
                        .status(200)
                        .json({credit: credit, prisoner: prisoner, seizure: seizure});
                });
            } else {
                socket.emitTo(credit.idPlayer, C.SEIZURE, {
                    credit: credit,
                    seizure: seizure,
                });
                return res.status(200).json({credit: credit, seizure: seizure});
            }
        } catch (e) {
            log.error(e);
            next({status: 500, message: e});
        }
    },
    resetIdGameDebtTimers(idGame) {
        bankTimerManager.stopAndRemoveAllIdGameDebtTimer(idGame);
    },
    startCreditsByIdGame(idGame) {
        GameModel.updateMany(
            {_id: idGame, "credits.status": C.PAUSED_CREDIT},
            {
                $set: {"credits.$[].status": C.RUNNING_CREDIT},
            },
            {new: true}
        )
            .then((updatedGame) => {
                bankTimerManager.startAllIdGameDebtTimer(idGame);
                socket.emitTo(idGame + C.BANK, C.CREDITS_STARTED);
            })
            .catch((error) => {
                log.error(error);
            });
    },
    iveGotToBreakFree: async (req, res, next) => {
        const {idGame, idPlayerToFree} = req.body;
        try {
            let timer = await bankTimerManager.getTimer(idPlayerToFree);
            if (timer) {
                timeoutPrison(timer);
            } else {
                getOut(idGame, idPlayerToFree);
            }
            return res.status(200).json({});
        } catch (e) {
            log.error(e);
            next({status: 500, message: e});
        }
    },
};
