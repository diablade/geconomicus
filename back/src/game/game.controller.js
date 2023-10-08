import GameModel, {constructor} from './game.model.js';
import {
    OPEN, STARTED, EVENT, MASTER,
    START_GAME, START_ROUND, STOP_ROUND,
    INTER_TOUR, DISTRIB_DU,RESET_GAME
} from '../../../config/constantes.js';

import log from '../../conf_log.js';
import _ from "lodash";
import mongoose from "mongoose";
import {io} from "../../conf_socket.js";

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
const colors = ["red", "yellow", "green", "blue"];
const startAmountCoins = 5;

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
    const nbPlayer = Number.parseInt(_.countBy(game.players, p => p.status === 'alive').true);
    const moyenne = game.currentMassMonetary / nbPlayer;
    return (moyenne * (game.tauxCroissance/100)).toFixed(2);
}

async function distribDU(gameId) {
    GameModel.findById(gameId)
        .then(async (game) => {
            const du = await generateDU(game);
            var newEvents = [];
            game.currentDU = du;
            for await (let player of game.players) {
                if (player.status === "alive") {
                    player.coins += du;
                    game.currentMassMonetary += du;
                    io().to(player.id).emit(DISTRIB_DU, {du: du});

                    let newEvent = constructor.event(DISTRIB_DU, MASTER, player.id, du, [], Date.now());
                    io().to(MASTER).emit(EVENT, {event: newEvent});
                    newEvents.push(newEvent);
                }
            }
            //TODO $inc for players not dead
            GameModel.findByIdAndUpdate(gameId,
                {
                    $inc: {"players.$[].coins": du},
                    $push: {events: {$each: newEvents}},
                    $set: {currentMassMonetary: game.currentMassMonetary, currentDU: game.currentDU}
                }, {new: true})
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
        player.status = "alive";
        player.coins = 0;

        io().to(player.id).emit(START_GAME, {cards: cards, coins: 0});
        let newEvent = constructor.event("distrib", MASTER, player.id, player.coins, cards, Date.now());
        io().to(MASTER).emit(EVENT, {event: newEvent});
        game.events.push(newEvent);
    }
    game.decks = decks;
    return game;
}

async function initGameJune(game) {
    const nbPlayer = game.players.length;
    const prices = [game.priceWeight1, game.priceWeight2, game.priceWeight3, game.priceWeight4];
    let decks = await generateCardsPerPlayers(nbPlayer, prices);

    for await (let player of game.players) {
        // pull 4 cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], [0, 1, 2, 3]);
        player.cards = cards;
        player.status = "alive";
        //TODO INEQUALITY START
        player.coins = startAmountCoins;
        game.currentMassMonetary += startAmountCoins;

        io().to(player.id).emit(START_GAME, {cards: cards, coins: 5});
        let newEvent = constructor.event("distrib", MASTER, player.id, player.coins, cards, Date.now());
        io().to(MASTER).emit(EVENT, {event: newEvent});
        game.events.push(newEvent);
    }
    game.currentDU = await generateDU(game);
    let firstDUevent = constructor.event("first_DU", MASTER, MASTER, game.currentDU, [], Date.now());
    game.events.push(firstDUevent);
    game.decks = decks;
    return game;
}

async function stopRound(gameId) {
    let stopRoundEvent = constructor.event(STOP_ROUND, MASTER, "", 0, [], Date.now());
    GameModel.updateOne({_id: gameId}, {
        $set: {
            status: INTER_TOUR,
            modified: Date.now(),
        },
        $push: {events: stopRoundEvent}
    })
        .then(previousGame => {
            io().to(gameId).emit(STOP_ROUND);
            io().to(MASTER).emit(EVENT, stopRoundEvent);
        })
        .catch(err => {
            log.error('stop round game error', err);
        })
}

function startRoundMoneyLibre(gameId, roundMinutes) {
    let minutesPassed = 0;
    const timer = setInterval(() => {
        minutesPassed++;
        distribDU(gameId);

        if (minutesPassed >= roundMinutes) {
            clearInterval(timer);
            console.log(roundMinutes + ' minutes have passed');
            stopRound(gameId);
        }
    }, 60 * 1000); // 60 seconds * 1000 milliseconds
}

function startRoundMoneyDebt(gameId, roundMinutes) {
    let minutesPassed = 0;
    const timer = setInterval(() => {
        minutesPassed++;
        //every 8mn do the pay interest ...

        if (minutesPassed >= roundMinutes) {
            clearInterval(timer);
            console.log(roundMinutes + ' minutes have passed');
            stopRound(gameId);
        }
    }, 60 * 1000); // 60 seconds * 1000 milliseconds
}

function startRound(updatedGame) {
    if (updatedGame.typeMoney === "june") {
        startRoundMoneyLibre(updatedGame._id, updatedGame.roundMinutes);
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
                status: OPEN,
                typeMoney: "june",
                players: [],
                decks: [],
                events: [],
                priceWeight1: body.priceWeight1 ? body.priceWeight1 : 1,
                priceWeight2: body.priceWeight2 ? body.priceWeight2 : 3,
                priceWeight3: body.priceWeight3 ? body.priceWeight3 : 6,
                priceWeight4: body.priceWeight4 ? body.priceWeight4 : 9,
                inequalityStart: false,
                tauxCroissance:10,
                round: 0,
                currentDU: 0,
                currentMassMonetary: 0,
                roundMax: body.roundMax ? body.roundMax : 10,
                roundMinutes: body.roundMax ? body.roundMax : 5,
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
            let startEvent = constructor.event(START_ROUND, MASTER, "", 0, [], Date.now());
            GameModel.findByIdAndUpdate(id, {
                $set: {
                    status: "playing",
                    round: round,
                    modified: Date.now(),
                },
                $push: {events: startEvent}
            }, {new: true})
                .then(updatedGame => {
                    io().to(id).emit(START_ROUND);
                    io().to(MASTER).emit(EVENT, startEvent);
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
            //calculate DU

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
        if (!id) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            let stopRoundEvent = constructor.event(STOP_ROUND, MASTER, "", 0, [], Date.now());
            GameModel.updateOne({_id: id}, {
                $set: {
                    status: INTER_TOUR,
                    modified: Date.now(),
                },
                $push: {events: stopRoundEvent}
            }, {new: true})
                .then(updatedGame => {
                    io().to(id).emit(STOP_ROUND);
                    io().to(MASTER).emit(EVENT, stopRoundEvent);
                    res.status(200).send({
                        status: INTER_TOUR,
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
                    game.priceWeight1 = body.priceWeight1 ? body.priceWeight1 : 1;
                    game.priceWeight2 = body.priceWeight2 ? body.priceWeight2 : 3;
                    game.priceWeight3 = body.priceWeight3 ? body.priceWeight3 : 6;
                    game.priceWeight4 = body.priceWeight4 ? body.priceWeight4 : 9;
                    game.round = 1;
                    game.roundMax = body.roundMax ? body.roundMax : 10;
                    game.roundMinutes = body.roundMinutes ? body.roundMinutes : 8;
                    game.inequalityStart = body.inequalityStart? body.inequalityStart : false;
                    let gameUpdated;
                    if (body.typeMoney === "june") {
                        gameUpdated = await initGameJune(game);
                    } else if (body.typeMoney === "debt") {
                        gameUpdated = await initGameDebt(game);
                    }
                    //and save the rest
                    GameModel.updateOne({_id: id}, {
                        $set: {
                            status: STARTED,
                            decks: gameUpdated.decks,
                            events: gameUpdated.events,
                            players: gameUpdated.players,
                            priceWeight1: gameUpdated.priceWeight1,
                            priceWeight2: gameUpdated.priceWeight2,
                            priceWeight3: gameUpdated.priceWeight3,
                            priceWeight4: gameUpdated.priceWeight4,
                            round: gameUpdated.round,
                            roundMax: gameUpdated.roundMax,
                            roundMinutes: gameUpdated.roundMinutes,
                            currentDU: gameUpdated.currentDU,
                            currentMassMonetary: gameUpdated.currentMassMonetary,
                            inequalityStart: gameUpdated.inequalityStart,
                            modified: Date.now(),
                        }
                    })
                        .then(updatedGame => {
                            res.status(200).send({
                                status: STARTED,
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
            try {
                let stopGameEvent = constructor.event(STOP_GAME, MASTER, MASTER, 0, [], Date.now());
                GameModel.updateOne({_id: id}, {
                    $set: {
                        status: "stopped",
                        modified: Date.now(),
                    },
                    $push: {events: stopGameEvent}
                }).then(() => {
                    io().to(id).emit(START_GAME);
                    io().to(MASTER).emit(EVENT, stopGameEvent);
                    res.status(200).send({
                        status: "stopped",
                    });
                })
            } catch (err) {
                log.error('get game error', err);
                next({
                    status: 404,
                    message: "not found"
                });
            }
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
                    status: "open",
                    typeMoney: "june",
                    'players.$[].cards': [],
                    'players.$[].coins': 0,
                    decks: [],
                    priceWeight1: 1,
                    priceWeight2: 3,
                    priceWeight3: 6,
                    priceWeight4: 9,
                    currentMassMonetary: 0,
                    currentDU: 0,
                    inequalityStart: false,
                    tauxCroissance:10,
                    round: 0,
                    roundMax: 1,
                    roundMinutes: 40,
                    events: [],
                }
            }, {new: true})
                .then((updatedGame) => {
                    io().to(idGame).emit(RESET_GAME);
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
