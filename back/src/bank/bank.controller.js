import GameModel, {constructor} from "../game/game.model.js";
import * as C from "../../../config/constantes.js";
import mongoose from "mongoose";
import {io} from "../../config/socket.js";
import log from "../../config/log.js";
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

function addPrisonTimer(id, duration, data) {
    bankTimerManager.addTimer(new Timer(id, duration * minute, fiveSeconds, data,
        (timer) => {
            let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
            let totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);

            const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
            io().to(timer.data.idGame + "bank").emit(C.PROGRESS_PRISON, {id, progress, remainingTime});
            io().to(timer.data.idPlayer).emit(C.PROGRESS_PRISON, {id, progress, remainingTime});
        },
        (timer) => {
            timeoutPrison(timer);
        }), true);
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
                        io().to(credit.idGame + "event").emit(C.EVENT, newEvent);
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
                        io().to(credit.idGame + "event").emit(C.EVENT, newEvent);
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

function timeoutPrison(timer) {
    if (timer) {
        const data = timer.data;
        bankTimerManager.stopAndRemoveTimer(timer.id).then(async () => {
            let newEvent = constructor.event(C.PRISON_ENDED, C.MASTER, data.idPlayer, 0, [], Date.now());
            GameModel.updateOne(
                {_id: data.idGame, 'players._id': data.idPlayer},
                {
                    $set: {'players.$.status': C.ALIVE},
                    $push: {'events': newEvent},
                }
            ).then(updatedGame => {
                io().to(data.idGame + "event").emit(C.EVENT, newEvent);
                io().to(data.idPlayer).emit(C.PRISON_ENDED, {});
                io().to(data.idGame + "bank").emit(C.PRISON_ENDED, {idPlayer: data.idPlayer});
            }).catch((error) => {
                log.error(error);
            });
        });
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
                    io().to(idGame + "event").emit(C.EVENT, newEvent);
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
                        if (canPay) {
                            let newEvent = constructor.event(C.CREDIT_DONE, C.MASTER, credit.idPlayer, credit.interest, [credit], Date.now());
                            GameModel.findOneAndUpdate(
                                {_id: credit.idGame, 'credits._id': credit._id},
                                {
                                    $set: {'credits.$.status': C.CREDIT_DONE, 'credits.$.endDate': Date.now()},
                                    $inc: {'bankInterestEarned': credit.interest, 'currentMassMonetary': -credit.amount},
                                    $push: {'events': newEvent},
                                }, {new: true}
                            ).then(updatedGame => {
                                let creditUpdated = _.find(updatedGame.credits, c => c._id == credit._id);
                                bankTimerManager.stopAndRemoveTimer(credit._id);
                                io().to(credit.idGame + "event").emit(C.EVENT, newEvent);
                                io().to(credit.idPlayer).emit(C.CREDIT_DONE, creditUpdated);
                                io().to(credit.idGame + "bank").emit(C.CREDIT_DONE, creditUpdated);
                                res.status(200).json(creditUpdated);
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
                {_id: credit.idGame, 'players._id': credit.idPlayer},
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
                                const creditUpdated = _.find(updatedGame.credits, c => c._id == credit._id);
                                addDebtTimer(credit._id, true, updatedGame.timerCredit, creditUpdated);
                                io().to(credit.idGame + "event").emit(C.EVENT, newEvent);
                                io().to(credit.idGame).emit(C.PAYED_INTEREST, creditUpdated);
                                res.status(200).json(creditUpdated);
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
    seizure: async (req, res, next) => {
        const credit = req.body.credit;
        const seizure = req.body.seizure;
        if (!credit && !seizure) {
            next({status: 400, message: "bad request"});
        } else {
            try {
                let newEvent = constructor.event(C.SEIZURE, credit.idPlayer, "bank", seizure.coins, [seizure.cards], Date.now());
                // remove card and coins of player
                await GameModel.updateOne(
                    {_id: credit.idGame, 'players._id': credit.idPlayer},
                    {
                        $pull: {'players.$.cards': {_id: {$in: seizure.cards.map(c => c.id)}}},
                        $inc: {'players.$.coins': -seizure.coins},
                        $push: {'events': newEvent},
                    }
                );
                io().to(credit.idPlayer).emit(C.SEIZURE, {seizure: seizure});
                // add cards back to the deck
                GameModel.findById(credit.idGame, function (err, game) {
                    if (err) {
                        log.error("Error fetching game: ", err);
                    } else {
                        _.forEach(seizure.cards, card => {
                            game.decks[card.weight].push(card);
                        });
                        // Save the updated game
                        game.save(function (err, updatedGame) {
                            if (err) {
                                log.error("Error updating game: ", err);
                            }
                        });
                    }
                });
                // remove coins MMonetary and update status credit
                await GameModel.updateOne(
                    {_id: credit.idGame, 'credits._id': credit._id},
                    {
                        $inc: {'currentMassMonetary': -seizure.coins},
                        $set: {
                            'credits.$.status': C.CREDIT_DONE,
                            'credits.$.endDate': Date.now(),
                        },
                    }
                );
                credit.status = C.CREDIT_DONE;
                credit.endDate = Date.now();
                io().to(credit.idGame + "event").emit(C.EVENT, newEvent);
                io().to(credit.idPlayer).emit(C.CREDIT_DONE, {credit});
                // PRISON ?
                console.log('prison ???');
                if (seizure.prisonTime && seizure.prisonTime > 0) {
                    console.log("prison !!!")
                    let newEvent2 = constructor.event(C.PRISON, "bank", credit.idPlayer, seizure.prisonTime, [], Date.now());
                    GameModel.findByIdAndUpdate(
                        {_id: credit.idGame, 'players._id': credit.idPlayer},
                        {
                            $set: {'players.$.status': C.PRISON},
                            $push: {'events': newEvent2},
                        }, {new: true}
                    ).then(updatedGame => {
                        let prisoner = _.find(updatedGame.players, p => p._id == credit.idPlayer);
                        addPrisonTimer(credit.idPlayer, seizure.prisonTime, {
                            idPlayer: credit.idPlayer,
                            idGame: credit.idGame
                        })
                        console.log("prisoner:", prisoner);
                        io().to(credit.idGame + "event").emit(C.EVENT, newEvent2);
                        io().to(credit.idPlayer).emit(C.PRISON, {});
                        res.status(200).json({credit: credit, prisoner: prisoner});
                    });
                } else {
                    console.log("pas prison :/ ...")
                    res.status(200).json({credit: credit});
                }
            } catch (e) {
                log.error(e);
                next({status: 500, message: e});
            }
        }
    },
    resetIdGameDebtTimers(idGame) {
        bankTimerManager.stopAndRemoveAllIdGameDebtTimer(idGame);
    },
    startCreditsByIdGame(idGame) {
        GameModel.updateMany(
            {_id: idGame, 'credits.status': C.PAUSED_CREDIT},
            {
                $set: {'credits.$[].status': C.RUNNING_CREDIT},
            }, {new: true}
        ).then(updatedGame => {
            bankTimerManager.startAllIdGameDebtTimer(idGame);
            io().to(idGame).emit(C.CREDITS_STARTED);
        }).catch((error) => {
            log.error(error);
        });
    }
}
