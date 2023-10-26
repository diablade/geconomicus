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

async function generateCardsPerPlayers(nbPlayers, prices) {
    if (nbPlayers > 20) {
        log.error("interdit");
        throw null;
    }
    let tableDecks = [[], [], [], []];
    const nbCarre = Math.floor((5 / 4) * nbPlayers);
    //pour chaque paquet de valeur de 1 à 4
    for (let weight = 0; weight <= 3; weight++) {
        let deck = [];
        //Pour N joueurs, prévoir au moins 5*N en cartes (= au moins 5/4*N carrés) par niveau.
        for (let letter = 0; letter <= nbCarre; letter++) {
            // faire le carré (4 cartes identiques)
            for (let j = 0; j <= 3; j++) {
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
    let decks = await generateCardsPerPlayers(nbPlayer, prices);

    for await (let player of game.players) {
        // pull 4 cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], [0, 1, 2, 3]);
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

async function generateInequality(nbPlayer) {
    //10% de riche = 2x le median
    //10% de pauvre = 1/2 le median
    //80% classe moyenne = la moyenne
    const classHaute = Math.floor(nbPlayer * 0.1);
    const classBasse = Math.floor(nbPlayer * 0.1);
    const classMoyenne = nbPlayer - classHaute - classBasse;

    return [classBasse, classMoyenne, classHaute];
}

async function initGameJune(game) {
    const nbPlayer = game.players.length;
    const prices = [game.priceWeight1, game.priceWeight2, game.priceWeight3, game.priceWeight4];
    let decks = await generateCardsPerPlayers(nbPlayer, prices);
    const classes = game.inequalityStart ? await generateInequality(nbPlayer) : [];

    for await (let player of game.players) {
        // pull 4 cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], [0, 1, 2, 3]);
        player.cards = cards;
        player.status = C.ALIVE;
        player.typeMoney = C.JUNE;
        player.statusGame = C.STARTED;

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

        io().to(player.id).emit(C.START_GAME, {cards: cards, coins: player.coins});
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
        distribDU(gameId);

        if (minutesLeft - 1 <= 0) {
            stopRound(gameId, gameRound);
        } else {
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
                priceWeight1: 1,
                priceWeight2: 3,
                priceWeight3: 6,
                priceWeight4: 9,
                startAmountCoins: 5,
                inequalityStart: false,
                tauxCroissance: 10,
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
                    status: "playing",
                    round: round,
                    modified: Date.now(),
                },
                $push: {events: startEvent}
            }, {new: true})
                .then(updatedGame => {
                    io().to(id).emit(C.START_ROUND);
                    io().to(id).emit(C.EVENT, startEvent);
                    startRound(updatedGame);
                    res.status(200).send({
                        status: "playing",
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
                    status: "intertourDone",
                    modified: Date.now(),
                },
            }, {new: true})
                .then(updatedGame => {
                    res.status(200).send({
                        status: "intertourDone",
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
    stopRound: async (req, res, next) => {
        const id = req.body.idGame;
        const round = req.body.round;
        if (!id) {
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
                    priceWeight1: body.priceWeight1 ? body.priceWeight1 : 1,
                    priceWeight2: body.priceWeight2 ? body.priceWeight2 : 3,
                    priceWeight3: body.priceWeight3 ? body.priceWeight3 : 6,
                    priceWeight4: body.priceWeight4 ? body.priceWeight4 : 9,
                    roundMax: body.roundMax ? body.roundMax : 1,
                    roundMinutes: body.roundMinutes ? body.roundMinutes : 40,
                    tauxCroissance: body.tauxCroissance ? body.tauxCroissance : 5,
                    startAmountCoins: body.startAmountCoins ? body.startAmountCoins : 5,
                    inequalityStart: body.inequalityStart ? body.inequalityStart : false,
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
                    let startGameEvent = constructor.event(C.START_GAME, C.MASTER, "", 0, [], Date.now());
                    gameUpdated.events.push(startGameEvent);
                    //and save the rest
                    GameModel.updateOne({_id: id}, {
                        $set: {
                            status: C.STARTED,
                            decks: gameUpdated.decks,
                            events: gameUpdated.events,
                            players: gameUpdated.players,
                            round: gameUpdated.round,
                            roundMax: gameUpdated.roundMax,
                            roundMinutes: gameUpdated.roundMinutes,
                            currentDU: gameUpdated.currentDU,
                            tauxCroissance: gameUpdated.tauxCroissance,
                            startAmountCoins: gameUpdated.startAmountCoins,
                            currentMassMonetary: gameUpdated.currentMassMonetary,
                            inequalityStart: gameUpdated.inequalityStart,
                            modified: Date.now(),
                        },
                    })
                        .then(updatedGame => {
                            res.status(200).send({
                                status: C.STARTED,
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
    stop: async (req, res, next) => {
        const id = req.body.idGame;
        if (!id) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            let stopGameEvent = constructor.event(C.STOP_GAME, C.MASTER, C.MASTER, 0, [], Date.now());
            GameModel.updateOne({_id: id}, {
                $set: {
                    status: C.STOP_GAME,
                    modified: Date.now(),
                },
                $push: {events: stopGameEvent}
            }).then(() => {
                io().to(id).emit(C.STOP_GAME);
                io().to(id).emit(C.EVENT, stopGameEvent);
                res.status(200).send({
                    status: C.STOP_GAME,
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
                    priceWeight1: 1,
                    priceWeight2: 3,
                    priceWeight3: 6,
                    priceWeight4: 9,
                    currentMassMonetary: 0,
                    currentDU: 0,
                    inequalityStart: false,
                    tauxCroissance: 10,
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
