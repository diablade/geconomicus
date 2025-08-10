import GameModel, {constructor} from "../game/game.model.js";
import _ from "lodash";
import * as C from "../../../config/constantes.js";
import bankTimerManager from "./BankTimerManager.js";
import socket from "../../config/socket.js";
import log from "../../config/log.js";
import decksService from "../misc/decks.service.js";
import playerService from "../player/player.service.js";
import Timer from "../misc/Timer.js";
import {differenceInMilliseconds} from "date-fns";
import mongoose from 'mongoose';

const minute = 60 * 1000;
const fiveSeconds = 5 * 1000;

const createCredit = async (idGame, idPlayer, amount, interest, startNow) => {
    let id = new mongoose.Types.ObjectId();
    const credit = constructor.credit(id, amount, interest, idGame, idPlayer, startNow ? C.RUNNING_CREDIT : C.PAUSED_CREDIT, Date.now(),
        startNow ? Date.now() : null, null);
    let newEvent = constructor.event(C.NEW_CREDIT, C.MASTER, idPlayer, amount, [credit], Date.now());

    const updatedGame = await GameModel.findOneAndUpdate({
        _id:           idGame,
        "players._id": idPlayer
    }, {
        $push: {
            credits: credit,
            events:  newEvent
        },
        $inc:  {
            currentMassMonetary: amount,
            "players.$.coins":   amount
        }
    }, {
        new: true
    });
    addDebtTimer(id.toString(), startNow, updatedGame.timerCredit, credit);
    socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
    socket.emitAckTo(idPlayer, C.NEW_CREDIT, {credit});
    return credit;
}

