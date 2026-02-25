import log from "#config/log";
import GameStateModel from "./game.state.model.js";

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ"];
const colors = ["red", "yellow", "green", "blue", "orange", "purple"];

const generateOneCard = async (letterIndex, letterNumber, weight, price) => {
    const letter = letters[letterIndex];
    const color = colors[weight];
    const key = letter + weight.toString() + letterNumber.toString();
    let card = {key, letter, color, weight, price};
    return card;
}

const DeckService = {};

DeckService.generateDecks = async (rules) => {
    let tableDecks = [[], [], [], []];
    let lettersInGame = 0;
    const prices = [rules.priceWeight1, rules.priceWeight2, rules.priceWeight3, rules.priceWeight4];

    if (!rules.generateLettersAuto) {
        lettersInGame = rules.generateLettersInDeck;
    }
    else {
        lettersInGame = Math.round(1.25 * rules.players.length);
    }

    // genere cartes pour les 4 lots
    for (let weight = 0; weight <= 3; weight++) {
        let deck = [];
        for (let letterIndex = 0; letterIndex <= lettersInGame; letterIndex++) {
            // genere 3, 4 ou 5 cartes identiques
            for (let j = 1; j <= rules.generatedIdenticalLetters; j++) {
                let card = await generateOneCard(letterIndex, j, weight, prices[weight]);
                deck.push(card);
            }
        }
        tableDecks[weight] = _.shuffle(deck);
    }
    return tableDecks;
};

DeckService.areCardIdsUnique = (cardIds, authorizedLength) => {
    const uniqueIds = new Set(cardIds);  // Convert array to a Set to eliminate duplicates
    return uniqueIds.size === authorizedLength;  // Compare the size of the Set array length authorized
};

DeckService.pushCardsInDecks = async (idGame, cards) => {
    try {
        const groupedCards = _.groupBy(_.sortBy(cards, 'weight'), 'weight');
        await GameStateModel.updateOne({ _id: idGame }, {
            $push: {
                [`decks.${0}`]: { $each: groupedCards[0] ? groupedCards[0] : [] },
                [`decks.${1}`]: { $each: groupedCards[1] ? groupedCards[1] : [] },
                [`decks.${2}`]: { $each: groupedCards[2] ? groupedCards[2] : [] },
                [`decks.${3}`]: { $each: groupedCards[3] ? groupedCards[3] : [] },
            },
        });
    }
    catch (err) {
        log.error("Cards are not back in decks", err);
    }
};

export default DeckService;
