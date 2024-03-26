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

            timer.data.progress = 100 - Math.floor((remainingTime / totalTime) * 100);
            io().to(timer.data.idGame).emit(C.PROGRESS_CREDIT, timer.data);
        },
        (timer) => {
            timeoutCredit(timer);
        }), startTickNow);
}

function timeoutCredit(timer) {
    if (timer) {
        bankTimerManager.stopAndRemoveTimer(timer.id).then(() => {
                let credit = timer.data;
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
                    io().to(credit.idGame).emit(C.TIMEOUT_CREDIT, credit);
                }).catch((error) => {
                    log.error(error);
                });
            }
        );
    }
}

function checkSolvability(idGame, idPlayer, amountToCheck) {
    //get game credits
    //get player coins and ressources
    // check with amount

}

function checkPayment(idGame, idPlayer, amountToCheck) {
    //get game credits
    //get player coins and ressources
    // check with amount

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
                const startNow = updatedGame.status == C.START_ROUND
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
                    io().to(idGame).emit(C.EVENT, newEvent);
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
    settlementCredit: async (req, res, next) => {
        const idGame = req.body.idGame;
        const idPlayer = req.body.idPlayer;
        const credit = req.body.credit;
        if (!idGame && !idPlayer && !credit) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findById({_id: idGame})
                .then((game) => {
                        if (game) {
                            // TODO
                            // check solvability
                            //
                            //...
                            // GameModel.findOneAndUpdate(
                            //     {_id: credit.idGame, 'credits._id': credit._id},
                            //     {
                            //         $set: {'credits.$.status': C.REQUEST_CREDIT},
                            //         $push: {'events': newEvent},
                            //     }, {new: true}
                            // ).then(updatedGame => {
                            //     credit.status = C.REQUEST_CREDIT;
                            //     io().to(credit.idGame).emit(C.EVENT, newEvent);
                            //     io().to(credit.idPlayer).emit(C.TIMEOUT_CREDIT, credit);
                            //     io().to(credit.idGame).emit(C.TIMEOUT_CREDIT, credit);
                            // }).catch((error) => {
                            //     log.error(error);
                            // });
                            res.status(200).json("done");
                        } else {
                            next({
                                status: 404,
                                message: "Not found"
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
