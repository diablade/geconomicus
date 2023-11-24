import GameModel, {constructor} from './game.model.js';
import * as C from '../../../config/constantes.js';

import log from '../../conf_log.js';
import _ from "lodash";
import mongoose from "mongoose";
import {io} from "../../conf_socket.js";

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
const colors = ["red", "yellow", "green", "blue"];
let gameTimers = {};

function stopTimer(gameId) {
    if (gameTimers[gameId]) {
        clearTimeout(gameTimers[gameId]);
        gameTimers[gameId] = undefined;
    }
}

async function generateOneCard(letter, color, weight, price) {
    const comId = new mongoose.Types.ObjectId();
    let card = constructor.card(letter, color, weight, price);
    card._id = comId;
    return card;
}

async function generateDecks(generatedIdenticalCards, nbPlayers, prices) {
    let tableDecks = [[], [], [], []];
    const lettersInGame = nbPlayers;
    // genere cartes pour les 4 lots
    for (let weight = 0; weight <= 3; weight++) {
        let deck = [];
        for (let letter = 0; letter <= lettersInGame; letter++) {
            // genere 3, 4 ou 5 cartes identiques
            for (let j = 1; j <= generatedIdenticalCards; j++) {
                const card = await generateOneCard(letters[letter], colors[weight], weight, prices[weight]);
                deck.push(card);
            }
        }
        tableDecks[weight] = _.shuffle(deck);
    }
    return tableDecks;
}

async function generateDU(game) {
    const nbPlayer = Number.parseInt(_.countBy(game.players, p => p.status === C.ALIVE).true);
    const moyenne = game.currentMassMonetary / nbPlayer;
    const du = moyenne * game.tauxCroissance / 100;
    const duRounded = _.round(du, 2);
    return duRounded;
}

async function distribDU(gameId) {
    GameModel.findById(gameId)
        .then(async (game) => {
            var newEvents = [];
            const du = await generateDU(game);
            var newMassMoney = game.currentMassMonetary;
            for await (let player of game.players) {
                if (player.status === C.ALIVE) {
                    player.coins += du;
                    newMassMoney += du;
                    io().to(player.id).emit(C.DISTRIB_DU, {du: du});

                    let newEvent = constructor.event(C.DISTRIB_DU, C.MASTER, player.id, du, [], Date.now());
                    io().to(gameId).emit(C.EVENT, newEvent);
                    newEvents.push(newEvent);
                } else if (player.status === C.DEAD) {
                    //TO PRODUCE POINTS IN GRAPH (to see dead account devaluate)
                    let newEvent = constructor.event(C.REMIND_DEAD, C.MASTER, player.id, 0, [], Date.now());
                    io().to(gameId).emit(C.EVENT, newEvent);
                    newEvents.push(newEvent);
                }
            }
            GameModel.findByIdAndUpdate(gameId,
                {
                    $inc: {"players.$[elem].coins": du},
                    $push: {events: {$each: newEvents}},
                    $set: {currentMassMonetary: newMassMoney, currentDU: du}
                },
                {
                    arrayFilters: [{"elem.status": C.ALIVE}],
                    new: true
                })
                .then(updatedGame => {
                    log.info(updatedGame.currentDU);
                    log.info(updatedGame.currentMassMonetary);
                })
                .catch(err => {
                    log.error('update game error', err);
                })
        })
        .catch(err => {
            log.error('get game error', err);
        })
}

