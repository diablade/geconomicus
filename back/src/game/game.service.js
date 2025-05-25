import GameModel, {constructor} from "../game/game.model.js";
import _ from "lodash";
import gameTimerManager from "./GameTimerManager.js";
import * as C from "../../../config/constantes.js";
import bankTimerManager from "../bank/BankTimerManager.js";
import socket from "../../config/socket.js";
import log from "../../config/log.js";
import Timer from "../misc/Timer.js";
import {differenceInMilliseconds} from "date-fns";
import playerService from "../player/player.service.js";
import decksService from "../misc/decks.service.js";
import bankService from '../bank/bank.service.js';
import {customAlphabet} from 'nanoid'
import GameTimerManager from './GameTimerManager.js';
import BankTimerManager from '../bank/BankTimerManager.js';

const alphabet = 'abcdefghjkmnpqrstuvwxyz123456789' // remove o,l,i,... to avoid confusion
const nanoid = customAlphabet(alphabet, 4) // 4 characters

//***************** DEFAULT VALUES *******//
const minute = 60 * 1000;
const defaultTauxDU = 10;
const defaultPriceWeight1 = 1;
const defaultPriceWeight2 = 2;
const defaultPriceWeight3 = 4;
const defaultPriceWeight4 = 8;
const defaultPriceWeight1ML = 3;
const defaultPriceWeight2ML = 6;
const defaultPriceWeight3ML = 9;
const defaultPriceWeight4ML = 12;
//***************************************//

//***************** DIVIDENDE UNIVERSEL ENGIN **********************************//
async function generateDU(game) {
    const nbPlayer = game.players.filter(p => p.status === C.ALIVE).length;
    const moyenne = game.currentMassMonetary / nbPlayer;
    const du = moyenne * game.tauxCroissance / 100;
    const duRounded = Number(du.toFixed(2));
    return duRounded;
}

//******************************************************************************//

async function distribDU(idGame) {
    GameModel.findById(idGame)
        .then(async (game) => {
            var newEvents = [];
            const du = await generateDU(game);
            var newMassMoney = game.currentMassMonetary;
            for await (let player of game.players) {
                if (player.status === C.ALIVE) {
                    player.coins += du;
                    newMassMoney += du;
                    socket.emitTo(player.id, C.DISTRIB_DU, {du: du});
                    let newEvent = constructor.event(C.DISTRIB_DU, C.MASTER, player.id, du, [], Date.now());
                    socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
                    newEvents.push(newEvent);
                }
                else if (player.status === C.DEAD) {
                    //TO PRODUCE POINTS IN GRAPH (to see dead account devaluate)
                    let newEvent = constructor.event(C.REMIND_DEAD, C.MASTER, player.id, player.coins, [], Date.now());
                    socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
                    newEvents.push(newEvent);
                }
            }
            GameModel.findByIdAndUpdate(idGame, {
                $inc:  {"players.$[elem].coins": du},
                $push: {events: {$each: newEvents}},
                $set:  {
                    currentMassMonetary: newMassMoney,
                    currentDU:           du
                }
            }, {
                arrayFilters: [{"elem.status": C.ALIVE}],
                new:          true
            })
                .then(updatedGame => {

                })
                .catch(err => {
                    log.error('update game error:' + err);
                })
        })
        .catch(err => {
            log.error('get game error:' + err);
        })
}

async function stopRound(idGame, gameRound) {
    gameTimerManager.stopAndRemoveTimer(idGame);
    gameTimerManager.stopAndRemoveTimer(idGame + "death");

    let stopRoundEvent = constructor.event(C.STOP_ROUND, C.MASTER, "", gameRound, [], Date.now());
    GameModel.updateOne({_id: idGame}, {
        $set:  {
            status:   C.STOP_ROUND,
            modified: Date.now(),
        },
        $push: {events: stopRoundEvent}
    }).then(res => {
        bankTimerManager.stopAndRemoveAllIdGameDebtTimer(idGame);
        socket.emitTo(idGame, C.STOP_ROUND);
        socket.emitTo(idGame + C.EVENT, C.EVENT, stopRoundEvent);
    });
}

