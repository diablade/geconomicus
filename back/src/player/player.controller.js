import GameModel from '../game/game.model.js';
import log from '../../conf_log.js';
import _ from 'lodash';
import mongoose from "mongoose";
import {io} from '../../conf_socket.js';

async function importGame(file) {

}

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
                status: "waiting",
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
                        player.status=game.status;
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
                const player = _.find(game.players,{id:idPlayer});
                const cardsToExchange = _.filter(player.cards, {letter:cards[0].letter, weight: cards[0].weight});
                let weight = cardsToExchange[0].weight;
                // Remove cards from player's hand
                await GameModel.updateOne(
                    {_id: idGame, 'players._id': idPlayer},
                    {$pull: {'players.$.cards': {_id: {$in: cardsToExchange.map(c => c.id)}}}}
                );
                // Add cards back to the deck
                await GameModel.updateOne(
                    {_id: idGame},
                    {$push: {[`decks.${weight}`]: {$each: cardsToExchange}}}
                );
                // Draw a card from the next level
                if (weight < 2) {
                    // Shuffle the deck
                    const updatedGame = await GameModel.findById(idGame);
                    const shuffledDeck = _.shuffle(updatedGame.decks[weight]);
                    const shuffledDeck2 = _.shuffle(updatedGame.decks[weight + 1]);
                    // Draw new cards for the player
                    const newCards = shuffledDeck.slice(0, 4);//same weight
                    newCards.push(shuffledDeck2.slice(0, 1)[0]);// one superior
                    await GameModel.updateOne(
                        {_id: idGame},
                        {
                            $set: {
                                [`decks.${weight}`]: shuffledDeck,
                                [`decks.${weight + 1}`]: shuffledDeck2
                            }
                        }
                    );
                    // Add new cards to player's hand
                    await GameModel.updateOne(
                        {_id: idGame, 'players._id': idPlayer},
                        {$push: {'players.$.cards': {$each: newCards}}}
                    );
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
                const buyer = _.find(game.players,{id:idBuyer});
                const seller = _.find(game.players,{id:idSeller});
                const card = _.find(seller.cards, {id:idCard});
                // Check if buyer has enough coins
                if (buyer.coins < card.price) {
                    throw new Error('Not enough coins');
                }
                // remove card and add coins to seller
                await GameModel.updateOne(
                    {_id: idGame, 'players._id': idSeller},
                    {
                        $pull: {'players.$.cards': {_id: idCard}},
                        $inc: {'players.$.coins': card.price}
                    }
                );
                // add card to buyer and remove coins
                await GameModel.updateOne(
                    {_id: idGame, 'players._id': idBuyer},
                    {
                        $push: {'players.$.cards': card},
                        $inc: {'players.$.coins': -card.price}
                    }
                );
                // Send socket to seller with updated coins
                buyer.coins -= card.price;
                seller.coins += card.price;
                io().to(idSeller).emit('transaction-done', {idCardSold: idCard, coins: seller.coins});
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
}
;