const getCreditOnActionPayment = async (idGame, idPlayer, idCredit, action) => {
    const credit = await getCreditOfPlayer(idGame, idPlayer, idCredit);
    if (!credit) {
        throw new Error("Can't find credit to check amount to pay");
    }
    const player = await playerService.getPlayer(idGame, idPlayer);
    if (!player) {
        throw new Error("Can't find player to check amount to pay");
    }
    if (credit.idPlayer !== idPlayer) {
        throw new Error("Player is not the owner of this credit");
    }
    if (credit.status === C.CREDIT_DONE) {
        throw new Error("Credit is already done");
    }

    if (action === C.SETTLE_CREDIT) {
        return {
            credit,
            player,
            canPay: credit.amount + credit.interest <= player.coins
        };
    }
    if (action === C.PAY_INTEREST) {
        return {
            credit,
            player,
            canPay: credit.interest <= player.coins
        };
    }
    if (action === C.SEIZURE) {
        return {
            credit,
            player,
            canPay: credit.status === C.DEFAULT_CREDIT
        };
    }
    else {
        throw new Error("Action not found");
    }
}
const addDebtTimer = (id, startTickNow, duration, data) => {
    bankTimerManager.addTimer(new Timer(id, duration * minute, fiveSeconds, data, (timer) => {
        let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
        let totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);

        const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
        socket.emitTo(timer.data.idGame + C.BANK, C.PROGRESS_CREDIT, {
            id,
            progress,
        });
        socket.emitTo(timer.data.idPlayer, C.PROGRESS_CREDIT, {
            id,
            progress
        });
    }, (timer) => {
        timeoutCredit(timer);
    }), startTickNow);
}
const seizeCards = (cards, targetAmount) => {
    // Function to seize cards to match the target amount cardsValue
    // Sort the player's cards by price in descending order
    const sortedCards = _.sortBy(cards, 'price').reverse();

    let seizedCards = [];
    let remainingAmount = targetAmount;

    // Seize cards until the target amount is reached
    for (let card of sortedCards) {
        if (remainingAmount <= 0) {
            break;
        } // Stop if the target is met

        if (card.price <= remainingAmount) {
            seizedCards.push(card); // Add card to seized list
            remainingAmount -= card.price; // Reduce the target by card's price
        }
    }
    return seizedCards;
};
const getRunningCreditsOfPlayer = async (idGame, idPlayer) => {
    const game = await GameModel.findById(idGame.toString());
    return game.credits.filter(credit => credit.idPlayer === idPlayer && credit.status !== C.CREDIT_DONE);
}
const getCreditOfPlayer = async (idGame, idPlayer, idCredit) => {
    const game = await GameModel.findById(idGame.toString());
    return game.credits.find(credit => credit.idPlayer === idPlayer && credit._id == idCredit);
}
const seizure = async (idCredit, idGame, idPlayer, seizure) => {
    let {
        credit,
        canPay
    } = await getCreditOnActionPayment(idGame, idPlayer, idCredit, C.SEIZURE);
    if (!canPay) {
        throw new Error("wrong credit");
    }
    let newEvent = constructor.event(C.SEIZURE, idPlayer, C.BANK, seizure.coins, seizure.cards, Date.now());
    let interestSeized = seizure.interest >= seizure.coins ? seizure.interest : 0;
    let cardsValue = seizure.cards.reduce((acc, c) => c.price + acc, 0);

    // remove card and coins of player
    await GameModel.updateOne({
        _id:           idGame,
        "players._id": idPlayer
    }, {
        $pull: {
            "players.$.cards": {
                _id: {$in: seizure.cards.map((c) => c._id)},
            },
        },
        $inc:  {"players.$.coins": -seizure.coins},
        $push: {events: newEvent},
    });

    //PUT BACK CARDS IN THE DECKs
    await decksService.pushCardsInDecks(idGame, seizure.cards);
    // remove coins MMonetary and update status credit
    await GameModel.updateOne({
        _id:           idGame,
        "credits._id": idCredit
    }, {
        $inc: {
            currentMassMonetary: -seizure.coins,
            bankInterestEarned:  +interestSeized,
            bankGoodsEarned:     cardsValue,
        },
        $set: {
            "credits.$.status":  C.CREDIT_DONE,
            "credits.$.endDate": Date.now(),
        },
    });
    credit.status = C.CREDIT_DONE;
    credit.endDate = Date.now();
    socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
    // PRISON OU PAS ...
    if (seizure.prisonTime && seizure.prisonTime > 0) {
        const result = await lockDownPlayer(idPlayer, idGame, seizure.prisonTime);
        socket.emitTo(idGame + C.EVENT, C.EVENT, result.event);
        socket.emitAckTo(idPlayer, C.SEIZURE, {
            credit:   credit,
            seizure:  seizure,
            prisoner: result.prisoner,
        });
        return {
            credit:   credit,
            seizure:  seizure,
            prisoner: result.prisoner,
        };
    }
    else {
        socket.emitAckTo(idPlayer, C.SEIZURE, {
            credit:   credit,
            seizure:  seizure,
            prisoner: undefined,
        });
        return {
            credit:   credit,
            seizure:  seizure,
            prisoner: undefined,
        };
    }
}
const seizureOnDead = async (idGame, idPlayer) => {
    let player = await playerService.getPlayer(idGame, idPlayer);
    let cardsValue = _.reduce(player.cards, (acc, c) => c.price + acc, 0);
    let credits = await getRunningCreditsOfPlayer(idGame, idPlayer);

    let totalPayedInterest = 0;
    let totalPayedAmount = 0;
    let totalValuesToSeize = 0;
    let totalNotPayed = 0; //rest that is not payed by coins or cards

    for (let credit of credits) {
        let payedInterest = 0;
        let payedAmount = 0;
        let seizureCardsValue = 0;

        // FIRST PAY INTEREST
        if ((player.coins - credit.interest) >= 0) {
            payedInterest = credit.interest;
            player.coins -= credit.interest;
            credit.interest = 0;
        }
        else {
            //seizure on cards
            if (cardsValue >= credit.interest) {
                cardsValue -= credit.interest;
                seizureCardsValue += credit.interest;
                credit.interest = 0;
            }
            else {
                seizureCardsValue += cardsValue;
                cardsValue = 0;
                credit.interest -= cardsValue;
            }
        }

        //SECOND PAY CREDIT AMOUNT
        if ((player.coins - credit.amount) >= 0) {
            player.coins -= credit.amount;
            payedAmount += credit.amount;
            credit.amount = 0;
        }
        else {
            // seize the rest coins
            credit.amount -= player.coins;
            payedAmount += player.coins;
            player.coins = 0;
            //seizure on cards
            if (cardsValue >= credit.amount) {
                cardsValue -= credit.amount;
                seizureCardsValue += credit.amount;
                credit.amount = 0;
            }
            else {
                seizureCardsValue += cardsValue;
                credit.amount -= cardsValue;
                cardsValue = 0;
            }
        }

        // update status credit
        await GameModel.updateOne({
            _id:           credit.idGame,
            'credits._id': credit._id
        }, {
            $set: {
                'credits.$.status':  C.CREDIT_DONE,
                'credits.$.endDate': Date.now(),
            },
        });
        totalPayedInterest += payedInterest;
        totalPayedAmount += payedAmount;
        totalValuesToSeize += seizureCardsValue;
        totalNotPayed += (credit.interest + credit.amount);
    }

    //convert value to cards
    let totalSeizedCards = seizeCards(player.cards, totalValuesToSeize);
    let totalSeizedCardsValue = _.reduce(totalSeizedCards, (acc, c) => c.price + acc, 0);
    let totalPayedInCoins = totalPayedInterest + totalPayedAmount;

    //PUT BACK seized CARDS IN THE DECKs
    await decksService.pushCardsInDecks(idGame, totalSeizedCards);
    // remove seized cards from player's hand
    // user update, bank update, and MMonetary update
    let event = constructor.event(C.SEIZED_DEAD, idPlayer, C.BANK, totalPayedInCoins, [
        {
            interest:        totalPayedInterest,
            amount:          totalPayedAmount,
            cards:           totalSeizedCards,
            bankMoneyLost:   totalNotPayed,
            bankGoodsEarned: totalSeizedCardsValue
        }
    ], Date.now());
    await GameModel.updateOne({
        _id:           idGame,
        'players._id': idPlayer
    }, {
        $inc:  {
            'players.$.coins':     -totalPayedInCoins,
            'bankInterestEarned':  totalPayedInterest,
            'bankGoodsEarned':     totalSeizedCardsValue,
            'bankMoneyLost':       totalNotPayed,
            'currentMassMonetary': -totalPayedInCoins
        },
        $pull: {'players.$.cards': {_id: {$in: totalSeizedCards.map(c => c.id)}}},
        $push: {'events': event},
    },);
    return event;
}

