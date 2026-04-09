import log from "#config/log";
import _ from 'lodash';
import GameStateModel from "../game.state.model.js";

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
        lettersInGame = Math.round(1.25 * rules.avatars.length);
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

/**
 * Push cards back into the in-memory decks (no DB call).
 * Caller must hold the game lock (via InMemoryGameStateManager.withLock).
 * @param {object} state - mutable in-memory game state
 * @param {Array}  cards - cards to push back
*/
DeckService.pushCardsInDecksInMemory = (state, cards) => {
    cards.forEach(card => {
        state.decks[card.weight].push(card);
    });
    return state;
};

/**
 * Produce / level-up cards for a player (pure in-memory).
 * Exchanges amountCardsForProd same-weight cards for a higher-weight set.
 * Caller must hold the game lock.
 *
 * @param {object} state       - mutable in-memory game state
 * @param {object} rules       - game rules (amountCardsForProd, etc.)
 * @param {number} playerLifeIdx - player's idx field
 * @param {Array}  cards       - the cards to exchange (must pass validation)
 * @returns {{ newCards: Array, discardEvent: object, newCardsEvent: object }}
 * @throws Error if validation fails
 */
DeckService.produceCardLevelUp = (state, rules, playerLifeIdx, cards) => {
    const player = state.playersStates.find(p => p.idx === playerLifeIdx);
    if (!player) throw new Error('ERROR.PLAYER_NOT_FOUND');

    const amountCardsForProd = rules.amountCardsForProd;
    const idsToFilter = cards.map(c => key);

    if (!DeckService.areCardIdsUnique(idsToFilter, amountCardsForProd)) {
        throw new Error('ERROR.CARDS_NOT_UNIQUE');
    }

    const cardsToExchange = player.cards.filter(card => idsToFilter.includes(card.key));
    if (cardsToExchange.length !== amountCardsForProd) {
        throw new Error('ERROR.NOT_ENOUGH_CARDS');
    }

    const weight = cardsToExchange[0].weight;
    if (weight >= 3) throw new Error('Technological change not yet implemented');

    // Remove production cards from player's hand
    player.cards = player.cards.filter(card => !idsToFilter.includes(card.key));

    // Return exchanged cards to deck and shuffle
    state.decks[weight] = _.shuffle([...state.decks[weight], ...cardsToExchange]);
    state.decks[weight + 1] = _.shuffle(state.decks[weight + 1]);

    // Draw new cards
    const newCards = state.decks[weight].splice(0, amountCardsForProd);
    const newCardSup = state.decks[weight + 1].splice(0, 1)[0];
    const cardsDraw = [...newCards, newCardSup];

    if (cardsDraw.length < amountCardsForProd + 1 || newCardSup === undefined) {
        throw new Error('ERROR.NOT_ENOUGH_CARDS_IN_DECK');
    }

    // Add new cards to player's hand
    player.cards = [...player.cards, ...cardsDraw];

    return {
        newCards: cardsDraw,
        cardsExchanged: cardsToExchange,
        triggersEndRound: newCardSup.weight > 2,
    };
};

export default DeckService;
