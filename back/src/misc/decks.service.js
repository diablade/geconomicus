import mongoose from "mongoose";
import GameModel, {constructor} from "../game/game.model.js";
import _ from "lodash";
import log from "../../config/log.js";

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
const colors = ["red", "yellow", "green", "blue"];

const areCardIdsUnique = (cardIds, authorizedLength) => {
    const uniqueIds = new Set(cardIds);  // Convert array to a Set to eliminate duplicates
    return uniqueIds.size === authorizedLength;  // Compare the size of the Set array length authorized
}
const generateOneCard = async (letterIndex, letterNumber, weight, price) => {
    const letter = letters[letterIndex];
    const color = colors[weight];
    const key = letter + weight.toString() + letterNumber.toString();
    let card = constructor.card(key, letter, color, weight, price);
    card._id = new mongoose.Types.ObjectId();
    return card;
}
const generateDecks = async (game) => {
    const prices = [game.priceWeight1, game.priceWeight2, game.priceWeight3, game.priceWeight4];

    let tableDecks = [[], [], [], []];
    let lettersInGame = Math.round(1.25 * game.players.length);
    if (!game.generateLettersAuto) {
        lettersInGame = game.generateLettersInDeck;
    }
    // genere cartes pour les 4 lots
    for (let weight = 0; weight <= 3; weight++) {
        let deck = [];
        for (let letterIndex = 0; letterIndex <= lettersInGame; letterIndex++) {
            // genere 3, 4 ou 5 cartes identiques
            for (let j = 1; j <= game.generatedIdenticalCards; j++) {
                let card = await generateOneCard(letterIndex, j, weight, prices[weight]);
                deck.push(card);
            }
        }
        tableDecks[weight] = _.shuffle(deck);
    }
    return tableDecks;
}
const pushCardsInDecks = async (idGame, cards) => {
    try {
        const groupedCards = _.groupBy(_.sortBy(cards, 'weight'), 'weight');
        await GameModel.updateOne({_id: idGame}, {
            $push: {
                [`decks.${0}`]: {$each: groupedCards[0] ? groupedCards[0] : []},
                [`decks.${1}`]: {$each: groupedCards[1] ? groupedCards[1] : []},
                [`decks.${2}`]: {$each: groupedCards[2] ? groupedCards[2] : []},
                [`decks.${3}`]: {$each: groupedCards[3] ? groupedCards[3] : []},
            },
        });
    }
    catch (err) {
        log.error("Cards are not back in decks", err);
    }
}

export default {
    generateDecks,
    pushCardsInDecks,
    areCardIdsUnique,
}