async function startRoundTimers(idGame, game, playersIdToKill) {
    const totalTimeRound = game.roundMinutes * minute;
    const intervalDeath = totalTimeRound / playersIdToKill.length;
    let timer = new Timer(idGame, totalTimeRound, minute, {
        round:     game.round,
        typeMoney: game.typeMoney
    }, async (timer) => {
        if (timer.data.typeMoney === C.JUNE) {
            await distribDU(timer.id);
        }
        let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
        let remainingMinutes = Math.round(remainingTime / 60000); // Convert milliseconds to minutes
        socket.emitTo(timer.id, C.TIMER_LEFT, remainingMinutes);
    }, async (timer) => {
        if (timer.data.typeMoney === C.JUNE) {
            await distribDU(timer.id);
        }
        stopRound(timer.id, timer.data.round);
    });
    timer.start();

    let timerDeath = new Timer(idGame + "death", totalTimeRound, intervalDeath, {
        idGame,
        autoDeath: game.autoDeath,
        playersIdToKill
    }, async (timer) => {
        if (timer.data.autoDeath) {
            if (timer.data.playersIdToKill[0]) {
                let idPlayer = timer.data.playersIdToKill.splice(0, 1)[0];
                await playerService.killPlayer(timer.data.idGame, idPlayer);
            }
            else {
                //no more players in array...
            }
        }
        socket.emitTo(timer.data.idGame + C.MASTER, C.DEATH_IS_COMING, {});
    }, (timer) => {
        log.info("EEEENNNND GAME", idGame);
    });
    timerDeath.start();

    await gameTimerManager.addTimer(timer);
    await gameTimerManager.addTimer(timerDeath);
    if (game.typeMoney === C.DEBT) {
        //Start credits
        bankService.startCreditsByIdGame(idGame);
    }
}

async function initGameDebt(game) {
    let decks = await decksService.generateDecks(game);

    for await (let player of game.players) {
        // pull cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], game.distribInitCards === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
        player.cards = cards;
        player.status = C.ALIVE;
        player.coins = 0;

        socket.emitTo(player.id, C.START_GAME, {
            cards:              cards,
            coins:              0,
            typeMoney:          C.DEBT,
            statusGame:         C.START_GAME,
            amountCardsForProd: game.amountCardsForProd,
            timerCredit:        game.timerCredit,
            timerPrison:        game.timerPrison
        });
        let newEvent = constructor.event(C.INIT_DISTRIB, C.MASTER, player.id, player.coins, cards, Date.now());
        socket.emitTo(game._id.toString() + C.EVENT, C.EVENT, newEvent);
        game.events.push(newEvent);
    }
    game.decks = decks;
    return game;
}

async function generateInequality(nbPlayer, pctRich, pctPoor) {
    //10% de riche = 2x le median
    //10% de pauvre = 1/2 le median
    //80% classe moyenne = la moyenne
    const classHaute = Math.floor(nbPlayer * (pctRich / 100));
    const classBasse = Math.floor(nbPlayer * (pctPoor / 100));
    const classMoyenne = nbPlayer - classHaute - classBasse;

    return [classBasse, classMoyenne, classHaute];
}

async function initGameJune(game) {
    let decks = await decksService.generateDecks(game);

    const classes = game.inequalityStart ? await generateInequality(game.players.length, game.pctRich, game.pctPoor) : [];

    for await (let player of game.players) {
        // pull 4 cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], game.amountCardsForProd === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
        player.cards = cards;
        player.status = C.ALIVE;

        if (game.inequalityStart) {
            if (classes[0] >= 1) {
                //classe basses
                player.coins = Math.floor(game.startAmountCoins / 2);
                classes[0]--;
            }
            else if (classes[2] >= 1) {
                // classe haute
                player.coins = Math.floor(game.startAmountCoins * 2);
                classes[2]--;
            }
            else {
                //classe moyenne
                player.coins = game.startAmountCoins;
            }
        }
        else {
            player.coins = game.startAmountCoins;
        }
        game.currentMassMonetary += player.coins;

        socket.emitAckTo(player.id, C.START_GAME, {
            cards:              cards,
            coins:              player.coins,
            typeMoney:          C.JUNE,
            statusGame:         C.START_GAME,
            amountCardsForProd: game.amountCardsForProd,
        });
        let newEvent = constructor.event(C.INIT_DISTRIB, C.MASTER, player.id, player.coins, cards, Date.now());
        socket.emitTo(game._id.toString() + C.EVENT, C.EVENT, newEvent);
        game.events.push(newEvent);
    }
    game.currentDU = await generateDU(game);
    socket.emitTo(game._id.toString(), C.FIRST_DU, {du: game.currentDU});

    let firstDUevent = constructor.event(C.FIRST_DU, C.MASTER, C.MASTER, game.currentDU, [], Date.now());
    game.events.push(firstDUevent);
    game.decks = decks;
    return game;
}

