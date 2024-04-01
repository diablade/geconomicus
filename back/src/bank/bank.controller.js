import GameModel, {constructor} from "../game/game.model.js";
import * as C from "../../../config/constantes.js";
import mongoose from "mongoose";
import {io} from "../../conf_socket.js";
import log from "../../conf_log.js";
import _ from "lodash";
import Timer from "../misc/Timer.js";
import bankTimerManager from "./BankTimerManager.js";
import {differenceInMilliseconds} from "date-fns";

const minute = 60 * 1000;
const fiveSeconds = 10 * 1000;

function addDebtTimer(id, startTickNow, duration, data) {
    bankTimerManager.addTimer(new Timer(id, duration * minute, fiveSeconds, data,
        (timer) => {
            let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
            let totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);

            const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
            io().to(timer.data.idGame + "bank").emit(C.PROGRESS_CREDIT, {id, progress});
            io().to(timer.data.idPlayer).emit(C.PROGRESS_CREDIT, {id, progress});
        },
        (timer) => {
            timeoutCredit(timer);
        }), startTickNow);
}


async function checkAbilityPayment(idGame, idPlayer, checkAmountToPay) {
    try {
        const game = await GameModel.findById(idGame);
        const player = _.find(game.players, {id: idPlayer});
        if (!player) {
            throw new Error("Can't find player to check amount to pay");
        }
        return player.coins >= checkAmountToPay;
    } catch (error) {
        log.error('Get game error', error);
        throw error;
    }
}

function checkSolvability(idGame, idPlayer, amountToCheck) {
    //get game credits
    //get player coins and ressources
    // check capabilty with amount and ressources

}

function timeoutCredit(timer) {
    if (timer) {
        const credit = timer.data;
        bankTimerManager.stopAndRemoveTimer(timer.id).then(async () => {
                const canPay = await checkAbilityPayment(credit.idGame, credit.idPlayer, credit.interest);
                if (canPay) {
                    let newEvent = constructor.event(C.REQUEST_CREDIT, C.MASTER, credit.idPlayer, credit.amount, [credit], Date.now());
                    GameModel.findOneAndUpdate(
                        {_id: credit.idGame, 'credits._id': credit._id},
                        {
                            $set: {'credits.$.status': C.REQUEST_CREDIT},
                            $push: {'events': newEvent},
                        }, {new: true}
                    ).then(updatedGame => {
                        credit.status = C.REQUEST_CREDIT;
                        io().to(credit.idGame).emit(C.EVENT, newEvent);
                        io().to(credit.idPlayer).emit(C.TIMEOUT_CREDIT, credit);
                        io().to(credit.idGame + "bank").emit(C.TIMEOUT_CREDIT, credit);
                    }).catch((error) => {
                        log.error(error);
                    });
                } else {
                    let newEvent = constructor.event(C.DEFAULT_CREDIT, C.MASTER, credit.idPlayer, credit.amount, [credit], Date.now());
                    GameModel.findOneAndUpdate(
                        {_id: credit.idGame, 'credits._id': credit._id},
                        {
                            $set: {'credits.$.status': C.DEFAULT_CREDIT},
                            $push: {'events': newEvent},
                        }, {new: true}
                    ).then(updatedGame => {
                        credit.status = C.DEFAULT_CREDIT;
                        io().to(credit.idGame).emit(C.EVENT, newEvent);
                        io().to(credit.idPlayer).emit(C.DEFAULT_CREDIT, credit);
                        io().to(credit.idGame + "bank").emit(C.DEFAULT_CREDIT, credit);
                    }).catch((error) => {
                        log.error(error);
                    });
                }
            }
        );
    }
}