async function initGameDebt(game) {
    const nbPlayer = game.players.length;
    const prices = [game.priceWeight1, game.priceWeight2, game.priceWeight3, game.priceWeight4];
    let decks = await generateDecks(game.generatedIdenticalCards, nbPlayer, prices);

    for await (let player of game.players) {
        // pull 4 cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], game.amountCardsForProd === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
        player.cards = cards;
        player.status = C.ALIVE;
        player.coins = 0;

        io().to(player.id).emit(C.START_GAME, {cards: cards, coins: 0});
        let newEvent = constructor.event(C.DISTRIB, C.MASTER, player.id, player.coins, cards, Date.now());
        io().to(game._id.toString()).emit(C.EVENT, newEvent);
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
    const nbPlayer = game.players.length;
    const prices = [game.priceWeight1, game.priceWeight2, game.priceWeight3, game.priceWeight4];
    let decks = await generateDecks(game.generatedIdenticalCards, nbPlayer, prices);
    const classes = game.inequalityStart ? await generateInequality(nbPlayer, game.pctRich, game.pctPoor) : [];

    let startGameEvent = constructor.event(C.START_GAME, C.MASTER, "", 0, [], Date.now());
    game.events.push(startGameEvent);

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
            } else if (classes[2] >= 1) {
                // classe haute
                player.coins = Math.floor(game.startAmountCoins * 2);
                classes[2]--;
            } else {
                //classe moyenne
                player.coins = game.startAmountCoins;
            }
        } else {
            player.coins = game.startAmountCoins;
        }
        game.currentMassMonetary += player.coins;

        io().to(player.id).emit(C.START_GAME, {
            cards: cards,
            coins: player.coins,
            typeMoney: C.JUNE,
            statusGame: C.START_GAME,
            amountCardsForProd: game.amountCardsForProd,
        });
        let newEvent = constructor.event(C.DISTRIB, C.MASTER, player.id, player.coins, cards, Date.now());
        io().to(game._id.toString()).emit(C.EVENT, newEvent);
        game.events.push(newEvent);
    }
    game.currentDU = await generateDU(game);
    io().to(game._id.toString()).emit(C.FIRST_DU, {du: game.currentDU});

    let firstDUevent = constructor.event(C.FIRST_DU, C.MASTER, C.MASTER, game.currentDU, [], Date.now());
    game.events.push(firstDUevent);
    game.decks = decks;
    return game;
}

async function stopRound(gameId, gameRound) {
    stopTimer(gameId);
    let stopRoundEvent = constructor.event(C.STOP_ROUND, C.MASTER, "", gameRound, [], Date.now());
    GameModel.updateOne({_id: gameId}, {
        $set: {
            status: C.STOP_ROUND,
            modified: Date.now(),
        },
        $push: {events: stopRoundEvent}
    })
        .then(previousGame => {
            io().to(gameId).emit(C.STOP_ROUND);
            io().to(gameId).emit(C.EVENT, stopRoundEvent);
        })
        .catch(err => {
            log.error('stop round game error', err);
        })
}

async function killPlayer(idGame, idPlayer) {
    const game = await GameModel.findById(idGame);
    const player = _.find(game.players, {id: idPlayer});
    const groupedCards = _.groupBy(_.sortBy(player.cards, 'weight'), 'weight');

    // make him dead, Remove cards from player's hand, reset coins if debt
    await GameModel.updateOne(
        {_id: idGame, 'players._id': idPlayer},
        {
            $pull: {
                'players.$.cards': {
                    _id: {$in: player.cards.map(c => c.id)}
                }
            },
            $set: {
                'players.$.status': C.DEAD,
                'players.$.coins': game.typeMoney === C.JUNE ? player.coins : 0
            },
        },
    ).catch(err => {
        log.error('player escape dead, error', err);
    });

    let newEvent = constructor.event(C.DEAD, "master", idPlayer, 0, [], Date.now());
    //PUT BACK CARDS IN THE DECKs
    await GameModel.updateOne(
        {_id: idGame, 'players._id': idPlayer},
        {
            $push: {
                [`decks.${0}`]: {$each: groupedCards[0] ? groupedCards[0] : []},
                [`decks.${1}`]: {$each: groupedCards[1] ? groupedCards[1] : []},
                [`decks.${2}`]: {$each: groupedCards[2] ? groupedCards[2] : []},
                [`decks.${3}`]: {$each: groupedCards[3] ? groupedCards[3] : []},
                'events': newEvent
            },
        }
    ).catch(err => {
        log.error('player dead cards are not back in decks, error', err);
    });
    io().to(idGame).emit(C.EVENT, newEvent);
    io().to(idPlayer).emit(C.DEAD);
}

