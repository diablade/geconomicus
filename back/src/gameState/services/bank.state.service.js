import GameModel, {constructor} from "../game/game.model.js";
import _ from "lodash";
import { ALIVE, BANK, CREDIT_DONE, CREDITS_STARTED, DEAD, DEFAULT_CREDIT, EVENT, MASTER, NEW_CREDIT, PAUSED_CREDIT, PAY_INTEREST, PAYED_INTEREST, PRISON, PRISON_ENDED, PROGRESS_CREDIT, PROGRESS_PRISON, REQUEST_CREDIT, RUNNING_CREDIT, SEIZED_DEAD, SEIZURE, SETTLE_CREDIT, TIMEOUT_CREDIT } from '#constantes';
import bankTimerManager from "./BankTimerManager.js";
import socket from "#config/socket";
import log from "#config/log";
import decksService from "../misc/legacy.decks.service.js";
import playerService from "../player/player.service.js";
import Timer from "../misc/Timer.js";
import {differenceInMilliseconds} from "date-fns";
import mongoose from 'mongoose';


const minute = 60 * 1000;
const fiveSeconds = 5 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────

const _findPlayer = (state, playerLifeIdx) => {
    const player = state.playersStates.find(p => p.idx === playerLifeIdx);
    if (!player) throw new Error(`Player idx ${playerLifeIdx} not found`);
    return player;
};

const _findCredit = (state, creditIdx) => {
    const credit = state.credits.find(c => idx === creditIdx);
    if (!credit) throw new Error(`Credit idx ${creditIdx} not found`);
    return credit;
};

// ─── Timer helpers ───────────────────────────────────────────────────────────

const _addDebtTimer = (creditId, startTickNow, duration, data) => {
    bankTimerManager.addTimer(new Timer(creditId, duration * minute, fiveSeconds, data, (timer) => {
        const remainingTime = differenceInMilliseconds(timer.endTime, new Date());
        const totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);
        const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
        socket.emitTo(timer.data.gameStateId + BANK, IO.CREDIT_PROGRESS, { id: creditId, progress });
        socket.emitTo(timer.data.playerLifeIdx.toString(), IO.CREDIT_PROGRESS, { id: creditId, progress });
    }, (timer) => {
        _timeoutCredit(timer);
    }), startTickNow);
};

const _addPrisonTimer = (playerId, duration, data) => {
    bankTimerManager.addTimer(new Timer(playerId, duration * minute, fiveSeconds, data, (timer) => {
        const remainingTime = differenceInMilliseconds(timer.endTime, new Date());
        const totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);
        const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
        socket.emitTo(timer.data.gameStateId + BANK, IO.PRISON_PROGRESS, { id: playerId, progress, remainingTime });
        socket.emitTo(timer.data.playerLifeIdx.toString(), IO.PRISON_PROGRESS, { id: playerId, progress, remainingTime });
    }, (timer) => {
        _timeoutPrison(timer);
    }), true);
};

const _timeoutCredit = async (timer) => {
    if (!timer) return;
    const { gameStateId, playerLifeIdx, creditIdx } = timer.data;
    await bankTimerManager.stopAndRemoveTimer(timer.id);

    try {
        await inMemoryGameStateManager.withLock(gameStateId, ({ state, rules }) => {
            const credit = _findCredit(state, creditIdx);
            const player = _findPlayer(state, playerLifeIdx);

            if (credit.status === CREDIT_DONE) return;

            if (credit.amount + credit.interest <= player.coins) {
                // Player can pay interest — request it
                credit.status = REQUEST_CREDIT;
                const event = _makeEvent(REQUEST_CREDIT, MASTER, playerLifeIdx, credit.amount, [credit]);
                state.events = state.events || [];
                state.events.push(event);
                socket.emitTo(gameStateId + EVENT, EVENT, event);
                socket.emitAckTo(playerLifeIdx.toString(), IO.CREDIT_TIMEOUT, { credit });
                socket.emitTo(gameStateId + BANK, IO.CREDIT_TIMEOUT, credit);
            } else {
                // Default
                credit.status = DEFAULT_CREDIT;
                const event = _makeEvent(DEFAULT_CREDIT, MASTER, playerLifeIdx, credit.amount, [credit]);
                state.events = state.events || [];
                state.events.push(event);
                socket.emitTo(gameStateId + EVENT, EVENT, event);
                socket.emitTo(gameStateId + BANK, IO.CREDIT_DEFAULT, credit);
                if (player.status !== DEAD) {
                    socket.emitAckTo(playerLifeIdx.toString(), IO.CREDIT_DEFAULT, { credit });
                }
            }
        });
    } catch (err) {
        log.error(`[bankMemService] _timeoutCredit error: ${err}`);
    }
};

const _timeoutPrison = async (timer) => {
    if (!timer) return;
    const { gameStateId, playerLifeIdx } = timer.data;
    await bankTimerManager.stopAndRemoveTimer(timer.id);
    await getOut(gameStateId, playerLifeIdx);
};

