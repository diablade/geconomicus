import _ from 'lodash';
import log from '#config/log';
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

// Minimum number of level-0 cards to leave in decks[0] so a "square" (production) can always shuffle+draw.
DecksHelper.REINCARNATION_RESERVE_FLOOR = 4;

/**
 * Draw a reincarnated life's opening hand, expressed in level-0-equivalent units.
 * Draws level-0 cards from decks[0] one unit each, but never below the reserve floor;
 * any remaining units are covered by level-1 cards from decks[1] at 2 units each (odd remainder rounds up).
 * Never throws: if decks[1] is also short, deals what is available and warns.
 * Caller must hold the game lock.
 *
 * @param {object} gameState - mutable in-memory game state
 * @param {number} units     - target endowment in level-0-equivalent units (3 or 4)
 * @returns {Array} the cards dealt
 */
DecksHelper.drawReincarnationCards = (gameState, units) => {
	const drawn = [];
	let unitsNeeded = units;

	const deck0 = gameState.decks[0] || [];
	// Shuffle so returned/late cards aren't handed back in a fixed order.
	gameState.decks[0] = _.shuffle(deck0);
	const available0 = Math.max(0, gameState.decks[0].length - DecksHelper.REINCARNATION_RESERVE_FLOOR);
	const take0 = Math.min(unitsNeeded, available0);
	if (take0 > 0) {
		drawn.push(...gameState.decks[0].splice(0, take0));
		unitsNeeded -= take0;
	}

	// Cover the shortfall from level-1 at 2 units each (round up on odd remainder).
	if (unitsNeeded > 0) {
		const deck1 = gameState.decks[1] || [];
		gameState.decks[1] = _.shuffle(deck1);
		const wantLevel1 = Math.ceil(unitsNeeded / 2);
		const take1 = Math.min(wantLevel1, gameState.decks[1].length);
		if (take1 > 0) {
			drawn.push(...gameState.decks[1].splice(0, take1));
		}
		if (take1 < wantLevel1) {
			log.warn(
				`[DecksHelper] reincarnation draw short: decks[0] and decks[1] exhausted, dealt ${drawn.length} card(s) for target ${units} units`
			);
		}
	}

	return drawn;
};

/**
 * Identity of a recipe: the letter and level a card belongs to.
 *
 * @param {{letter: string, weight: number}} card
 * @returns {string} key of the form `"A:0"`
 */
DecksHelper.recipeKeyOf = (card) => `${card.letter}:${card.weight}`;

/**
 * The lives still holding cards — ALIVE or PRISON, since prison is a state of the current life.
 *
 * @param {object} gameState
 * @returns {Array<object>} the living player states
 */
const _livingOf = (gameState) => gameState.playersStates.filter((p) => p.status !== PLAYER_STATUS.DEAD);

/**
 * Map each recipe to the distinct copies living hands hold.
 *
 * @param {Array<object>} livingPlayers
 * @returns {Map<string, Map<string, number>>} recipe key -> (card key -> holder idx)
 */
const _heldCopiesByRecipe = (livingPlayers) => {
	const byRecipe = new Map();
	livingPlayers.forEach((p) =>
		(p.cards || []).forEach((card) => {
			const key = DecksHelper.recipeKeyOf(card);
			if (!byRecipe.has(key)) byRecipe.set(key, new Map());
			byRecipe.get(key).set(card.key, p.idx);
		})
	);
	return byRecipe;
};

/**
 * Recipes completable from living hands alone — the trades that can actually happen.
 *
 * @param {Array<object>} livingPlayers
 * @param {number} need - copies required by the recipe shape
 * @returns {Set<string>} latent recipe keys
 */
DecksHelper.latentRecipeSet = (livingPlayers, need) => {
	const latent = new Set();
	_heldCopiesByRecipe(livingPlayers).forEach((copies, key) => {
		if (copies.size >= need) latent.add(key);
	});
	return latent;
};

/**
 * How many latent squares the table currently holds.
 */
DecksHelper.countLatentSquares = (gameState, amountCardsForProd) =>
	DecksHelper.latentRecipeSet(_livingOf(gameState), amountCardsForProd).size;

/**
 * How many latent squares the table should keep in play: a percentage of the living players.
 */