async function createGame(req) {
    let createEvent = constructor.event(C.CREATE_GAME, C.MASTER, C.MASTER, 0, [], Date.now());

    const newGame = new GameModel({
        name:                    req.body.name ? req.body.name : "sans nom",
        animator:                req.body.animator ? req.body.animator : "sans animateur",
        location:                req.body.location ? req.body.location : "sans lieu",
        shortId:                 nanoid(),
        status:                  C.OPEN,
        typeMoney:               req.body.typeMoney ? req.body.typeMoney : C.JUNE,
        events:                  [createEvent],
        decks:                   [],
        players:                 [],
        amountCardsForProd:      4,
        currentMassMonetary:     0,
        distribInitCards:        4,
        generateLettersAuto:     true,
        generateLettersInDeck:   0,
        generatedIdenticalCards: 4,
        surveyEnabled:           true,
        devMode:                 false,
        priceWeight1:            req.body.typeMoney === C.DEBT ? defaultPriceWeight1 : defaultPriceWeight1ML,
        priceWeight2:            req.body.typeMoney === C.DEBT ? defaultPriceWeight2 : defaultPriceWeight2ML,
        priceWeight3:            req.body.typeMoney === C.DEBT ? defaultPriceWeight3 : defaultPriceWeight3ML,
        priceWeight4:            req.body.typeMoney === C.DEBT ? defaultPriceWeight4 : defaultPriceWeight4ML,
        round:                   0,
        roundMax:                1,
        roundMinutes:            25,
        autoDeath:               true,
        deathPassTimer:          4,

        //option june
        currentDU:        0,
        tauxCroissance:   defaultTauxDU,
        inequalityStart:  false,
        startAmountCoins: 5,
        pctPoor:          10,
        pctRich:          10,

        //option debt
        credits:               [],
        defaultCreditAmount:   3,
        defaultInterestAmount: 1,
        bankInterestEarned:    0,
        bankGoodsEarned:       0,
        bankMoneyLost:         0,
        timerCredit:           5,
        timerPrison:           5,
        manualBank:            true,
        seizureType:           "decote",
        seizureCosts:          2,
        seizureDecote:         33,

        modified: Date.now(),
        created:  Date.now(),
    });

    const savedGame = await newGame.save();
    return savedGame;
}

async function updateGame(body) {
    let priceWeight1 = body.typeMoney === C.DEBT ? defaultPriceWeight1 : defaultPriceWeight1ML;
    let priceWeight2 = body.typeMoney === C.DEBT ? defaultPriceWeight2 : defaultPriceWeight2ML;
    let priceWeight3 = body.typeMoney === C.DEBT ? defaultPriceWeight3 : defaultPriceWeight3ML;
    let priceWeight4 = body.typeMoney === C.DEBT ? defaultPriceWeight4 : defaultPriceWeight4ML;

    const gameUpdated = GameModel.updateOne({
        _id: body.idGame,
    }, {
        $set: {
            typeMoney:               body.typeMoney ? body.typeMoney : C.JUNE,
            name:                    body.name ? body.name : "sans nom",
            animator:                body.animator ? body.animator : "sans animateur",
            location:                body.location ? body.location : "sans lieu",
            priceWeight1:            body.priceWeight1 ? body.priceWeight1 : priceWeight1,
            priceWeight2:            body.priceWeight2 ? body.priceWeight2 : priceWeight2,
            priceWeight3:            body.priceWeight3 ? body.priceWeight3 : priceWeight3,
            priceWeight4:            body.priceWeight4 ? body.priceWeight4 : priceWeight4,
            roundMax:                body.roundMax ? body.roundMax : 1,
            roundMinutes:            body.roundMinutes ? body.roundMinutes : 25,
            devMode:                 body.devMode === undefined ? true : body.devMode,
            surveyEnabled:           body.surveyEnabled === undefined ? true : body.surveyEnabled,
            amountCardsForProd:      body.amountCardsForProd ? body.amountCardsForProd : 4,
            distribInitCards:        body.distribInitCards ? body.distribInitCards : 4,
            generateLettersAuto:     body.generateLettersAuto === undefined ? true : body.generateLettersAuto,
            generateLettersInDeck:   body.generateLettersInDeck ? body.generateLettersInDeck : 0,
            generatedIdenticalCards: body.generatedIdenticalCards ? body.generatedIdenticalCards : 4,
            autoDeath:               body.autoDeath === undefined ? true : body.autoDeath,
            deathPassTimer:          body.deathPassTimer ? body.deathPassTimer : 4,

            //option june
            tauxCroissance:   body.tauxCroissance ? body.tauxCroissance : defaultTauxDU,
            startAmountCoins: body.startAmountCoins ? body.startAmountCoins : 5,
            inequalityStart:  body.inequalityStart === undefined ? false : body.inequalityStart,
            pctPoor:          body.pctPoor ? body.pctPoor : 10,
            pctRich:          body.pctRich ? body.pctRich : 10,

            //option debt
            defaultCreditAmount:   body.defaultCreditAmount ? body.defaultCreditAmount : 3,
            defaultInterestAmount: body.defaultInterestAmount ? body.defaultInterestAmount : 1,
            timerCredit:           body.timerCredit ? body.timerCredit : 5,
            timerPrison:           body.timerPrison ? body.timerPrison : 5,
            manualBank:            body.manualBank ? body.manualBank : false,
            seizureType:           body.seizureType ? body.seizureType : "decote",
            seizureCosts:          body.seizureCosts ? body.seizureCosts : 2,
            seizureDecote:         body.seizureDecote ? body.seizureDecote : 25,

            modified: Date.now(),
        },
    });

    if (gameUpdated) {
        const payload = {
            typeMoney:          body.typeMoney,
            timerCredit:        body.timerCredit,
            timerPrison:        body.timerPrison,
            amountCardsForProd: body.amountCardsForProd
        };

        socket.emitTo(body.idGame, C.UPDATE_GAME_OPTION, payload);
        return gameUpdated;
    }
    else {
        throw new Error("Game not found");
    }
}

