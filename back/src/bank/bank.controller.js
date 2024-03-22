import GameModel, {constructor} from "../game/game.model.js";
import * as C from "../../../config/constantes.js";
import mongoose from "mongoose";
import {io} from "../../conf_socket.js";
import log from "../../conf_log.js";
import _ from "lodash";
import GameTimer from "../game/GameTimer.js";

let debtTimers = [];

const minute = 60 * 1000;


function addDebtTimer(id, startTickNow, credit, intervalInterestDuration) {
    let debtTimer = new GameTimer(id, "untilEnd", intervalInterestDuration, {credit: credit},
        (timer) => {
            io().to(timer.id).emit(C.TIMER_INTEREST);
        },
        () => {
        });
    if (startTickNow) {
        debtTimer.start();
    }
    // Store the debt timer in the list
    debtTimers.push(debtTimer);
}

function startAllDebtTimer(){
    _.forEach(debtTimers, (timer)=> timer.start());
}

function stopAndRemoveTimer(idDebt) {
    let timer = _.find(debtTimers, (timer) => timer.id === idDebt);
    if (timer) {
        timer.stop();
        _.remove(debtTimers, {"id": idDebt});
    }
}

export default {
    createCredit: async (req, res, next) => {
        console.log(req.body);
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
                    startNow ? "running" : "created",
                    Date.now(),
                    startNow ? Date.now() : null,
                    null
                )
                let newEvent = constructor.event(C.NEW_CREDIT, C.MASTER, idPlayer, amount, [credit], Date.now());
                GameModel.findByIdAndUpdate(idGame, {
                    $push: {
                        'credits': credit,
                        'events': newEvent,
                    },
                    $inc: {
                        'currentMassMonetary': amount
                    }
                }, {
                    new: true
                }).then((updatedGame) => {
                    addDebtTimer(idGame, id, startNow, credit, updatedGame.timerInterestPayment);
                    io().to(idGame).emit(C.EVENT, newEvent);
                    io().to(idPlayer).emit(C.NEW_CREDIT, credit);
                    res.status(200).json({"status": "credit added"});
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
    }
}