DecksHelper.latentSquaresGoal = (gameState, rules) =>
	Math.round((_livingOf(gameState).length * (rules.latentSquaresPct ?? 0)) / 100);

/**
 * Draw a producer's replacement cards, spending the first picks on copies that turn a recipe
 * another life is chasing into a latent square — never the copy that would complete the
 * producer's own square — then taking the rest off the shuffled deck. Falls back to a plain
 * draw once the goal is met, when no deck card qualifies, or when the option is off.
 *
 * @param {object} gameState   - mutable in-memory game state
 * @param {object} rules       - game rules (latentSquares, latentSquaresPct, amountCardsForProd)
 * @param {object} playerState - the producer, mutated
 * @param {number} weight      - deck level to draw from
 * @param {number} amount      - cards to draw
 * @returns {Array} the cards drawn
 */
DecksHelper.drawProductionCards = (gameState, rules, playerState, weight, amount) => {
	const deck = gameState.decks[weight];
	const drawn = [];
	const goal = rules.latentSquares ? DecksHelper.latentSquaresGoal(gameState, rules) : 0;

	while (drawn.length < amount && DecksHelper.countLatentSquares(gameState, rules.amountCardsForProd) < goal) {
		const byRecipe = _heldCopiesByRecipe(_livingOf(gameState));
		const index = deck.findIndex((card) => {
			const holders = byRecipe.get(DecksHelper.recipeKeyOf(card));
			if (holders?.size !== rules.amountCardsForProd - 1) return false;
			const ownCopies = [...holders.values()].filter((idx) => idx === playerState.idx).length;
			return ownCopies < rules.amountCardsForProd - 1;
		});
		if (index < 0) break;
		const card = deck.splice(index, 1)[0];
		playerState.cards.push(card);
		drawn.push(card);
	}

	const filler = deck.splice(0, amount - drawn.length);
	playerState.cards.push(...filler);

	if (drawn.length + filler.length < amount) {
		log.warn(
			`[DecksHelper] production draw short: decks[${weight}] exhausted, dealt ${drawn.length + filler.length} card(s) for target ${amount}`
		);
	}
	if (goal > 0) {
		log.debug(
			`[DecksHelper] latent squares: player ${playerState.idx} took ${drawn.length}/${amount} targeted card(s), table at ${DecksHelper.countLatentSquares(gameState, rules.amountCardsForProd)}/${goal}`
		);
	}

	return [...drawn, ...filler];
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
 * @returns {{ cardsLK: Array, consumed: Array, newCards: Array, producedCard: object, weight: number }}
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
	if (cardsToExchange.map((card) => card.weight).some((w) => w !== weight)) {
		throw new Error('ERROR.CARDS_MUST_HAVE_SAME_WEIGHT');
	}

	if (weight >= 3) throw new Error('Technological change not yet implemented');

	const sameLevelAfterReturn = (gameState.decks[weight]?.length ?? 0) + cardsToExchange.length;
	if (sameLevelAfterReturn < amountCardsForProd || (gameState.decks[weight + 1]?.length ?? 0) < 1) {
		throw new Error('ERROR.NOT_ENOUGH_CARDS_IN_DECK');
	}

	// Remove production cards from player's hand
	playerState.cards = playerState.cards.filter((card) => !idsToFilter.includes(card.key));

	const consumed = cardsToExchange.map((card) => ({ ...card }));

	// Return exchanged cards to deck and shuffle
	gameState.decks[weight] = _.shuffle([...gameState.decks[weight], ...cardsToExchange]);
	gameState.decks[weight + 1] = _.shuffle(gameState.decks[weight + 1]);

	// Draw new cards
	const newCards = DecksHelper.drawProductionCards(gameState, rules, playerState, weight, amountCardsForProd);
	const newCardSup = gameState.decks[weight + 1].splice(0, 1)[0];

	// Add new cards to player's hand
	playerState.cards.push(newCardSup);

	return {
		cardsLK: playerState.cards,
		consumed, // snapshot: the originals go back to the deck and get reshuffled
		newCards: newCards,
		producedCard: newCardSup,
		weight, // the two deck levels touched are `weight` and `weight + 1`
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
