import GameModel, { constructor } from "./game.model.js";
import * as C from "../../../config/constantes.js";
import bcrypt from "bcrypt";
import log from "../../config/log.js";
import _ from "lodash";
import socket from "../../config/socket.js";
import BankController from "../bank/bank.controller.js";
import gameTimerManager from "./GameTimerManager.js";
import gameService from "./game.service.js";
import playerService from "../player/player.service.js";

const defaultPriceWeight1 = 1;
const defaultPriceWeight2 = 2;
const defaultPriceWeight3 = 4;
const defaultPriceWeight4 = 8;

export default {
    create: async (req, res, next) => {
        let createEvent = constructor.event(
            C.CREATE_GAME,
            C.MASTER,
            C.MASTER,
            0,
            [],
            Date.now()
        );

        const newGame = new GameModel({
            name: req.body.name ? req.body.name : "sans nom",
            animator: req.body.animator ? req.body.animator : "sans animateur",
            location: req.body.location ? req.body.location : "sans lieu",
            status: C.OPEN,
            typeMoney: "june",
            events: [createEvent],
            decks: [],
            players: [],
            amountCardsForProd: 4,
            currentMassMonetary: 0,
            distribInitCards: 4,
            generateLettersAuto: true,
            generateLettersInDeck: 0,
            generatedIdenticalCards: 4,
            surveyEnabled: true,
            devMode: false,
            priceWeight1: defaultPriceWeight1,
            priceWeight2: defaultPriceWeight2,
            priceWeight3: defaultPriceWeight3,
            priceWeight4: defaultPriceWeight4,
            round: 0,
            roundMax: 1,
            roundMinutes: 25,
            autoDeath: true,
            deathPassTimer: 4,

            //option june
            currentDU: 0,
            tauxCroissance: 5,
            inequalityStart: false,
            startAmountCoins: 5,
            pctPoor: 10,
            pctRich: 10,

            //option debt
            credits: [],
            defaultCreditAmount: 3,
            defaultInterestAmount: 1,
            bankInterestEarned: 0,
            bankGoodsEarned: 0,
            bankMoneyLost: 0,
            timerCredit: 5,
            timerPrison: 5,
            manualBank: true,
            seizureType: "decote",
            seizureCosts: 2,
            seizureDecote: 33,

            modified: Date.now(),
            created: Date.now(),
        });

        try {
            const savedGame = await newGame.save();
            return res.status(200).send(savedGame);
        } catch (err) {
            log.error("Game creation error", "err:", err);
            return res.status(500).json({
                message: "Game creation error",
            });
        }
    },
    update: async (req, res, next) => {
        const body = req.body;
        GameModel.updateOne(
            {
                _id: body.idGame,
            },
            {
                $set: {
                    typeMoney: body.typeMoney ? body.typeMoney : C.JUNE,
                    name: body.name ? body.name : "partie sans nom",
                    animator: body.animator ? body.animator : "sans animateur",
                    location: body.location ? body.location : "sans lieu",
                    priceWeight1: body.priceWeight1 ? body.priceWeight1 : defaultPriceWeight1,
                    priceWeight2: body.priceWeight2 ? body.priceWeight2 : defaultPriceWeight2,
                    priceWeight3: body.priceWeight3 ? body.priceWeight3 : defaultPriceWeight3,
                    priceWeight4: body.priceWeight4 ? body.priceWeight4 : defaultPriceWeight4,
                    roundMax: body.roundMax ? body.roundMax : 1,
                    roundMinutes: body.roundMinutes ? body.roundMinutes : 25,
                    devMode: body.devMode === undefined ? true : body.devMode,
                    surveyEnabled:
                        body.surveyEnabled === undefined ? true : body.surveyEnabled,
                    amountCardsForProd: body.amountCardsForProd
                        ? body.amountCardsForProd
                        : 4,
                    distribInitCards: body.distribInitCards ? body.distribInitCards : 4,
                    generateLettersAuto:
                        body.generateLettersAuto === undefined
                            ? true
                            : body.generateLettersAuto,
                    generateLettersInDeck: body.generateLettersInDeck
                        ? body.generateLettersInDeck
                        : 0,
                    generatedIdenticalCards: body.generatedIdenticalCards
                        ? body.generatedIdenticalCards
                        : 4,
                    autoDeath: body.autoDeath === undefined ? true : body.autoDeath,
                    deathPassTimer: body.deathPassTimer ? body.deathPassTimer : 4,

                    //option june
                    tauxCroissance: body.tauxCroissance ? body.tauxCroissance : 5,
                    startAmountCoins: body.startAmountCoins ? body.startAmountCoins : 5,
                    inequalityStart:
                        body.inequalityStart === undefined ? false : body.inequalityStart,
                    pctPoor: body.pctPoor ? body.pctPoor : 10,
                    pctRich: body.pctRich ? body.pctRich : 10,

                    //option debt
                    defaultCreditAmount: body.defaultCreditAmount
                        ? body.defaultCreditAmount
                        : 3,
                    defaultInterestAmount: body.defaultInterestAmount
                        ? body.defaultInterestAmount
                        : 1,
                    timerCredit: body.timerCredit ? body.timerCredit : 5,
                    timerPrison: body.timerPrison ? body.timerPrison : 5,
                    manualBank: body.manualBank ? body.manualBank : false,
                    seizureType: body.seizureType ? body.seizureType : "decote",
                    seizureCosts: body.seizureCosts ? body.seizureCosts : 2,
                    seizureDecote: body.seizureDecote ? body.seizureDecote : 25,

                    modified: Date.now(),
                },
            }
        )
            .then((updatedGame) => {
                return res.status(200).send({
                    status: "updated",
                });
            })
            .catch((err) => {
                log.error("update game error", err);
                return res.status(500).json({
                    message: "Update game error",
                });
            });
    },
    start: async (req, res, next) => {
        const body = req.body;
        GameModel.findById(body.idGame)
            .then(async (game) => {
                game.typeMoney = body.typeMoney ? body.typeMoney : C.JUNE;
                let gameUpdated;
                let startGameEvent = constructor.event(
                    C.START_GAME,
                    C.MASTER,
                    "",
                    0,
                    [],
                    Date.now()
                );
                game.events.push(startGameEvent);
                gameUpdated = await gameService.initGame(game);
                //and save the rest
                GameModel.updateOne(
                    {
                        _id: body.idGame,
                    },
                    {
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
                    }
                )
                    .then((updatedGame) => {
                        return res.status(200).send({
                            status: C.START_GAME,
                            timerCredit: gameUpdated.timerCredit,
                            typeMoney: gameUpdated.typeMoney,
                        });
                    })
                    .catch((err) => {
                        log.error("Start game error", err);
                        return res.status(500).json({
                            message: "Start game error",
                        });
                    });
            })
            .catch((err) => {
                log.error("Cannot start Game, not found", err);
                return res.status(404).json({
                    message: "Cannot start Game, not found",
                });
            });
    },
    startRound: async (req, res, next) => {
        const { idGame, round } = req.body;
        await gameService.startRound(idGame, round, next);
        return res.status(200).send({
            status: C.START_ROUND,
        });
    },
    interRound: async (req, res, next) => {
        const id = req.body.idGame;
        GameModel.updateOne(
            {
                _id: id,
            },
            {
                $inc: {
                    round: 1,
                },
                $set: {
                    status: C.INTER_ROUND,
                    modified: Date.now(),
                },
            }
        )
            .then((updatedGame) => {
                return res.status(200).send({
                    status: C.INTER_ROUND,
                });
            })
            .catch((err) => {
                log.error("get game error", err);
                next({
                    status: 404,
                    message: "not found",
                });
            });
    },
    stopRound: async (req, res, next) => {
        const { idGame, round } = req.body;
        await gameService.stopRound(idGame, round);
        return res.status(200).send({
            status: C.STOP_ROUND,
        });
    },
    end: async (req, res, next) => {
        const id = req.body.idGame;
        let stopGameEvent = constructor.event(
            C.END_GAME,
            C.MASTER,
            C.MASTER,
            0,
            [],
            Date.now()
        );
        GameModel.findByIdAndUpdate(
            {
                _id: id,
            },
            {
                $set: {
                    status: C.END_GAME,
                    modified: Date.now(),
                },
                $push: {
                    events: stopGameEvent,
                },
            },
            {
                new: true,
            }
        )
            .then((game) => {
                socket.emitTo(
                    id,
                    C.END_GAME,
                    game.surveyEnabled
                        ? {
                            redirect: "survey",
                        }
                        : {}
                );
                socket.emitTo(id + C.EVENT, C.EVENT, stopGameEvent);
                return res.status(200).send({
                    status: C.END_GAME,
                });
            })
            .catch((err) => {
                log.error("End game error", err);
                return res.status(404).json({
                    message: "End Game error",
                });
            });
    },
    getFeedbacks: async (req, res, next) => {
        const id = req.params.idGame;
        try {
            const game = await GameModel.findById(id);
            const playersWithFeedbacks = _.filter(
                game.players,
                (p) => p.survey !== undefined
            );
            const feedbacks = _.map(playersWithFeedbacks, (p) => p.survey);
            return res.status(200).json({
                feedbacks,
            });
        } catch (e) {
            log.error("Get feedbacks error", e);
            return res.status(404).json({
                message: "Feedbacks not found",
            });
        }
    },
    getGameById: async (req, res, next) => {
        const id = req.params.idGame;

        GameModel.findById(id)
            .then((game) => {
                if (game) {
                    return res.status(200).json(game);
                } else {
                    return res.status(404).json({
                        message: "Game not found",
                    });
                }
            })
            .catch((error) => {
                log.error("get game error", error);
                return res.status(404).json({
                    message: "Game not found",
                });
            });
    },
    getEvents: async (req, res, next) => {
        const id = req.params.idGame;
        GameModel.findById(id)
            .then((game) => {
                if (game) {
                    return res.status(200).json(game.events);
                } else {
                    return res.status(404).json({
                        message: "Events of game not found",
                    });
                }
            })
            .catch((error) => {
                log.error("events,get game error", error);
                return res.status(404).json({
                    message: "Events of game not found",
                });
            });
    },
    deletePlayer: async (req, res, next) => {
        const { idGame, idPlayer } = req.body;
        GameModel.findByIdAndUpdate(
            idGame,
            {
                $pull: {
                    players: {
                        _id: idPlayer,
                    },
                    events: {
                        typeEvent: C.NEW_PLAYER,
                        emitter: idPlayer
                    }
                },
            },
            {
                new: true,
            }
        )
            .then((newGame) => {
                let players = newGame.players;
                let player = _.find(players, function (p) {
                    return p._id === idPlayer;
                });
                if (!player) {
                    return res.status(200).json(newGame);
                } else {
                    next({
                        status: 404,
                        message: "player Not deleted",
                    });
                }
            })
            .catch((error) => {
                log.error("delete player error", error);
                return res.status(404).json({
                    message: "can't delete player not found",
                });
            });
    },
    killPlayer: async (req, res, next) => {
        const { idGame, idPlayer } = req.body;
        try {
            await playerService.killPlayer(idGame, idPlayer);
            return res.status(200).json({
                status: "done",
            });
        } catch (e) {
            next({
                status: 400,
                message: e,
            });
        }
    },
    all: async (req, res, next) => {
        GameModel.aggregate([
            {
                $project: {
                    name: 1,
                    animator: 1,
                    location: 1,
                    status: 1,
                    typeMoney: 1,
                    modified: 1,
                    created: 1,
                    playersCount: {
                        $size: {
                            $filter: {
                                input: "$players",
                                as: "player",
                                cond: {
                                    $eq: [
                                        {
                                            $ifNull: ["$$player.reincarnateFromId", null],
                                        },
                                        null,
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        ])
            .exec()
            .then((games) => {
                return res.status(200).json({
                    games: games,
                });
            })
            .catch((err) => {
                log.error("all games error", err);
                return res.status(500).json({
                    message: "Get Games error",
                });
            });
    },
    delete: async (req, res, next) => {
        const { idGame, password } = req.body;
        try {
            if (
                process.env.GECO_NODE_ENV === "production" &&
                bcrypt.compareSync(password, process.env.GECO_ADMIN_PASSWORD)
            ) {
                await GameModel.findByIdAndDelete(idGame);
                return res.status(200).json({
                    status: "delete done",
                });
            } else if (
                process.env.GECO_NODE_ENV !== "production" &&
                bcrypt.compareSync(
                    password,
                    "$2b$04$/uSG6WTkDm94r6fot9lHNes.8MdMkRKTosxjCevTRAHtQXSvWJed6"
                )
            ) {
                await GameModel.findByIdAndDelete(idGame);
                return res.status(200).json({
                    status: "delete done",
                });
            } else {
                next({
                    status: 500,
                    message: "error",
                });
            }
        } catch (e) {
            next({
                status: 400,
                message: e,
            });
        }
    },
    reset: async (req, res, next) => {
        const idGame = req.body.idGame;

        gameTimerManager.stopAndRemoveTimer(idGame);
        gameTimerManager.stopAndRemoveTimer(idGame + "death");
        BankController.resetIdGameDebtTimers(idGame);
        const game = await GameModel.findById(idGame);
        const events = _.filter(
            game.events,
            (e) => e.typeEvent === C.NEW_PLAYER || e.typeEvent === C.CREATE_GAME
        );
        const players = _.filter(
            game.players,
            (e) => e.reincarnateFromId == null
        );
        _.forEach(players, (p) => {
            p.cards = [];
            p.coins = 0;
            p.status = C.ALIVE;
        });
        GameModel.findByIdAndUpdate(
            idGame,
            {
                $set: {
                    status: C.OPEN,
                    typeMoney: C.JUNE,
                    decks: [],
                    players: players,
                    credits: [],
                    events: events,
                    priceWeight1: defaultPriceWeight1,
                    priceWeight2: defaultPriceWeight2,
                    priceWeight3: defaultPriceWeight3,
                    priceWeight4: defaultPriceWeight4,
                    currentMassMonetary: 0,
                    surveyEnabled: true,
                    devMode: true,
                    generatedIdenticalCards: 4,
                    distribInitCards: 4,
                    generateLettersAuto: true,
                    generateLettersInDeck: 0,
                    amountCardsForProd: 4,
                    round: 0,
                    roundMax: 1,
                    roundMinutes: 25,
                    autoDeath: true,
                    deathPassTimer: 4,

                    //option june
                    currentDU: 0,
                    tauxCroissance: 5,
                    inequalityStart: false,
                    startAmountCoins: 5,
                    pctPoor: 10,
                    pctRich: 10,

                    //option debt
                    defaultCreditAmount: 3,
                    defaultInterestAmount: 1,
                    bankInterestEarned: 0,
                    bankGoodsEarned: 0,
                    bankMoneyLost: 0,
                    timerCredit: 5,
                    timerPrison: 5,
                    manualBank: false,
                    seizureType: "decote",
                    seizureCosts: 2,
                    seizureDecote: 33,
                },
            },
            {
                new: true,
            }
        )
            .then((updatedGame) => {
                socket.emitTo(idGame, C.RESET_GAME);
                return res.status(200).json({
                    status: "reset done",
                });
            })
            .catch((error) => {
                log.error("reset game error", error);
                return res.status(500).json({
                    message: "Reset Game error",
                });
            });
    },
};