const settleCredit = async (idCredit, idGame, idPlayer) => {
    try {
        const {
            credit,
            canPay
        } = await getCreditOnActionPayment(idGame, idPlayer, idCredit, C.SETTLE_CREDIT);
        if (canPay) {
            let newEvent = constructor.event(C.SETTLE_CREDIT, credit.idPlayer, C.BANK, (credit.interest + credit.amount), [credit], Date.now());
            const updatedGame = await GameModel.findOneAndUpdate({
                _id:           credit.idGame,
                'players._id': idPlayer,
                'credits._id': credit._id.toString(),
            }, {
                $inc:  {
                    'players.$.coins':     -(credit.interest + credit.amount),
                    'bankInterestEarned':  credit.interest,
                    'currentMassMonetary': -(credit.interest + credit.amount)
                },
                $set:  {
                    'credits.$[c].status':  C.CREDIT_DONE,
                    'credits.$[c].endDate': Date.now()
                },
                $push: {'events': newEvent},
            }, {
                new:          true,
                arrayFilters: [{'c._id': credit._id.toString()}]
            });

            let creditUpdated = updatedGame.credits.find(c => c._id.toString() === credit._id.toString());
            await bankTimerManager.stopAndRemoveTimer(credit._id.toString());
            socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
            socket.emitAckTo(idPlayer, C.CREDIT_DONE, {credit:creditUpdated});
            socket.emitTo(idGame + C.BANK, C.CREDIT_DONE, creditUpdated);
            return creditUpdated;
        }
        else {
            return undefined;
        }
    }
    catch (err) {
        log.error(err);
        throw err;
    }
}

