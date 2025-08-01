import GameModel, {constructor} from "./game.model.js";
import * as C from "../../../config/constantes.js";
import bcrypt from "bcrypt";
import log from "../../config/log.js";
import socket from "../../config/socket.js";
import gameService from "./game.service.js";
import playerService from "../player/player.service.js";

export default {
    create:                 async (req, res, next) => {
        try {
            const savedGame = await gameService.createGame(req);
            return res.status(200).send(savedGame);
        }
        catch (err) {
            log.error("Game creation error:", err);
            return res.status(500).json({
                message: "Game creation error",
            });
        }
    },
    update:                 async (req, res, next) => {
        try {
            const savedGame = await gameService.updateGame(req.body);
            return res.status(200).send({
                status: "updated",
            });
        }
        catch (err) {
            log.error("Game update error:", err);
            return res.status(500).json({
                message: "Game update error",
            });
        }

    },
    start:                  async (req, res, next) => {
        const body = req.body;
        GameModel.findById(body.idGame)
            .then(async (game) => {
                game.typeMoney = body.typeMoney ? body.typeMoney : C.JUNE;
                let gameUpdated;
                let startGameEvent = constructor.event(C.START_GAME, C.MASTER, "", 0, [], Date.now());
                game.events.push(startGameEvent);
                gameUpdated = await gameService.initGame(game);
                //and save the rest
                GameModel.updateOne({
                    _id: body.idGame,
                }, {
                    $set: {
                        status:              C.START_GAME,
                        decks:               gameUpdated.decks,
                        events:              gameUpdated.events,
                        players:             gameUpdated.players,
                        round:               gameUpdated.round + 1,
                        currentDU:           gameUpdated.currentDU,
                        currentMassMonetary: gameUpdated.currentMassMonetary,
                        modified:            Date.now(),
                    },
                })
                    .then((updatedGame) => {
                        return res.status(200).send({
                            status:      C.START_GAME,
                            timerCredit: gameUpdated.timerCredit,
                            typeMoney:   gameUpdated.typeMoney,
                        });
                    })
                    .catch((err) => {
                        log.error("Start game error:", err);
                        return res.status(500).json({
                            message: "Start game error",
                        });
                    });
            })
            .catch((err) => {
                log.error("Cannot start Game, not found:", err);
                return res.status(404).json({
                    message: "Cannot start Game, not found",
                });
            });
    },
    startRound:             async (req, res, next) => {
        const {
            idGame,
            round
        } = req.body;
        await gameService.startRound(idGame, round, next);
        return res.status(200).send({
            status: C.START_ROUND,
        });
    },
    interRound:             async (req, res, next) => {
        const id = req.body.idGame;
        GameModel.updateOne({
            _id: id,
        }, {
            $inc: {
                round: 1,
            },
            $set: {
                status:   C.INTER_ROUND,
                modified: Date.now(),
            },
        })
            .then((updatedGame) => {
                return res.status(200).send({
                    status: C.INTER_ROUND,
                });
            })
            .catch((err) => {
                log.error("get game error:", err);
                next({
                    status:  404,
                    message: "not found",
                });
            });
    },
    stopRound:              async (req, res, next) => {
        const {
            idGame,
            round
        } = req.body;
        await gameService.stopRound(idGame, round);
        return res.status(200).send({
            status: C.STOP_ROUND,
        });
    },
    end:                    async (req, res, next) => {
        const id = req.body.idGame;
        let stopGameEvent = constructor.event(C.END_GAME, C.MASTER, C.MASTER, 0, [], Date.now());
        GameModel.findByIdAndUpdate({
            _id: id,
        }, {
            $set:  {
                status:   C.END_GAME,
                modified: Date.now(),
            },
            $push: {
                events: stopGameEvent,
            },
        }, {
            new: true,
        })
            .then((game) => {
                socket.emitTo(id, C.END_GAME, game.surveyEnabled ? {
                    redirect: "survey",
                } : {});
                socket.emitTo(id + C.EVENT, C.EVENT, stopGameEvent);
                return res.status(200).send({
                    status: C.END_GAME,
                });
            })
            .catch((err) => {
                log.error("End game error:", err);
                return res.status(404).json({
                    message: "End Game error",
                });
            });
    },
    getFeedbacks:           async (req, res, next) => {
        const id = req.params.idGame;
        try {
            const game = await GameModel.findById(id);
            const playersWithFeedbacks = game.players.filter(p => p.survey !== undefined);
            const feedbacks = playersWithFeedbacks.map(p => p.survey);
            return res.status(200).json({
                feedbacks,
            });
        }
        catch (e) {
            log.error("Get feedbacks error:", e);
            return res.status(404).json({
                message: "Feedbacks not found",
            });
        }
    },
    getGameById:            async (req, res, next) => {
        const id = req.params.idGame;
        try {
            const game = await gameService.getGameById(id);
            return res.status(200).json(game);
        }
        catch (e) {
            log.error("Get game error:", e);
            return res.status(404).json({
                message: "Game not found",
            });
        }
    },
    getIdGameByShortId:     async (req, res, next) => {
        const shortId = req.params.shortId;
        try {
            const game = await gameService.getGameByShortId(shortId);
            if (game.status === C.END_GAME) {
                return res.status(404).json({
                    message: "Game not found",
                });
            }
            return res.status(200).json(game._id.toString());
        }
        catch (e) {
            log.error("Get game error:", e);
            return res.status(404).json({
                message: "Game not found",
            });
        }
    },
    getEvents:              async (req, res, next) => {
        const id = req.params.idGame;
        GameModel.findById(id)
            .then((game) => {
                if (game) {
                    return res.status(200).json(game.events);
                }
                else {
                    return res.status(404).json({
                        message: "Events of game not found",
                    });
                }
            })
            .catch((error) => {
                log.error("events,get game error:", error);
                return res.status(404).json({
                    message: "Events of game not found",
                });
            });
    },
    deletePlayer:           async (req, res, next) => {
        const {
            idGame,
            idPlayer
        } = req.body;
        GameModel.findByIdAndUpdate(idGame, {
            $pull: {
                players: {
                    _id: idPlayer,
                },
                events:  {
                    typeEvent: C.NEW_PLAYER,
                    emitter:   idPlayer
                }
            },
        }, {
            new: true,
        })
            .then((newGame) => {
                let players = newGame.players;
                let player = players.find(p => p._id === idPlayer);
                if (!player) {
                    return res.status(200).json(newGame);
                }
                else {
                    next({
                        status:  404,
                        message: "player Not deleted",
                    });
                }
            })
            .catch((error) => {
                log.error("delete player error:", error);
                return res.status(404).json({
                    message: "can't delete player not found",
                });
            });
    },
    killPlayer:             async (req, res, next) => {
        const {
            idGame,
            idPlayer
        } = req.body;
        try {
            await playerService.killPlayer(idGame, idPlayer);
            return res.status(200).json({
                status: "done",
            });
        }
        catch (e) {
            next({
                status:  400,
                message: e,
            });
        }
    },
    all:                    async (req, res, next) => {
        GameModel.aggregate([
            {
                $project: {
                    name:         1,
                    animator:     1,
                    location:     1,
                    status:       1,
                    typeMoney:    1,
                    modified:     1,
                    created:      1,
                    playersCount: {
                        $size: {
                            $filter: {
                                input: "$players",
                                as:    "player",
                                cond:  {
                                    $eq: [
                                        {
                                            $ifNull: ["$$player.reincarnateFromId", null],
                                        }, null,
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
                log.error("all games error:", err);
                return res.status(500).json({
                    message: "Get Games error",
                });
            });
    },
    delete:                 async (req, res, next) => {
        const {
            idGame,
            password
        } = req.body;
        try {
            if (process.env.GECO_NODE_ENV === "production" && bcrypt.compareSync(password, process.env.GECO_ADMIN_PASSWORD)) {
                await GameModel.findByIdAndDelete(idGame);
                return res.status(200).json({
                    status: "delete done",
                });
            }
            else if (process.env.GECO_NODE_ENV !== "production" && bcrypt.compareSync(password,
                "$2b$04$/uSG6WTkDm94r6fot9lHNes.8MdMkRKTosxjCevTRAHtQXSvWJed6")) {
                await GameModel.findByIdAndDelete(idGame);
                return res.status(200).json({
                    status: "delete done",
                });
            }
            else {
                next({
                    status:  500,
                    message: "error",
                });
            }
        }
        catch (e) {
            next({
                status:  400,
                message: e,
            });
        }
    },
    reset:                  async (req, res, next) => {
        try {
            const done = await gameService.resetGame(req.body.idGame);
            if (done) {
                return res.status(200).json({
                    status: "reset done",
                });
            }
            else {
                return res.status(500).json({
                    message: "Game reset error",
                });
            }
        }
        catch (err) {
            log.error("Game reset error:", err);
            return res.status(500).json({
                message: "Game reset error",
            });
        }
    },
    refreshForceAllPlayers: async (req, res, next) => {
        try {
            const done = await gameService.refreshForceAllPlayers(req.body.idGame);
            if (done) {
                return res.status(200).json({
                    status: "refresh done",
                });
            }
            else {
                return res.status(500).json({
                    message: "Game refresh error",
                });
            }
        }
        catch (err) {
            log.error("Game refresh error:", err);
            return res.status(500).json({
                message: "Game refresh error",
            });
        }
    },
    refreshPlayer: async (req, res, next) => {
        try {
            const done = await gameService.refreshPlayer(req.body.idGame, req.body.idPlayer);
            if (done) {
                return res.status(200).json({
                    status: "refresh done",
                });
            }
            else {
                return res.status(500).json({
                    message: "Game refresh error",
                });
            }
        }
        catch (err) {
            log.error("Game refresh error:", err);
            return res.status(500).json({
                message: "Game refresh error",
            });
        }
    },
};
