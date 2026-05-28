import _ from 'lodash';
import { PLAYER_STATUS } from '@geco/shared';

const letters = [
	'A',
	'B',
	'C',
	'D',
	'E',
	'F',
	'G',
	'H',
	'I',
	'J',
	'K',
	'L',
	'M',
	'N',
	'O',
	'P',
	'Q',
	'R',
	'S',
	'T',
	'U',
	'V',
	'W',
	'X',
	'Y',
	'Z',
	'AA',
	'AB',
	'AC',
	'AD',
	'AE',
	'AF',
	'AG',
	'AH',
	'AI',
	'AJ',
	'AK',
	'AL',
	'AM',
	'AN',
	'AO',
	'AP',
	'AQ',
	'AR',
	'AS',
	'AT',
	'AU',
	'AV',
	'AW',
	'AX',
	'AY',
	'AZ',
];
const colors = ['red', 'yellow', 'green', 'blue', 'orange', 'purple'];

const _generateOneCard = async (letterIndex, letterNumber, weight, price) => {
	const letter = letters[letterIndex];
	const color = colors[weight];
	const key = letter + weight.toString() + letterNumber.toString();
	let card = { key, letter, color, weight, price };
	return card;
};

const _areCardIdsUnique = (cardIds, authorizedLength) => {
	const uniqueIds = new Set(cardIds); // Convert array to a Set to eliminate duplicates
	return uniqueIds.size === authorizedLength; // Compare the size of the Set array length authorized
};

const DecksHelper = {};

DecksHelper.generateDecks = async (rules, length) => {
	let tableDecks = [[], [], [], []];
	let lettersInGame = 0;
	const prices = [rules.priceWeight1, rules.priceWeight2, rules.priceWeight3, rules.priceWeight4];

	if (!rules.generateLettersAuto) {
		lettersInGame = rules.generateLettersInDeck;
	} else {
		lettersInGame = Math.round(1.25 * length);
	}

	// genere cartes pour les 4 lots
	for (let weight = 0; weight <= 3; weight++) {
		let deck = [];
		for (let letterIndex = 0; letterIndex <= lettersInGame; letterIndex++) {
			// genere 3, 4 ou 5 cartes identiques
			for (let j = 1; j <= rules.generatedIdenticalLetters; j++) {
				let card = await _generateOneCard(letterIndex, j, weight, prices[weight]);
				deck.push(card);
			}
		}
		tableDecks[weight] = _.shuffle(deck);
	}
	return tableDecks;
};


/**
 * Push cards back into the in-memory decks (no DB call).
 * Caller must hold the game lock (via InMemoryGameStateManager.withLock).
 * @param {object} state - mutable in-memory game state
 * @param {Array}  cards - cards to push back
 */
DecksHelper.pushCardsInDecks = (gameState, cards) => {
	cards.forEach((card) => {
		gameState.decks[card.weight].push(card);
	});
	return gameState;
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
DecksHelper.produce = (gameState, rules, playerStateIdx, cards) => {
	const playerState = gameState.playersStates.find((p) => p.idx === playerStateIdx);
	if (!playerState) throw new Error('ERROR.PLAYER_NOT_FOUND');

	const amountCardsForProd = rules.amountCardsForProd;
	const idsToFilter = cards.map((c) => c.key);

	if (!_areCardIdsUnique(idsToFilter, amountCardsForProd)) {
		throw new Error('ERROR.CARDS_NOT_UNIQUE');
	}

	const cardsToExchange = playerState.cards.filter((card) => idsToFilter.includes(card.key));
	if (cardsToExchange.length !== amountCardsForProd) {
		throw new Error('ERROR.NOT_ENOUGH_CARDS');
	}

	const weight = cardsToExchange[0].weight;
	if (weight >= 3) throw new Error('Technological change not yet implemented');

	// Remove production cards from player's hand
	playerState.cards = playerState.cards.filter((card) => !idsToFilter.includes(card.key));

	// Return exchanged cards to deck and shuffle
	gameState.decks[weight] = _.shuffle([...gameState.decks[weight], ...cardsToExchange]);
	gameState.decks[weight + 1] = _.shuffle(gameState.decks[weight + 1]);

	// Draw new cards
	const newCards = gameState.decks[weight].splice(0, amountCardsForProd);
	const newCardSup = gameState.decks[weight + 1].splice(0, 1)[0];
	const cardsDraw = [...newCards, newCardSup];

	if (cardsDraw.length < amountCardsForProd + 1 || newCardSup === undefined) {
		throw new Error('ERROR.NOT_ENOUGH_CARDS_IN_DECK');
	}

	// Add new cards to player's hand
	playerState.cards = [...playerState.cards, ...cardsDraw];

	return {
		gameState,
		cardsDraw,
	};
};

DecksHelper.whoHaveCard = async (gameState, cardKey) => {
	if (gameState) {
		const player = gameState.playersStates
			.filter((p) => p.status === PLAYER_STATUS.ALIVE)
			.find((player) => player.cards.find((card) => card.key === cardKey));
		if (player) {
			return {
				status: 'player',
				name: player.name,
			};
		} else {
			const inDeck = gameState.decks.some((deck) => deck.some((card) => card.key === cardKey));
			if (inDeck) {
				return {
					status: 'deck',
					name: '',
				};
			}
			return {
				status: 'ko',
				name: '',
				reason: 'not found in deck and avatars hands',
			};
		}
	} else {
		return {
			status: 'ko',
			name: '',
			reason: 'GameState not found',
		};
	}
};

export default DecksHelper;