async function deadPassing(roundMinutes, minutesPassed) {
    const modulo3 = roundMinutes / 3;
    if (minutesPassed > modulo3) {
        // killPlayer(idGame,idPlayer)
    }
}

function startRoundMoneyLibre(gameId, gameRound, roundMinutes, minutesLeft) {
    const timer = setTimeout(async () => {
        io().to(gameId).emit(C.TIMER_LEFT, minutesLeft - 1);

        // TODO: the automatic dead is coming ;
        if ((minutesLeft - 1) <= 0) {
            await distribDU(gameId);
            stopRound(gameId, gameRound);
        } else {
            distribDU(gameId);
            // Continue the timer
            startRoundMoneyLibre(gameId, gameRound, roundMinutes, minutesLeft - 1);
        }
    }, 60 * 1000); // 60 seconds * 1000 milliseconds
    // Store the timer in the gameTimers object using the gameId as the key.
    gameTimers[gameId] = timer;
}


function startRoundMoneyDebt(gameId, roundMinutes) {
    let minutesPassed = 0;
    const timer = setInterval(() => {
        minutesPassed++;
        //every 8mn do the pay interest ...

        if (minutesPassed >= roundMinutes) {
            clearInterval(timer);
            console.log(roundMinutes + ' minutes have passed');
            stopRound(gameId, round);
        }
    }, 60 * 1000); // 60 seconds * 1000 milliseconds
}

function startRound(updatedGame) {
    if (updatedGame.typeMoney === C.JUNE) {
        startRoundMoneyLibre(updatedGame._id.toString(), updatedGame.round, updatedGame.roundMinutes, updatedGame.roundMinutes);
    } else {
        startRoundMoneyDebt(updatedGame);
    }
}