async function getGameById(id) {
    let game = await GameModel.findById(id);
    if (!game) {
        throw new Error("Game not found");
    }
    return game;
}

async function getGameByShortId(shortId) {
    let game = await GameModel.findOne({shortId});
    if (!game) {
        throw new Error("Game not found");
    }
    return game;
}

async function startRound(idGame, round, next) {
    let startEvent = constructor.event(C.START_ROUND, C.MASTER, "", round, [], Date.now());
    await GameModel.findByIdAndUpdate(idGame, {
        $set:  {
            status:   C.PLAYING,
            modified: Date.now(),
        },
        $push: {events: startEvent}
    }, {new: true})
        .then(updatedGame => {
            let idPlayers = _.shuffle(updatedGame.players.map(p => p._id.toString()));
            startRoundTimers(updatedGame._id.toString(), updatedGame, idPlayers);
            socket.emitTo(idGame, C.START_ROUND);
            socket.emitTo(idGame + C.EVENT, C.EVENT, startEvent);
        })
        .catch(err => {
            log.error('Start round game error:' + err);
            next({
                status:  404,
                message: "Start round game error"
            });
        })
}

async function initGame(game) {
    if (game.typeMoney === C.JUNE) {
        return await initGameJune(game);
    }
    else if (game.typeMoney === C.DEBT) {
        return await initGameDebt(game);
    }
}

async function resetGame(idGame) {
    GameTimerManager.stopAndRemoveTimer(idGame);
    GameTimerManager.stopAndRemoveTimer(idGame + "death");
    BankTimerManager.stopAndRemoveAllIdGameDebtTimer(idGame);
    const game = await getGameById(idGame);
    const events = game.events.filter(e => e.typeEvent === C.NEW_PLAYER || e.typeEvent === C.CREATE_GAME);
    const players = game.players.filter(e => e.reincarnateFromId == null);
    players.forEach(p => {
        p.cards = [];
        p.survey = undefined;
        p.coins = 0;
        p.status = C.ALIVE;
    });
    // typeMoney:               C.JUNE,
    const updatedGame = await GameModel.findByIdAndUpdate(idGame, {
        $set: {
            status:                  C.OPEN,
            decks:                   [],
            players:                 players,
            credits:                 [],
            events:                  events,
            priceWeight1:            game.typeMoney === C.JUNE ? defaultPriceWeight1ML : defaultPriceWeight1,
            priceWeight2:            game.typeMoney === C.JUNE ? defaultPriceWeight2ML : defaultPriceWeight2,
            priceWeight3:            game.typeMoney === C.JUNE ? defaultPriceWeight3ML : defaultPriceWeight3,
            priceWeight4:            game.typeMoney === C.JUNE ? defaultPriceWeight4ML : defaultPriceWeight4,
            currentMassMonetary:     0,
            surveyEnabled:           true,
            devMode:                 true,
            generatedIdenticalCards: 4,
            distribInitCards:        4,
            generateLettersAuto:     true,
            generateLettersInDeck:   0,
            amountCardsForProd:      4,
            round:                   0,
            roundMax:                1,
            roundMinutes:            25,
            autoDeath:               true,
            deathPassTimer:          4,

            //option june
            currentDU:        0,
            tauxCroissance:   defaultTauxDU,
            inequalityStart:  false,
            startAmountCoins: 5,
            pctPoor:          10,
            pctRich:          10,

            //option debt
            defaultCreditAmount:   3,
            defaultInterestAmount: 1,
            bankInterestEarned:    0,
            bankGoodsEarned:       0,
            bankMoneyLost:         0,
            timerCredit:           5,
            timerPrison:           5,
            manualBank:            false,
            seizureType:           "decote",
            seizureCosts:          2,
            seizureDecote:         33,
        },
    }, {
        new: true,
    });
    if (updatedGame) {
        socket.emitTo(idGame, C.RESET_GAME);
        return true;
    }
    else {
        throw new Error("Reset Game error");
    }
}

export default {
    createGame:       createGame,
    updateGame:       updateGame,
    stopRound:        stopRound,
    getGameById:      getGameById,
    getGameByShortId: getGameByShortId,
    startRound:       startRound,
    initGame:         initGame,
    resetGame:        resetGame
}
