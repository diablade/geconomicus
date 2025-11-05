import GameModel, {constructor} from "../game/game.model.js";
import * as C from "../../../config/constantes.js";
import log from "../../config/log.js";
import decksService from "../misc/decks.service.js";
import socket from "../../config/socket.js";
import bankService from "../bank/bank.service.js";
import bankTimerManager from "../bank/BankTimerManager.js";
import mongoose from 'mongoose';
import _ from 'lodash';
import gameService from '../game/game.service.js';

const killPlayer = async (idGame, idPlayer) => {
    try {
        const game = await GameModel.findById(idGame);
        if (game.typeMoney === C.DEBT) {
            //stop timer of player's credits
            await bankTimerManager.stopAllPlayerDebtsTimer(idGame, idPlayer);
            //start seizure for any debt
            let event = await bankService.seizureOnDead(idGame, idPlayer);
            socket.emitTo(idGame + C.EVENT, C.EVENT, event);
            socket.emitTo(idGame + C.BANK, C.SEIZED_DEAD, event);
        }
        // get updated player
        let player = await getPlayer(idGame, idPlayer);
        // push the rest of cards in decks
        await decksService.pushCardsInDecks(idGame, player.cards);

        // create event & give status dead
        let event = constructor.event(C.DEAD, "master", idPlayer, player.coins, player.cards, Date.now());
        await GameModel.updateOne({
            _id:           idGame,
            'players._id': idPlayer
        }, {
            $set:  {'players.$.status': C.DEAD},
            $push: {'events': event},
        },);
        socket.emitTo(idPlayer, C.DEAD);
        socket.emitTo(idGame + C.EVENT, C.EVENT, event);
        socket.emitTo(idGame + C.BANK, C.DEAD, event);
        socket.emitTo(idGame + C.MASTER, C.DEAD, event);
    }
    catch (err) {
        log.error('kill player error:', err);
        throw new Error("kill player failed");
    }
}

const getPlayer = async (idGame, idPlayer, statusGames = false) => {
    try {
        if (!idPlayer || !idGame) {
            throw new Error("Bad request: missing game ID or player ID");
        }

        const game = await GameModel.findById(idGame);
        if (!game) {
            throw new Error("Game not found");
        }

        const player = game.players.find(p => p.id === idPlayer);
        if (!player) {
            throw new Error("Player not found");
        }
        if (statusGames) {
            return ({
                player:             player,
                statusGame:         game.status,
                typeMoney:          game.typeMoney,
                currentDU:          game.currentDU,
                timerCredit:        game.timerCredit,
                amountCardsForProd: game.amountCardsForProd,
                gameName:           game.name,
                theme:        game.theme
            });
        }
        else {
            return player;
        }
    }
    catch (err) {
        log.error("GetPlayer: ", err);
        throw err;
    }
}

const join = async (game, name, copyPlayer) => {
    if (game.status === C.END_GAME) {
        throw new Error("Game is finished");
    }
    else if (game.status !== C.OPEN) {
        throw new Error("Game is already started");
    }
    else if (game.players.length >= 25) {
        throw new Error("25 players max");
    }
    else {
        const idPlayer = new mongoose.Types.ObjectId();
        let player = {
            _id:                 idPlayer,
            idx:                 game.players.length + 1,
            name:                name,
            image:               "",
            coins:               0,
            credits:             [],
            cards:               [],
            status:              C.ALIVE,
            earringsProbability: 100,
            glassesProbability:  100,
            featuresProbability: 100
        };

        if(copyPlayer) {
            player.idx = copyPlayer.idx;
            player.image = copyPlayer.image;
            player.eyes = copyPlayer.eyes;
            player.earrings = copyPlayer.earrings;
            player.eyebrows = copyPlayer.eyebrows;
            player.features = copyPlayer.features;
            player.hair = copyPlayer.hair;
            player.glasses = copyPlayer.glasses;
            player.mouth = copyPlayer.mouth;
            player.skinColor = copyPlayer.skinColor;
            player.hairColor = copyPlayer.hairColor;
            player.earringsProbability = copyPlayer.earringsProbability;
            player.glassesProbability = copyPlayer.glassesProbability;
            player.featuresProbability = copyPlayer.featuresProbability;
            player.boardConf = copyPlayer.boardConf;
            player.boardColor = copyPlayer.boardColor;
        }

        let joinEvent = constructor.event(C.NEW_PLAYER, idPlayer.toString(), C.MASTER, 0, [], Date.now());
        let updatedGame = await GameModel.findByIdAndUpdate({_id: game._id}, {
            $push: {
                players: player,
                events:  joinEvent
            }
        }, {new: true})
        if (updatedGame) {
            const newPlayer = updatedGame.players.find(p => p._id == idPlayer.toString());
            socket.emitTo(game._id + C.MASTER, C.NEW_PLAYER, newPlayer);
            return player._id.toString();
        }
        else {
            throw new Error("Join game error: game not found");
        }
    }
}