export default {
    create: async (req, res, next) => {
        if (!req.body.gameName) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            let body = req.body;
            const newGame = new GameModel({
                name: req.body.gameName,
                status: C.OPEN,
                typeMoney: "june",
                players: [],
                decks: [],
                events: [],
                priceWeight1: 3,
                priceWeight2: 6,
                priceWeight3: 9,
                priceWeight4: 12,
                startAmountCoins: 5,
                inequalityStart: false,
                surveyEnabled: true,
                tauxCroissance: 10,
                generatedIdenticalCards: 4,
                amountCardsForProd: 4,
                pctRich: 10,
                pctPoor: 10,
                round: 0,
                currentDU: 0,
                currentMassMonetary: 0,
                roundMax: 1,
                roundMinutes: 40,
                modified: Date.now(),
                created: Date.now(),
            });

            try {
                const savedGame = await newGame.save();
                res.status(200).send(savedGame);
            } catch (err) {
                log.error('status: 500', 'message:', err);
                next({
                    status: 500,
                    message: "game creation error"
                });
            }
        }
    },
    update: async (req, res, next) => {
        const id = req.body.idGame;
        const body = req.body;
        if (!id && !body.typeMoney) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.updateOne({_id: id}, {
                $set: {
                    typeMoney: body.typeMoney ? body.typeMoney : C.JUNE,
                    name: body.name ? body.name : "sans nom",
                    priceWeight1: body.priceWeight1 ? body.priceWeight1 : 3,
                    priceWeight2: body.priceWeight2 ? body.priceWeight2 : 6,
                    priceWeight3: body.priceWeight3 ? body.priceWeight3 : 9,
                    priceWeight4: body.priceWeight4 ? body.priceWeight4 : 12,
                    roundMax: body.roundMax ? body.roundMax : 1,
                    roundMinutes: body.roundMinutes ? body.roundMinutes : 40,
                    tauxCroissance: body.tauxCroissance ? body.tauxCroissance : 5,
                    amountCardsForProd: body.amountCardsForProd ? body.amountCardsForProd : 4,
                    generatedIdenticalCards: body.generatedIdenticalCards ? body.generatedIdenticalCards : 4,
                    pctRich: body.pctRich ? body.pctRich : 10,
                    pctPoor: body.pctPoor ? body.pctPoor : 10,
                    startAmountCoins: body.startAmountCoins ? body.startAmountCoins : 5,
                    inequalityStart: body.inequalityStart ? body.inequalityStart : false,
                    surveyEnabled: body.surveyEnabled ? body.surveyEnabled : true,
                    modified: Date.now(),
                }
            })
                .then(updatedGame => {
                    res.status(200).send({
                        status: "updated",
                    });
                })
                .catch(err => {
                    log.error('get game error', err);
                    next({
                        status: 404,
                        message: "not found"
                    });
                })
        }
    },
    start: async (req, res, next) => {
        const id = req.body.idGame;
        const body = req.body;
        if (!id && !body.typeMoney) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findById(id)
                .then(async (game) => {
                    game.typeMoney = body.typeMoney ? body.typeMoney : C.JUNE;
                    let gameUpdated;
                    if (game.typeMoney === "june") {
                        gameUpdated = await initGameJune(game);
                    } else if (game.typeMoney === "debt") {
                        gameUpdated = await initGameDebt(game);
                    }
                    //and save the rest
                    GameModel.updateOne({_id: id}, {
                        $set: {
                            status: C.START_GAME,
                            decks: gameUpdated.decks,
                            events: gameUpdated.events,
                            players: gameUpdated.players,
                            round: gameUpdated.round + 1,
                            currentDU: gameUpdated.currentDU,
                            currentMassMonetary: gameUpdated.currentMassMonetary,
                            modified: Date.now(),
                        },
                    })
                        .then(updatedGame => {
                            res.status(200).send({
                                status: C.START_GAME,
                            });
                        })
                        .catch(err => {
                            log.error('get game error', err);
                            next({
                                status: 404,
                                message: "not found"
                            });
                        })
                })
                .catch(err => {
                    log.error('get game error', err);
                    next({
                        status: 404,
                        message: "game not found"
                    });
                })
        }
    },
    startRound: async (req, res, next) => {
        const id = req.body.idGame;
        const round = req.body.round;
        if (!id) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            let startEvent = constructor.event(C.START_ROUND, C.MASTER, "", round, [], Date.now());
            GameModel.findByIdAndUpdate(id, {
                $set: {
                    status: C.START_ROUND,
                    modified: Date.now(),
                },
                $push: {events: startEvent}
            }, {new: true})
                .then(updatedGame => {
                    io().to(id).emit(C.START_ROUND);
                    io().to(id).emit(C.EVENT, startEvent);
                    startRound(updatedGame);
                    res.status(200).send({
                        status: C.START_ROUND,
                    });
                })
                .catch(err => {
                    log.error('get game error', err);
                    next({
                        status: 404,
                        message: "not found"
                    });
                })
        }
    },
    interRound: async (req, res, next) => {
        const id = req.body.idGame;
        if (!id) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.updateOne({_id: id}, {
                $inc: {round: 1},
                $set: {
                    status: C.INTER_ROUND,
                    modified: Date.now(),
                },
            }).then(updatedGame => {
                res.status(200).send({
                    status: C.INTER_ROUND,
                });
            }).catch(err => {
                log.error('get game error', err);
                next({
                    status: 404,
                    message: "not found"
                });
            })
        }
    },
    stopRound: async (req, res, next) => {
        const id = req.body.idGame;
        const round = req.body.round;
        if (!id && !round) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            await stopRound(id, round);
            res.status(200).send({
                status: C.STOP_ROUND,
            });
        }
    },
    end: async (req, res, next) => {
        const id = req.body.idGame;
        if (!id) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            let stopGameEvent = constructor.event(C.END_GAME, C.MASTER, C.MASTER, 0, [], Date.now());
            GameModel.findByIdAndUpdate({_id: id}, {
                    $set: {
                        status: C.END_GAME,
                        modified: Date.now(),
                    },
                    $push: {events: stopGameEvent}
                },
                {new: true}
            ).then(game => {
                io().to(id).emit(C.END_GAME, game.surveyEnabled ? {'redirect': 'survey'} : {});
                io().to(id).emit(C.EVENT, stopGameEvent);
                res.status(200).send({
                    status: C.END_GAME,
                });
            }).catch(err => {
                log.error('get game error', err);
                next({
                    status: 404,
                    message: "not found"
                });

            });
        }
    },
    getGameById: async (req, res, next) => {
        const id = req.params.idGame;
        if (!id) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findById(id)
                .then(game => {
                    if (game) {
                        res.status(200).json(game);
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
    getEvents: async (req, res, next) => {
        const id = req.params.idGame;
        if (!id) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findById(id)
                .then(game => {
                    if (game) {
                        res.status(200).json(game.events);
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
    deletePlayer: async (req, res, next) => {
        const idGame = req.body.idGame;
        const idPlayer = req.body.idPlayer;
        if (!idPlayer || !idGame) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findByIdAndUpdate(idGame, {
                $pull: {players: {_id: idPlayer}}
            }, {new: true})
                .then(newGame => {
                    let players = newGame.players;
                    let player = _.find(players, function (p) {
                        return p._id === idPlayer
                    })
                    if (!player) {
                        res.status(200).json(newGame);
                    } else {
                        next({status: 404, message: "player Not deleted"});
                    }
                })
                .catch(error => {
                        log(error);
                        next({status: 404, message: "game Not found"});
                    }
                );
        }
    },
    killPlayer: async (req, res, next) => {
        const idGame = req.body.idGame;
        const idPlayer = req.body.idPlayer;
        if (!idPlayer || !idGame) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            await killPlayer(idGame, idPlayer);
            res.status(200).json({status: "done"});
        }
    },
    all: async (req, res, next) => {
        GameModel.aggregate([
            {
                $project: {
                    name: 1,
                    status: 1,
                    typeMoney: 1,
                    modified: 1,
                    created: 1,
                    playersCount: {$size: '$players'},
                },
            },
        ])
            .exec()
            .then(games => {
                res.status(200).json({"games": games});
            })
            .catch(err => {
                log.error(err);
                next({
                    status: 500,
                    message: "error server " + err
                });
            });
    },
    reset: async (req, res, next) => {
        const idGame = req.body.idGame;
        if (!idGame) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findByIdAndUpdate(idGame, {
                $set: {
                    status: C.OPEN,
                    typeMoney: C.JUNE,
                    'players.$[].cards': [],
                    'players.$[].coins': 0,
                    'players.$[].status': C.ALIVE,
                    decks: [],
                    priceWeight1: 3,
                    priceWeight2: 6,
                    priceWeight3: 9,
                    priceWeight4: 12,
                    currentMassMonetary: 0,
                    currentDU: 0,
                    inequalityStart: false,
                    surveyEnabled: true,
                    tauxCroissance: 10,
                    generatedIdenticalCards: 4,
                    amountCardsForProd: 4,
                    pctRich: 10,
                    pctMoy: 80,
                    pctPoor: 10,
                    startAmountCoins: 5,
                    round: 0,
                    roundMax: 1,
                    roundMinutes: 40,
                    events: [],
                }
            }, {new: true})
                .then((updatedGame) => {
                    io().to(idGame).emit(C.RESET_GAME);
                    res.status(200).json({"status": "reset done"});
                })
                .catch((error) => {
                    console.log(error);
                    next({
                        status: 404,
                        message: "Not found"
                    });
                });
        }
    }
};