export default {
    createCredit: async (req, res, next) => {
        const idGame = req.body.idGame;
        const idPlayer = req.body.idPlayer;
        const interest = req.body.interest;
        const amount = req.body.amount;
        if (!idPlayer || !idGame || !interest || !amount) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findOneAndUpdate(
                {_id: idGame, 'players._id': idPlayer},
                {
                    $inc: {'players.$.coins': amount}
                }, {new: true}
            ).then(updatedGame => {
                const startNow = updatedGame.status == C.PLAYING
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
                )
                let newEvent = constructor.event(C.NEW_CREDIT, C.MASTER, idPlayer, amount, [credit], Date.now());
                GameModel.findByIdAndUpdate(idGame, {
                    $push: {'credits': credit, 'events': newEvent,},
                    $inc: {'currentMassMonetary': amount}
                }, {
                    new: true
                }).then((updatedGame) => {
                    addDebtTimer(id.toString(), startNow, updatedGame.timerCredit, credit);
                    io().to(idGame+"event").emit(C.EVENT, newEvent);
                    io().to(idPlayer).emit(C.NEW_CREDIT, credit);
                    res.status(200).json(credit);
                }).catch((error) => {
                    log.error(error);
                    next({
                        status: 404,
                        message: "Not found"
                    });
                });
            }).catch((error) => {
                log.error(error);
                next({
                    status: 404,
                    message: "Not found"
                });
            });
        }
    },
    getCreditsByIdPlayer: async (req, res, next) => {
        const idGame = req.params.idGame;
        const idPlayer = req.params.idPlayer;
        if (!idGame && !idPlayer) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findById(idGame)
                .then(game => {
                    if (game) {
                        let credits = _.filter(game.credits, {idPlayer: idPlayer});
                        res.status(200).json(credits);
                    } else {
                        next({
                            status: 404,
                            message: "Not found"
                        });
                    }
                })
                .catch(error => {
                    log.error('get game error', error);
                    next({
                        status: 404,
                        message: "not found"
                    });
                });
        }
    },
    settleCredit: async (req, res, next) => {
        const credit = req.body.credit;
        if (!credit) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findById({_id: credit.idGame})
                .then((game) => {
                        const canPay = checkAbilityPayment(credit.idGame, credit.idPlayer, (credit.amount + credit.interest));
                        //...
                        if (canPay) {
                            let newEvent = constructor.event(C.CREDIT_DONE, C.MASTER, credit.idPlayer, credit.interest, [credit], Date.now());
                            GameModel.findOneAndUpdate(
                                {_id: credit.idGame, 'credits._id': credit._id},
                                {
                                    $set: {'credits.$.status': C.CREDIT_DONE},
                                    $inc:{'bankInterestEarned':credit.interest,'currentMassMonetary':-credit.amount},
                                    $push: {'events': newEvent},
                                }, {new: true}
                            ).then(updatedGame => {
                                credit.status = C.CREDIT_DONE;
                                io().to(credit.idGame + "event").emit(C.EVENT, newEvent);
                                io().to(credit.idPlayer).emit(C.CREDIT_DONE, credit);
                                io().to(credit.idGame + "bank").emit(C.CREDIT_DONE, credit);
                                res.status(200).json("done");
                            }).catch((error) => {
                                log.error(error);
                            });
                        } else {
                            next({
                                status: 404,
                                message: "Fond insuffisant!"
                            });
                        }
                    }
                )
                .catch(error => {
                    log.error('get game error', error);
                    next({
                        status: 404,
                        message: "not found"
                    });
                });
        }
    },
    payInterest: async (req, res, next) => {
        const credit = req.body.credit;
        if (!credit) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            let newEvent = constructor.event(C.PAYED_INTEREST, C.MASTER, credit.idPlayer, credit.interest, [credit], Date.now());
            GameModel.findOneAndUpdate(
                {_id: credit.idGame, 'players._id': credit.idPlayer, "players.coins": {$gte: credit.interest}}, // condition
                {
                    $inc: {
                        "players.$.coins": -credit.interest,
                        'currentMassMonetary': -credit.interest,
                        'bankInterestEarned': credit.interest
                    },
                    $push: {'events': newEvent}
                }, {new: true}
            ).then(updatedGame => {
                if (updatedGame) {
                    GameModel.findOneAndUpdate(
                        {_id: credit.idGame, 'credits._id': credit._id},
                        {
                            $set: {'credits.$.status': C.RUNNING_CREDIT},
                            $inc: {'credits.$.extended': 1},
                        }, {new: true}
                    ).then(updatedGame => {
                            if (updatedGame) {
                                const creditUpdated = _.find(updatedGame.credits, c => {
                                    return c._id == credit._id
                                });
                                addDebtTimer(credit._id, true, updatedGame.timerCredit, creditUpdated);
                                io().to(credit.idGame).emit(C.EVENT, newEvent);
                                io().to(credit.idGame).emit(C.PAYED_INTEREST, creditUpdated);
                                res.status(200).json({credit: creditUpdated});
                            }
                        }
                    ).catch((error) => {
                        log.error(error);
                        next({
                            status: 404,
                            message: "coins updated but credit not found ??"
                        });
                    });
                } else {
                    log.error('Not enough coins to remove or player not found.');
                }
            }).catch((error) => {
                log.error(error);
                next({
                    status: 404,
                    message: "Not found"
                });
            });
        }
    },
    checkSolvability: async (req, res, next) => {
        const idGame = req.body.idGame;
        const idPlayer = req.body.idPlayer;
        const amount = req.body.amount;
        const interest = req.body.interest;
        if (!idGame && !idPlayer) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findById(idGame).then(async game => {
                    const player = _.find(game.players, {id: idPlayer});
                    if (player.coins >= amount) {
                        next({status: 200, message: ""})
                    } else if (player.cards.length > 3) {
                        next({status: 200, message: ""})
                        // } else if (etc...) {
                        //     next({status: 400, message: ""})
                    } else {
                        next({status: 400, message: "non solvable"});
                    }
                }
            ).catch(error => {
                    log.error(error);
                    next({status: 404, message: "Not found"});
                }
            );
        }
    },
    resetIdGameDebtTimers(idGame) {
        bankTimerManager.stopAndRemoveAllIdGameDebtTimer(idGame);
    },
    startCreditsByIdGame(idGame) {
        // $push: {'events': newEvent},
        GameModel.findOneAndUpdate(
            {_id: idGame, 'credits.status': 'paused'},
            {
                $set: {'credits.$.status': 'running'},
            }, {new: true}
        ).then(updatedGame => {
            bankTimerManager.startAllIdGameDebtTimer(idGame);
            io().to(idGame).emit("credits-started");
        }).catch((error) => {
            log.error(error);
        });
    }
}
