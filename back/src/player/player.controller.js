import GameModel, {constructor} from '../game/game.model.js';
import log from '../../conf_log.js';
import _ from 'lodash';
import mongoose from "mongoose";
import {io} from '../../conf_socket.js';
import * as C from '../../../config/constantes.js';

export default {
    join: async (req, res, next) => {
        const id = req.body.idGame;
        const name = req.body.name;
        if (!id && !name) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findById(id).then(async game => {
                    if (game.status == C.DEAD) {
                        next({status: 400, message: "la partie est terminé mon poto, faut rentrer maintenant..."})
                    } else if (game.status != C.OPEN) {
                        next({status: 400, message: "la partie est déjà commencé... sorry mon poto"})
                    } else if (game.players.length < 25) {
                        const comId = new mongoose.Types.ObjectId();
                        let player = {
                            _id: comId,
                            name: name,
                            image: "",
                            coins: 0,
                            credits: [],
                            cards: [],
                            status: C.ALIVE,
                            earringsProbability: 100,
                            glassesProbability: 100,
                            featuresProbability: 100
                        };
                        GameModel.findOneAndUpdate({_id: id}, {$push: {players: player}},)
                            .then(updatedGame =>
                                res.status(200).json(player._id))
                            .catch(error => {
                                    log.error(error);
                                    next({status: 404, message: "Not found"});
                                }
                            );
                    } else {
                        next({status: 400, message: "25 joueurs max sorry..."});
                    }
                }
            ).catch(error => {
                    log.error(error);
                    next({status: 404, message: "Not found"});
                }
            );
        }
    },
    joinInGame: async (req, res, next) => {
    },
    joinReincarnate: async (req, res, next) => {
        const id = req.body.idGame;
        const name = req.body.name;
        if (!id && !name) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            const idPlayer = new mongoose.Types.ObjectId();
            let player = {
                _id: idPlayer,
                name: name,
                image: "",
                coins: 0,
                credits: [],
                cards: [],
                status: C.ALIVE,
                earringsProbability: 100,
                glassesProbability: 100,
                featuresProbability: 100
            };
            GameModel.findOneAndUpdate({_id: id}, {$push: {players: player}}, {new: true})
                .then(async updatedGame => {
                    const shuffledDeck = _.shuffle(updatedGame.decks[0]);
                    // Draw new cards for the player
                    const newCards = shuffledDeck.slice(0, 4);//same weight
                    //create events
                    let birthEvent = constructor.event(C.BIRTH, C.MASTER, idPlayer, 0, newCards, Date.now());

                    // remove cards given to player from the deck, add events
                    await GameModel.updateOne(
                        {_id: id},
                        {
                            $pull: {
                                [`decks.${0}`]: {_id: {$in: newCards.map(c => c._id)}},
                            },
                            $push: {
                                'events': {$each: [birthEvent]}
                            }
                        }
                    );
                    // and Add new cards to player's hand
                    await GameModel.updateOne(
                        {_id: id, 'players._id': idPlayer},
                        {
                            $push: {'players.$.cards': {$each: newCards}}
                        }
                    );
                    io().to(id+"event").emit(C.EVENT, birthEvent);
                    res.status(200).json(player._id);
                })
                .catch(error => {
                        log.error(error);
                        next({status: 404, message: "Not found"});
                    }
                );
        }
    },
    update: async (req, res, next) => {
        const idGame = req.body.idGame;
        const player = req.body;
        const idPlayer = player._id
        if (!idGame && !idPlayer) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findByIdAndUpdate(idGame, {
                $set: {
                    'players.$[elem].name': player.name,
                    'players.$[elem].image': player.image,
                    'players.$[elem].eye': player.eye,
                    'players.$[elem].eyebrows': player.eyebrows,
                    'players.$[elem].earrings': player.earrings,
                    'players.$[elem].features': player.features,
                    'players.$[elem].hair': player.hair,
                    'players.$[elem].glasses': player.glasses,
                    'players.$[elem].mouth': player.mouth,
                    'players.$[elem].skinColor': player.skinColor,
                    'players.$[elem].hairColor': player.hairColor,
                    'players.$[elem].boardConf': player.boardConf,
                    'players.$[elem].boardColor': player.boardColor,
                    // add any other fields you want to update here
                }
            }, {
                arrayFilters: [{'elem._id': idPlayer}],
                new: true
            })
                .then((updatedGame) => {
                    io().to(idGame).emit("updated-game", updatedGame);
                    res.status(200).json({"status": "updated"});
                })
                .catch((error) => {
                    log.error(error);
                    next({
                        status: 404,
                        message: "Not found"
                    });
                });
        }
    },
    getById: async (req, res, next) => {
        const idGame = req.params.idGame;
        const idPlayer = req.params.idPlayer;
        if (!idPlayer || !idGame) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            GameModel.findById(idGame)
                .then(game => {
                    let players = game.players;
                    let player = _.find(players, function (p) {
                        return p._id == idPlayer
                    })
                    if (player) {
                        res.status(200).json({
                            player: player,
                            statusGame: game.status,
                            typeMoney: game.typeMoney,
                            currentDU: game.currentDU,
                            amountCardsForProd: game.amountCardsForProd
                        });
                    } else {
                        next({status: 404, message: "player Not found"});
                    }
                })
                .catch(error => {
                        log.error(error);
                        next({status: 404, message: "game Not found"});
                    }
                );
        }
    },
    produceLevelUp: async (req, res, next) => {
        const idGame = req.body.idGame;
        const idPlayer = req.body.idPlayer;
        const cards = req.body.cards;
        if (!idGame || !idPlayer || !cards || cards.length < 3 || cards[0].weight !== cards[1].weight || cards[0].letter !== cards[1].letter) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            try {
                const game = await GameModel.findById(idGame);
                const player = _.find(game.players, {id: idPlayer});
                const cardsToExchange = _.filter(player.cards, {letter: cards[0].letter, weight: cards[0].weight});
                if (cardsToExchange.length === game.amountCardsForProd) {
                    let weight = cardsToExchange[0].weight;

                    // Remove cards from player's hand
                    await GameModel.updateOne(
                        {_id: idGame, 'players._id': idPlayer},
                        {$pull: {'players.$.cards': {_id: {$in: cardsToExchange.map(c => c.id)}}}},
                    );
                    // Add cards back to the deck
                    GameModel.findByIdAndUpdate(
                        {_id: idGame},
                        {$push: {[`decks.${weight}`]: {$each: cardsToExchange}}},
                        {new: true})
                        .then(async updatedGame => {
                                // Draw a card from the next level
                                if (weight < 2) {
                                    // Shuffle the decks
                                    const shuffledDeck = _.shuffle(updatedGame.decks[weight]);
                                    const shuffledDeck2 = _.shuffle(updatedGame.decks[weight + 1]);
                                    // Draw new cards for the player
                                    const newCards = shuffledDeck.slice(0, game.amountCardsForProd);//same weight
                                    const newCardSup = shuffledDeck2.slice(0, 1)[0]; // one superior produced
                                    const cardsDraw = _.concat(newCards, [newCardSup]);
                                    //create events
                                    let discardEvent = constructor.event(C.TRANSFORM_DISCARDS, idPlayer, C.MASTER, 0, cardsToExchange, Date.now());
                                    let newCardsEvent = constructor.event(C.TRANSFORM_NEWCARDS, C.MASTER, idPlayer, 0, cardsDraw, Date.now());

                                    // remove from decks, add events
                                    await GameModel.updateOne(
                                        {_id: idGame},
                                        {
                                            $pull: {
                                                [`decks.${weight}`]: {_id: {$in: newCards.map(c => c._id)}},
                                                [`decks.${weight + 1}`]: {_id: newCardSup._id}
                                            },
                                            $push: {
                                                'events': {$each: [discardEvent, newCardsEvent]}
                                            }
                                        }
                                    );
                                    // and Add new cards to player's hand
                                    await GameModel.updateOne(
                                        {_id: idGame, 'players._id': idPlayer},
                                        {
                                            $push: {
                                                'players.$.cards': {$each: cardsDraw},
                                            }
                                        }
                                    );
                                    io().to(idGame+"event").emit(C.EVENT, discardEvent);
                                    io().to(idGame+"event").emit(C.EVENT, newCardsEvent);
                                    res.status(200).json(cardsDraw);
                                } else {
                                    //TODO changement technologique
                                    next({
                                        status: 404,
                                        message: "bravo !!! vous etes sur le point de faire un changement technologique"
                                    });
                                }
                            }
                        )
                        .catch(error => {
                                log.error(error);
                                next({status: 404, message: "update game goes wrong (transform square)"});
                            }
                        );
                } else {
                    next({status: 400, message: "not enough cards to produce level up"});
                }
            } catch (err) {
                log.error('update game error', err);
            }
        }
    },
    transaction: async (req, res, next) => {
        const idGame = req.body.idGame;
        const idBuyer = req.body.idBuyer;
        const idSeller = req.body.idSeller;
        const idCard = req.body.idCard;
        if (idGame && idBuyer && idSeller && idCard) {
            GameModel.findById(idGame).then(async game => {
                const buyer = _.find(game.players, {id: idBuyer});
                const seller = _.find(game.players, {id: idSeller});
                const card = _.find(seller.cards, {id: idCard});
                // Check if card seller buyer exist
                if (!card || !seller || !buyer) {
                    log.error("card or buyer or seller doesn't exist");
                    next({
                        status: 400,
                        message: "card or buyer or seller doesn't exist"
                    });
                    throw new Error('card or buyer or seller doesn\'t exist');
                }
                // Check if buyer is dead
                if (buyer.status === C.DEAD) {
                    log.error("buyer should be dead");
                    next({
                        status: 400,
                        message: "you should be dead"
                    });
                    throw new Error('you should be dead fool !');
                }
                // Check if seller is dead
                if (seller.status === C.DEAD) {
                    log.error("seller should be dead");
                    next({
                        status: 400,
                        message: "seller is dead"
                    });
                    throw new Error('seller is dead');
                }
                // Check if buyer has enough coins
                const cost = game.typeMoney === C.JUNE ? _.round(_.multiply(card.price, game.currentDU), 2) : card.price;
                if (buyer.coins < cost) {
                    log.error("buyer has not enough coins");
                    next({
                        status: 400,
                        message: "fond insuffisant"
                    });
                    throw new Error('Not enough coins');
                }
                let newEvent = constructor.event(C.TRANSACTION, idBuyer, idSeller, cost, [card], Date.now());
                // remove card and add coins to seller
                await GameModel.updateOne(
                    {_id: idGame, 'players._id': idSeller},
                    {
                        $pull: {'players.$.cards': {_id: idCard}},
                        $inc: {'players.$.coins': cost}
                    }
                );
                // add card to buyer and remove coins
                await GameModel.updateOne(
                    {_id: idGame, 'players._id': idBuyer},
                    {
                        $push: {'players.$.cards': card},
                        $inc: {'players.$.coins': -cost}
                    }
                );
                // add event
                await GameModel.updateOne(
                    {_id: idGame},
                    {
                        $push: {'events': newEvent},
                    }
                );
                io().to(idGame+"event").emit(C.EVENT, newEvent);
                // Send socket to seller with updated coins
                buyer.coins -= cost;
                seller.coins += cost;
                io().to(idSeller).emit(C.TRANSACTION_DONE, {idCardSold: idCard, coins: seller.coins});
                // Send back to buyer , card with updated coins
                res.status(200).json({buyedCard: card, coins: buyer.coins});
            })
                .catch((error) => {
                    log.error('transaction error', error);
                    throw error;
                });
        } else {
            next({
                status: 400,
                message: "bad request"
            });
        }
    },
    addFeedback: async (req, res, next) => {
        const idGame = req.body.idGame;
        const idPlayer = req.body.idPlayer;
        const body = req.body;
        if (!idGame && !idPlayer) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            const feedback = constructor.feedback(
                body.depressedHappy,
                body.individualCollective,
                body.aloneIntegrated,
                body.greedyGenerous,
                body.competitiveCooperative,
                body.anxiousConfident,
                body.agressiveAvenant,
                body.irritableTolerant,
                body.dependantAutonomous,
            )
            GameModel.findByIdAndUpdate(idGame, {
                $set: {
                    'players.$[elem].survey': feedback,
                }
            }, {
                arrayFilters: [{'elem._id': idPlayer}],
                new: true
            }).then((updatedGame) => {
                io().to(idGame).emit(C.NEW_FEEDBACK);
                res.status(200).json({"status": "feedback saved"});
            }).catch((error) => {
                log.error(error);
                next({
                    status: 404,
                    message: "Not found"
                });
            });
        }
    },
};