const payInterest = async (idCredit, idGame, idPlayer) => {
    const {
        credit,
        canPay
    } = await getCreditOnActionPayment(idGame, idPlayer, idCredit, C.PAY_INTEREST);

    if (!canPay) {
        throw new Error("Not enough coins to pay interest.");
    }

    const newEvent = constructor.event(C.PAYED_INTEREST, idPlayer, C.BANK, credit.interest, [credit], Date.now());

    const updatedGameAfterCoins = await GameModel.findOneAndUpdate({
        _id:           idGame,
        "players._id": idPlayer
    }, {
        $inc:  {
            "players.$.coins":   -credit.interest,
            currentMassMonetary: -credit.interest,
            bankInterestEarned:  credit.interest,
        },
        $push: {events: newEvent},
    }, {new: true});

    if (!updatedGameAfterCoins) {
        throw new Error("Player not found or insufficient coins.");
    }

    const updatedGameAfterCredit = await GameModel.findOneAndUpdate({
        _id:           idGame,
        "credits._id": credit._id
    }, {
        $set: {"credits.$.status": C.RUNNING_CREDIT},
        $inc: {"credits.$.extended": 1},
    }, {new: true});

    if (!updatedGameAfterCredit) {
        throw new Error("Credit not found for update.");
    }

    const creditUpdated = updatedGameAfterCredit.credits.find(c => c._id.toString() === credit._id.toString());

    if (!creditUpdated) {
        throw new Error("Updated credit not found after update.");
    }

    addDebtTimer(credit._id.toString(), true, updatedGameAfterCredit.timerCredit, creditUpdated);

    socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
    socket.emitTo(idGame + C.BANK, C.PAYED_INTEREST, creditUpdated);

    return creditUpdated;

}

const addPrisonTimer = (id, duration, data) => {
    bankTimerManager.addTimer(new Timer(id, duration * minute, fiveSeconds, data, (timer) => {
        let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
        let totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);

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
    }, (timer) => {
        timeoutPrison(timer);
    }), true);
}

