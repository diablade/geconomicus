import GameModel, {constructor} from './game.model.js';
import {EVENT, MASTER, START_GAME, START_ROUND, STOP_ROUND, INTER_TOUR} from '../../../config/constantes.js';
// import pkg from '../../../config/constantes.js';
// const {EVENT, MASTER, START_GAME, STOP_ROUND} = pkg;

import log from '../../conf_log.js';
import _ from "lodash";
import mongoose from "mongoose";
import {io} from "../../conf_socket.js";

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
const colors = ["red", "yellow", "green", "blue"];

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

async function startGame(game) {
    const nbPlayer = game.players.length;
    const prices = [game.priceWeight1, game.priceWeight2, game.priceWeight3, game.priceWeight4];
    let decks = await generateCardsPerPlayers(nbPlayer, prices);

    //TODO coins
    for await (let player of game.players) {
        // const pull 4 cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], [0, 1, 2, 3]);
        player.cards = cards;
        player.status = "waiting";
        player.coins = 5;
        io().to(player.id).emit(START_GAME, {cards: cards, coins: 5});
        let newEvent = constructor.event("distrib", MASTER, player.id, player.coins, cards, Date.now());

        io().to(MASTER).emit(EVENT, {event: newEvent});
        game.events.push(newEvent);
    }
    game.decks = decks;
    return game;
}

export default {
    import: async (req, res, next) => {
        if (req) {
            res.status(200).json("I'm on it!");
            await importGame()
        } else {
            next({
                status: 400,
                message: "bad request"
            });
        }
    },
    export: async (req, res, next) => {
        log.error('body' + req.body);
    },
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
                status: "open",
                typeMoney: "june",
                players: [],
                decks: [],
                events: [],
                priceWeight1: body.priceWeight1 ? body.priceWeight1 : 1,
                priceWeight2: body.priceWeight2 ? body.priceWeight2 : 3,
                priceWeight3: body.priceWeight3 ? body.priceWeight3 : 6,
                priceWeight4: body.priceWeight4 ? body.priceWeight4 : 9,
                round: 0,
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
            GameModel.updateOne({_id: id}, {
                $set: {
                    status: "playing",
                    round: round,
                    modified: Date.now(),
                },
                $push: { events: startEvent }
            }, {new: true})
                .then(updatedGame => {
                    io().to(id).emit(START_ROUND);
                    io().to(MASTER).emit(EVENT, startEvent);
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
        if (!id) {
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
                    game.roundMinutes = body.roundMinutes ? body.roundMinutes : 5;
                    const gameUpdated = await startGame(game);
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

                            modified: Date.now(),
                        }
                    }, {new: true})
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
                let stopGameEvent = constructor.event(START_GAME, MASTER, MASTER, 0, [], Date.now());
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
                    'players.$[].cards': [],
                    decks: [],
                    events: [],
                    status: "open",
                    round: 0
                }
            }, {new: true})
                .then((updatedGame) => {
                    io().to(idGame).emit("reset-cards");
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