const produceCardLevelUp = async (idGame, idPlayer, cards) => {
    let game = await GameModel.findById(idGame).lean();
    if (!game) {
        throw new Error("ERROR.GAME_NOT_FOUND");
    }

    const player = game.players.find(p => p._id.toString() === idPlayer);
    if (!player) {
        throw new Error("ERROR.PLAYER_NOT_FOUND");
    }

    const idsToFilter = cards.map(c => c._id);
    if (!decksService.areCardIdsUnique(idsToFilter, game.amountCardsForProd)) {
        throw new Error("ERROR.CARDS_NOT_UNIQUE");
    }
    const cardsToExchange = player.cards.filter(card => idsToFilter.includes(card._id.toString()));

    if (cardsToExchange.length !== game.amountCardsForProd) {
        throw new Error("ERROR.NOT_ENOUGH_CARDS");
    }

    const weight = cardsToExchange[0].weight;
    if (weight >= 3) {
        throw new Error("Technological change not yet implemented");
    }

    // Remove the production cards from player's hand
    player.cards = player.cards.filter(card => !idsToFilter.includes(card._id.toString()));

    // Add the production cards back to the deck and shuffle
    game.decks[weight] = [...game.decks[weight], ...cardsToExchange];
    // and shuffle
    const firstShuffledDeck1 = _.shuffle(game.decks[weight]);
    const firstShuffledDeck2 = _.shuffle(game.decks[weight + 1]);
    // and shuffle again
    const shuffledDeck1 = _.shuffle(firstShuffledDeck1);
    const shuffledDeck2 = _.shuffle(firstShuffledDeck2);

    const newCards = shuffledDeck1.splice(0, game.amountCardsForProd);
    const newCardsIds = newCards.map(c => c._id);
    if (!decksService.areCardIdsUnique(newCardsIds, game.amountCardsForProd)) {
        throw new Error("ERROR.CARDS_NOT_UNIQUE");
    }
    const newCardSup = shuffledDeck2.splice(0, 1)[0];
    const cardsDraw = [...newCards, newCardSup];

    if (cardsDraw.length < game.amountCardsForProd + 1 || newCardSup === undefined) {
        throw new Error("ERROR.NOT_ENOUGH_CARDS_IN_DECK");
    }

    const discardEvent = constructor.event(C.TRANSFORM_DISCARDS, idPlayer, C.MASTER, 0, cardsToExchange, Date.now());
    const newCardsEvent = constructor.event(C.TRANSFORM_NEWCARDS, C.MASTER, idPlayer, 0, cardsDraw, Date.now());

    const playerCardsUpdated = player.cards.concat(cardsDraw);

    await GameModel.updateOne({
        _id:           idGame,
        'players._id': idPlayer
    }, {
        $set:  {
            // update decks
            [`decks.${weight}`]:     shuffledDeck1,
            [`decks.${weight + 1}`]: shuffledDeck2, // update cards player's hand
            'players.$.cards':       playerCardsUpdated,
        },
        $push: {
            'events': {$each: [discardEvent, newCardsEvent]}
        }
    }).lean();

    socket.emitTo(idGame + C.EVENT, C.EVENT, discardEvent);
    socket.emitTo(idGame + C.EVENT, C.EVENT, newCardsEvent);

    if (newCardSup.weight > 2) {
        await gameService.stopRound(idGame, game.round);
    }

    return cardsDraw;
}

export default {
    killPlayer,
    getPlayer,
    join,
    produceCardLevelUp
}