// Simple event builder (mirrors legacy constructor.event shape)
const _makeEvent = (type, from, to, amount, items) => ({
    type,
    from: from?.toString?.() ?? from,
    to: to?.toString?.() ?? to,
    amount,
    items,
    date: Date.now(),
});

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a credit for a player.
 * Adds coins (amount) to player, pushes credit into state.credits,
 * updates currentMassMonetary, starts a debt timer.
 */
const createCredit = async (idGame, idPlayer, amount, interest, startNow) => {
    let id = new mongoose.Types.ObjectId();
    const credit = constructor.credit(id, amount, interest, idGame, idPlayer, startNow ? RUNNING_CREDIT : PAUSED_CREDIT, Date.now(),
        startNow ? Date.now() : null, null);
    let newEvent = constructor.event(NEW_CREDIT, MASTER, idPlayer, amount, [credit], Date.now());

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
    socket.emitTo(idGame + EVENT, EVENT, newEvent);
    socket.emitAckTo(idPlayer, NEW_CREDIT, {credit});
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
    if (credit.status === CREDIT_DONE) {
        throw new Error("Credit is already done");
    }

    if (action === SETTLE_CREDIT) {
        return {
            credit,
            player,
            canPay: credit.amount + credit.interest <= player.coins
        };
    }
    if (action === PAY_INTEREST) {
        return {
            credit,
            player,
            canPay: credit.interest <= player.coins
        };
    }
    if (action === SEIZURE) {
        return {
            credit,
            player,
            canPay: credit.status === DEFAULT_CREDIT
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
        socket.emitTo(timer.data.idGame + BANK, PROGRESS_CREDIT, {
            id,
            progress,
        });
        socket.emitTo(timer.data.idPlayer, PROGRESS_CREDIT, {
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
    return game.credits.filter(credit => credit.idPlayer === idPlayer && credit.status !== CREDIT_DONE);
}
const getCreditOfPlayer = async (idGame, idPlayer, idCredit) => {
    const game = await GameModel.findById(idGame.toString());
    return game.credits.find(credit => credit.idPlayer === idPlayer && credit._id == idCredit);
}
const seizure = async (idCredit, idGame, idPlayer, seizure) => {
    let {
        credit,
        canPay
    } = await getCreditOnActionPayment(idGame, idPlayer, idCredit, SEIZURE);
    if (!canPay) {
        throw new Error("wrong credit");
    }
    let newEvent = constructor.event(SEIZURE, idPlayer, BANK, seizure.coins, seizure.cards, Date.now());
    let interestSeized = seizure.interest >= seizure.coins ? seizure.interest : 0;
    let cardsValue = seizure.cards.reduce((acc, c) => price + acc, 0);

    // remove card and coins of player
    await GameModel.updateOne({
        _id:           idGame,
        "players._id": idPlayer
    }, {
        $pull: {
            "players.$.cards": {
                _id: {$in: seizure.cards.map((c) => _id)},
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
            "credits.$.status":  CREDIT_DONE,
            "credits.$.endDate": Date.now(),
        },
    });
    credit.status = CREDIT_DONE;
    credit.endDate = Date.now();
    socket.emitTo(idGame + EVENT, EVENT, newEvent);
    // PRISON OU PAS ...
    if (seizure.prisonTime && seizure.prisonTime > 0) {
        const result = await lockDownPlayer(idPlayer, idGame, seizure.prisonTime);
        socket.emitTo(idGame + EVENT, EVENT, result.event);
        socket.emitAckTo(idPlayer, SEIZURE, {
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
        socket.emitAckTo(idPlayer, SEIZURE, {
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
    let cardsValue = _.reduce(player.cards, (acc, c) => price + acc, 0);
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
                'credits.$.status':  CREDIT_DONE,
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
    let totalSeizedCardsValue = _.reduce(totalSeizedCards, (acc, c) => price + acc, 0);
    let totalPayedInCoins = totalPayedInterest + totalPayedAmount;

    //PUT BACK seized CARDS IN THE DECKs
    await decksService.pushCardsInDecks(idGame, totalSeizedCards);
    // remove seized cards from player's hand
    // user update, bank update, and MMonetary update
    let event = constructor.event(SEIZED_DEAD, idPlayer, BANK, totalPayedInCoins, [
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
        $pull: {'players.$.cards': {_id: {$in: totalSeizedCards.map(c => id)}}},
        $push: {'events': event},
    },);
    return event;
}

const settleCredit = async (idCredit, idGame, idPlayer) => {
    try {
        const {
            credit,
            canPay
        } = await getCreditOnActionPayment(idGame, idPlayer, idCredit, SETTLE_CREDIT);
        if (canPay) {
            let newEvent = constructor.event(SETTLE_CREDIT, credit.idPlayer, BANK, (credit.interest + credit.amount), [credit], Date.now());
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
                    'credits.$[c].status':  CREDIT_DONE,
                    'credits.$[c].endDate': Date.now()
                },
                $push: {'events': newEvent},
            }, {
                new:          true,
                arrayFilters: [{'_id': credit._id.toString()}]
            });

            let creditUpdated = updatedGame.credits.find(c => _id.toString() === credit._id.toString());
            await bankTimerManager.stopAndRemoveTimer(credit._id.toString());
            socket.emitTo(idGame + EVENT, EVENT, newEvent);
            socket.emitAckTo(idPlayer, CREDIT_DONE, {credit:creditUpdated});
            socket.emitTo(idGame + BANK, CREDIT_DONE, {credit:creditUpdated});
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
    } = await getCreditOnActionPayment(idGame, idPlayer, idCredit, PAY_INTEREST);

    if (!canPay) {
        throw new Error("Not enough coins to pay interest.");
    }

    const newEvent = constructor.event(PAYED_INTEREST, idPlayer, BANK, credit.interest, [credit], Date.now());

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
        $set: {"credits.$.status": RUNNING_CREDIT},
        $inc: {"credits.$.extended": 1},
    }, {new: true});

    if (!updatedGameAfterCredit) {
        throw new Error("Credit not found for update.");
    }

    const creditUpdated = updatedGameAfterCredit.credits.find(c => _id.toString() === credit._id.toString());

    if (!creditUpdated) {
        throw new Error("Updated credit not found after update.");
    }

    addDebtTimer(credit._id.toString(), true, updatedGameAfterCredit.timerCredit, creditUpdated);

    socket.emitTo(idGame + EVENT, EVENT, newEvent);
    socket.emitTo(idGame + BANK, PAYED_INTEREST, creditUpdated);

    return creditUpdated;

}

const addPrisonTimer = (id, duration, data) => {
    bankTimerManager.addTimer(new Timer(id, duration * minute, fiveSeconds, data, (timer) => {
        let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
        let totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);

        const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
        socket.emitTo(timer.data.idGame + BANK, PROGRESS_PRISON, {
            id,
            progress,
            remainingTime,
        });
        socket.emitTo(timer.data.idPlayer, PROGRESS_PRISON, {
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
            getCreditOnActionPayment(credit.idGame, credit.idPlayer, credit._id.toString(), PAY_INTEREST)
                .then(({
                           credit,
                           player,
                           canPay
                       }) => {
                    if (credit && canPay) {
                        let newEvent = constructor.event(REQUEST_CREDIT, MASTER, credit.idPlayer, credit.amount, [credit], Date.now());
                        GameModel.findOneAndUpdate({
                            _id:           credit.idGame,
                            "credits._id": credit._id
                        }, {
                            $set:  {"credits.$.status": REQUEST_CREDIT},
                            $push: {events: newEvent},
                        })
                            .then((result) => {
                                credit.status = REQUEST_CREDIT;
                                socket.emitTo(credit.idGame + EVENT, EVENT, newEvent);
                                socket.emitAckTo(credit.idPlayer, TIMEOUT_CREDIT, {credit});
                                socket.emitTo(credit.idGame + BANK, TIMEOUT_CREDIT, credit);
                            })
                            .catch((error) => {
                                log.error(error);
                            });
                    }
                    else {
                        let newEvent = constructor.event(DEFAULT_CREDIT, MASTER, credit.idPlayer, credit.amount, [credit], Date.now());
                        GameModel.findOneAndUpdate({
                            _id:           credit.idGame,
                            "credits._id": credit._id
                        }, {
                            $set:  {"credits.$.status": DEFAULT_CREDIT},
                            $push: {events: newEvent},
                        })
                            .then((update) => {
                                credit.status = DEFAULT_CREDIT;
                                socket.emitTo(credit.idGame + EVENT, EVENT, newEvent);
                                socket.emitTo(credit.idGame + BANK, DEFAULT_CREDIT, credit);
                                if (credit && player.status !== DEAD) {
                                    socket.emitAckTo(credit.idPlayer, DEFAULT_CREDIT, {credit});
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
    let event = constructor.event(PRISON, BANK, idPlayer, prisonTime, [], Date.now());

    const updatedGame = await GameModel.findOneAndUpdate({
        _id:           idGame,
        "players._id": idPlayer
    }, {
        $set:  {"players.$.status": PRISON},
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
                [`decks.${0}`]: {_id: {$in: newCards.map((c) => _id)}},
            },
        });
        // and Add new cards to player's hand and event
        let newEvent = constructor.event(PRISON_ENDED, MASTER, idPlayer, 0, newCards, Date.now());
        await GameModel.updateOne({
            _id:           idGame,
            "players._id": idPlayer
        }, {
            $set:  {"players.$.status": ALIVE},
            $push: {
                "players.$.cards": {$each: newCards},
                events:            newEvent,
            },
        });
        socket.emitTo(idGame + EVENT, EVENT, newEvent);
        socket.emitAckTo(idPlayer, PRISON_ENDED, {cards: newCards});
        socket.emitTo(idGame + BANK, PRISON_ENDED, {
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
        "credits.status": PAUSED_CREDIT
    }, {
        $set: {"credits.$[].status": RUNNING_CREDIT},
    }, {new: true})
        .then((updatedGame) => {
            bankTimerManager.startAllIdGameDebtTimer(idGame);
            socket.emitTo(idGame + BANK, CREDITS_STARTED);
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
