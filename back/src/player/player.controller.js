import GameModel, {constructor} from '../game/game.model.js';
import log from '../../conf_log.js';
import _ from 'lodash';
import mongoose from "mongoose";
import {io} from '../../conf_socket.js';
import {EVENT, MASTER, START_GAME, STOP_ROUND, INTER_TOUR, START_ROUND} from '../../../config/constantes.js';

// import constantes from '../../../config/constantes.js';
// const {EVENT, MASTER} = constantes;


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
            const comId = new mongoose.Types.ObjectId();
            let player = {
                _id: comId,
                name: name,
                image: "",
                sold: 0,
                credits: [],
                cards: [],
                status: "alive",
                earringsProbability: 100,
                glassesProbability: 100,
                featuresProbability: 100
            };
            GameModel.findOneAndUpdate({_id: id}, {$push: {players: player}},)
                .then(updatedGame =>
                    res.status(200).json(player._id))
                .catch(error => {
                        log(error);
                        next({status: 404, message: "Not found"});
                    }
                );
        }
    },
    update: async (req, res, next) => {
        const idGame = req.body.idGame;
        const player = req.body;
        const playerId = player._id
        if (!idGame && !playerId) {
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
                    // add any other fields you want to update here
                }
            }, {
                arrayFilters: [{'elem._id': playerId}],
                new: true
            })
                .then((updatedGame) => {
                    io().to(idGame).emit("updated-game", updatedGame);
                    res.status(200).json({"status": "updated"});
                })
                .catch((error) => {
                    console.log(error);
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
                        player.typeMoney = game.typeMoney;
                        res.status(200).json(player);
                    } else {
                        next({status: 404, message: "player Not found"});
                    }
                })
                .catch(error => {
                        log(error);
                        next({status: 404, message: "game Not found"});
                    }
                );
        }
    },
    produceFromSquare: async (req, res, next) => {
        const idGame = req.body.idGame;
        const idPlayer = req.body.idPlayer;
        const cards = req.body.cards;
        if (!idGame || !idPlayer || !cards || cards.length !== 4 || cards[0].weight !== cards[1].weight || cards[0].letter !== cards[1].letter) {
            next({
                status: 400,
                message: "bad request"
            });
        } else {
            try {
                const game = await GameModel.findById(idGame);
                const player = _.find(game.players, {id: idPlayer});
                const cardsToExchange = _.filter(player.cards, {letter: cards[0].letter, weight: cards[0].weight});
                let weight = cardsToExchange[0].weight;
                // Remove cards from player's hand
                await GameModel.updateOne(
                    {_id: idGame, 'players._id': idPlayer},
                    {$pull: {'players.$.cards': {_id: {$in: cardsToExchange.map(c => c.id)}}}},
                    {new: true}
                );
                // Add cards back to the deck
                await GameModel.updateOne(
                    {_id: idGame},
                    {$push: {[`decks.${weight}`]: {$each: cardsToExchange}}},
                    {new: true}
                );
                // Draw a card from the next level
                if (weight < 2) {
                    // Shuffle the deck
                    const updatedGame = await GameModel.findById(idGame);
                    const shuffledDeck = _.shuffle(updatedGame.decks[weight]);
                    const shuffledDeck2 = _.shuffle(updatedGame.decks[weight + 1]);
                    // Draw new cards for the player
                    const newCards = shuffledDeck.slice(0, 4);//same weight
                    const newCardSup = shuffledDeck2.slice(0, 1)[0]; // one superior gift
                    const newcardsIds = _.map(newCards,c=>c._id);
                    newCards.push(newCardSup);
                    await GameModel.updateOne(
                        {_id: idGame},
                        {
                            $pull: {
                                [`decks.${weight}`]: {id: {$in: newcardsIds}},
                                [`decks.${weight + 1}`]: {id: newCardSup._id}
                            }
                        },
                        {new: true}
                    );
                    // Add new cards to player's hand
                    await GameModel.updateOne(
                        {_id: idGame, 'players._id': idPlayer},
                        {$push: {'players.$.cards': {$each: newCards}}}
                    );
                    let discardEvent = constructor.event("transformDiscard", idPlayer, "master", 0, cardsToExchange, Date.now());
                    let newCardsEvent = constructor.event('tranformNewCards', "master", idPlayer, 0, newCards, Date.now());
                    // add event
                    await GameModel.updateOne(
                        {_id: idGame},
                        {
                            $push: {'events': {$each: [discardEvent, newCardsEvent]}},
                        }
                    );
                    io().to("master").emit(EVENT, {event: discardEvent});
                    io().to("master").emit(EVENT, {event: newCardsEvent});
                    res.status(200).json(newCards);
                } else {
                    //TODO changement technologique
                }
            } catch (error) {
                throw error;
            }
        }
    },
    transaction: async (req, res, next) => {
        const idGame = req.body.idGame;
        const idBuyer = req.body.idBuyer;
        const idSeller = req.body.idSeller;
        const idCard = req.body.idCard;
        if (idGame && idBuyer && idSeller && idCard) {
            try {
                const game = await GameModel.findById(idGame);
                const buyer = _.find(game.players, {id: idBuyer});
                const seller = _.find(game.players, {id: idSeller});
                const card = _.find(seller.cards, {id: idCard});
                const cost = game.typeMoney=== "june" ? (card.price*game.currentDU).toFixed(2) : card.price;
                let newEvent = constructor.event('transaction', idBuyer, idSeller, card.price, [card], Date.now());
                // Check if buyer has enough coins
                if (buyer.coins < cost) {
                    throw new Error('Not enough coins');
                }
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
                io().to("master").emit(EVENT, newEvent);
                // Send socket to seller with updated coins
                buyer.coins -= cost;
                seller.coins += cost;
                io().to(idSeller).emit('transaction-done', {idCardSold: idCard, coins: seller.coins});
                // Send back to buyer , card with updated coins
                res.status(200).json({buyedCard: card, coins: buyer.coins});
            } catch (error) {
                throw error;
            }
        } else {
            next({
                status: 400,
                message: "bad request"
            });
        }
    }
};