const timeoutCredit = async (timer) => {
    if (timer) {
        const credit = timer.data;
        await bankTimerManager.stopAndRemoveTimer(timer.id).then(async () => {
            getCreditOnActionPayment(credit.idGame, credit.idPlayer, credit._id.toString(), C.PAY_INTEREST)
                .then(({
                           credit,
                           player,
                           canPay
                       }) => {
                    if (credit && canPay) {
                        let newEvent = constructor.event(C.REQUEST_CREDIT, C.MASTER, credit.idPlayer, credit.amount, [credit], Date.now());
                        GameModel.findOneAndUpdate({
                            _id:           credit.idGame,
                            "credits._id": credit._id
                        }, {
                            $set:  {"credits.$.status": C.REQUEST_CREDIT},
                            $push: {events: newEvent},
                        })
                            .then((result) => {
                                credit.status = C.REQUEST_CREDIT;
                                socket.emitTo(credit.idGame + C.EVENT, C.EVENT, newEvent);
                                socket.emitAckTo(credit.idPlayer, C.TIMEOUT_CREDIT, {credit});
                                socket.emitTo(credit.idGame + C.BANK, C.TIMEOUT_CREDIT, credit);
                            })
                            .catch((error) => {
                                log.error(error);
                            });
                    }
                    else {
                        let newEvent = constructor.event(C.DEFAULT_CREDIT, C.MASTER, credit.idPlayer, credit.amount, [credit], Date.now());
                        GameModel.findOneAndUpdate({
                            _id:           credit.idGame,
                            "credits._id": credit._id
                        }, {
                            $set:  {"credits.$.status": C.DEFAULT_CREDIT},
                            $push: {events: newEvent},
                        })
                            .then((update) => {
                                credit.status = C.DEFAULT_CREDIT;
                                socket.emitTo(credit.idGame + C.EVENT, C.EVENT, newEvent);
                                socket.emitTo(credit.idGame + C.BANK, C.DEFAULT_CREDIT, credit);
                                if (credit && player.status !== C.DEAD) {
                                    socket.emitAckTo(credit.idPlayer, C.DEFAULT_CREDIT, {credit});
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

const lockDownPlayer = async (idPlayer, idGame, prisonTime) => {
    let event = constructor.event(C.PRISON, C.BANK, idPlayer, prisonTime, [], Date.now());

    const updatedGame = await GameModel.findOneAndUpdate({
        _id:           idGame,
        "players._id": idPlayer
    }, {
        $set:  {"players.$.status": C.PRISON},
        $push: {events: event},
    }, {new: true});

    let prisoner = updatedGame.players.find(p => p._id.toString() === idPlayer);
    addPrisonTimer(idPlayer, prisonTime, {
        idPlayer: idPlayer,
        idGame:   idGame,
    });
    return {
        prisoner,
        event
    };
}

const timeoutPrison = async (timer) => {
    if (timer) {
        const data = timer.data;
        await bankTimerManager.stopAndRemoveTimer(timer.id);
        await getOut(data.idGame, data.idPlayer);
    }
}

const getOut = async (idGame, idPlayer) => {
    try {
        let game = await GameModel.findById(idGame);
        const shuffledDeck = _.shuffle(game.decks[0]);
        // Draw new cards for the player
        const newCards = shuffledDeck.slice(0, 4); //same weight
        // draw newCards in bdd
        await GameModel.updateOne({_id: idGame}, {
            $pull: {
                [`decks.${0}`]: {_id: {$in: newCards.map((c) => c._id)}},
            },
        });
        // and Add new cards to player's hand and event
        let newEvent = constructor.event(C.PRISON_ENDED, C.MASTER, idPlayer, 0, newCards, Date.now());
        await GameModel.updateOne({
            _id:           idGame,
            "players._id": idPlayer
        }, {
            $set:  {"players.$.status": C.ALIVE},
            $push: {
                "players.$.cards": {$each: newCards},
                events:            newEvent,
            },
        });
        socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
        socket.emitAckTo(idPlayer, C.PRISON_ENDED, {cards: newCards});
        socket.emitTo(idGame + C.BANK, C.PRISON_ENDED, {
            idPlayer: idPlayer,
            cards:    newCards,
        });
    }
    catch (err) {
        log.error(err);
    }
}

const startCreditsByIdGame = async (idGame) => {
    GameModel.updateMany({
        _id:              idGame,
        "credits.status": C.PAUSED_CREDIT
    }, {
        $set: {"credits.$[].status": C.RUNNING_CREDIT},
    }, {new: true})
        .then((updatedGame) => {
            bankTimerManager.startAllIdGameDebtTimer(idGame);
            socket.emitTo(idGame + C.BANK, C.CREDITS_STARTED);
        })
        .catch((error) => {
            log.error(error);
        });
}

export default {
    getRunningCreditsOfPlayer,
    getCreditOnActionPayment,
    seizure,
    seizureOnDead,
    createCredit,
    settleCredit,
    payInterest,
    addDebtTimer,
    addPrisonTimer,
    timeoutCredit,
    timeoutPrison,
    lockDownPlayer,
    startCreditsByIdGame,
    getOut,
}
