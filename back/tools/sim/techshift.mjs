/**
 * The proposed technological-shift mechanic.
 *
 * Nothing here exists in the shipped game: v2 throws at level 3. This module
 * models the proposal so it can be measured before anyone builds it — when a
 * player completes a recipe at the top level, a new level opens and every price
 * slides down one rung.
 *
 * @module tools/sim/techshift
 */
import _ from 'lodash';
import { DB_EVENTS, PLAYER_STATUS, PLAYER_TYPE } from '@geco/shared';
import EventHelper from '../../src/gameState/helpers/event.helper.js';

const COLORS = ['red', 'yellow', 'green', 'blue', 'orange', 'purple'];

export const MAX_WEIGHT = COLORS.length - 1;

/**
 * Event type for the shift.
 *
 * Declared here rather than in shared DB_EVENTS because the mechanic is a proposal:
 * it earns a place in the shipped vocabulary only once it ships. LkGuard has no
 * contract for an unknown type, so the event passes validation and rides the same
 * in-memory stream as every real one.
 */
export const TECH_SHIFT_EVENT = 'tech-shift';

/**
 * Slide every price down one rung and make the bottom level free.
 *
 * This is the whole economics of the shift: 1/2/4/8 becomes 0/1/2/4/8, then
 * 0/0/1/2/4/8. Goods that were expensive become cheap, and a new top level
 * inherits the old top price.
 *
 * @param {number[]} ladder - price per level, index is the level
 * @returns {number[]} a new ladder, one entry longer
 */
export function nextPriceLadder(ladder) {
	return [0, ...ladder];
}

/**
 * Highest card level currently in play.
 *
 * @param {{decks: Array<Array<object>>}} gameState
 * @returns {number}
 */
export function topWeightOf(gameState) {
	return gameState.decks.length - 1;
}

/**
 * Read the starting price ladder out of the game rules.
 *
 * @param {{priceWeight1: number, priceWeight2: number, priceWeight3: number, priceWeight4: number}} rules
 * @returns {number[]} four prices, level 0 first
 */
export function priceLadderOf(rules) {
	return [rules.priceWeight1, rules.priceWeight2, rules.priceWeight3, rules.priceWeight4];
}

/**
 * Every letter in play, gathered from decks and hands.
 *
 * Read off the board rather than duplicating the helper's private alphabet, so a
 * new level is always minted with exactly the letters the game was built from.
 *
 * @param {object} gameState
 * @returns {string[]}
 */
function lettersOf(gameState) {
	const seen = new Set();
	for (const deck of gameState.decks) for (const card of deck) seen.add(card.letter);
	for (const player of gameState.playersStates) for (const card of player.cards) seen.add(card.letter);
	return [...seen];
}

/**
 * Create a shuffled deck for a level that did not exist before.
 *
 * @param {string[]} letters
 * @param {number} copies - identical copies minted per letter
 * @param {number} weight - the new level
 * @param {number} price
 * @returns {Array<object>} shuffled cards
 */
function mintDeck(letters, copies, weight, price) {
	const deck = [];
	for (const letter of letters) {
		for (let copy = 1; copy <= copies; copy++) {
			deck.push({
				key: `${letter}${weight}${copy}`,
				letter,
				color: COLORS[weight],
				weight,
				price,
			});
		}
	}
	return _.shuffle(deck);
}

/**
 * Re-stamp every card in decks and hands with its level's new price.
 *
 * Price is carried on the card, so a ladder change is meaningless until existing
 * cards are updated too.
 *
 * @param {object} gameState
 * @param {number[]} ladder
 * @returns {void}
 */
function repriceEverything(gameState, ladder) {
	for (const deck of gameState.decks) for (const card of deck) card.price = ladder[card.weight];
	for (const player of gameState.playersStates) for (const card of player.cards) card.price = ladder[card.weight];
}

/**
 * Open the next card level and shift the whole price ladder down.
 *
 * Mints the new deck, slides prices, and re-prices every card already in play.
 * Capped at six levels because a level maps to a card colour.
 *
 * @param {object} gameState - mutable in-memory sim state
 * @param {{generatedIdenticalLetters: number}} rules
 * @returns {{topWeight: number, ladder: number[], cardsMinted: number}|null} null at the ceiling
 */
export function applyTechShift(gameState, rules) {
	const topWeight = topWeightOf(gameState);
	if (topWeight >= MAX_WEIGHT) return null;

	const newWeight = topWeight + 1;
	const previousLadder = gameState.priceLadder;
	const ladder = nextPriceLadder(previousLadder);
	const letters = lettersOf(gameState);

	gameState.decks.push(mintDeck(letters, rules.generatedIdenticalLetters, newWeight, ladder[newWeight]));
	gameState.priceLadder = ladder;
	repriceEverything(gameState, ladder);

	return {
		topWeight: newWeight,
		ladder,
		previousLadder,
		cardsMinted: letters.length * rules.generatedIdenticalLetters,
	};
}

/**
 * Retire the card levels the shift just made worthless, upgrading hands in their place.
 *
 * Only the level whose price *just* fell to zero is retired — level 0 on the first
 * shift, level 1 on the second. Levels that were already free stay put, so a later
 * shift does not confiscate the same cards twice.
 *
 * Those cards leave the hand and go back to their deck; in exchange the player
 * draws from one level up, at `ratio` old cards per new one. At ratio 2 an odd card
 * is surrendered. If the level above is out of stock the player simply gets less,
 * which the log records.
 *
 * Without this, obsolete cards sit frozen in hands and decks for the rest of the
 * game, since nothing free is worth trading for.
 *
 * @param {object} gameState - mutable in-memory sim state
 * @param {number[]} previousLadder - prices before the shift
 * @param {number[]} ladder - the new price ladder, already applied
 * @param {number} ratio - old cards surrendered per replacement card (1 or 2)
 * @returns {Array<{playerIdx: number, avatarIdx: number, returned: number, drawn: number, levels: number[]}>}
 *   one entry per player who exchanged anything
 */
export function retireFreeLevels(gameState, previousLadder, ladder, ratio) {
	const freeLevels = ladder
		.map((price, weight) => ({ price, weight }))
		.filter((l) => l.price === 0 && (previousLadder[l.weight] ?? 0) > 0);
	if (!freeLevels.length) return [];

	const exchanges = [];
	for (const player of gameState.playersStates) {
		if (player.status === PLAYER_STATUS.DEAD) continue;
		if (!player.cards.length) continue;

		const surrendered = [];
		const keep = [];
		for (const card of player.cards) {
			if (freeLevels.some((l) => l.weight === card.weight)) surrendered.push(card);
			else keep.push(card);
		}
		if (!surrendered.length) continue;

		const byLevel = new Map();
		for (const card of surrendered) byLevel.set(card.weight, (byLevel.get(card.weight) ?? 0) + 1);

		player.cards = keep;
		for (const card of surrendered) gameState.decks[card.weight].push(card);

		const drawn = [];
		for (const [weight, count] of byLevel) {
			const target = gameState.decks[weight + 1];
			if (!target) continue;
			gameState.decks[weight] = _.shuffle(gameState.decks[weight]);
			const want = Math.floor(count / ratio);
			drawn.push(...target.splice(0, Math.min(want, target.length)));
		}
		player.cards = [...player.cards, ...drawn];

		exchanges.push({
			playerIdx: player.idx,
			avatarIdx: player.avatarIdx,
			returned: surrendered.length,
			drawn: drawn.length,
			levels: [...byLevel.keys()].sort((a, b) => a - b),
		});
	}
	return exchanges;
}

/**
 * Fire a whole technological shift: open the new level, slide prices, retire what just became free.
 *
 * The trigger is a production that lands a card on the current top level — that first
 * top-level good is what proves the technology, and the table shifts with it. Everything
 * the moment does is one event, so a front replaying the stream can animate the cards
 * flowing back into the deck they came from.
 *
 * @param {object} gameState - mutable in-memory sim state
 * @param {object} rules
 * @param {Array<object>} events - in-memory event log, appended to
 * @param {number} round
 * @param {number} producerIdx - the Life whose production proved the technology
 * @returns {{topWeight: number, ladder: number[], previousLadder: number[], cardsMinted: number,
 *            exchanges: Array<object>, retiredCards: number, replacementCards: number}|null}
 *   null once the level ceiling is reached
 */
export function triggerTechShift(gameState, rules, events, round, producerIdx) {
	const shift = applyTechShift(gameState, rules);
	if (!shift) return null;

	const exchanges = retireFreeLevels(gameState, shift.previousLadder, shift.ladder, rules.techShiftExchangeRatio);
	const retiredCards = exchanges.reduce((sum, e) => sum + e.returned, 0);
	const replacementCards = exchanges.reduce((sum, e) => sum + e.drawn, 0);

	events.push(
		EventHelper.createEvent(TECH_SHIFT_EVENT, gameState, {
			emitter: producerIdx,
			receiver: PLAYER_TYPE.MASTER,
			payload: {
				round,
				topWeight: shift.topWeight,
				ladder: shift.ladder,
				previousLadder: shift.previousLadder,
				exchangeRatio: rules.techShiftExchangeRatio,
				cardsMinted: shift.cardsMinted,
				retiredLevels: [...new Set(exchanges.flatMap((e) => e.levels))].sort((a, b) => a - b),
				retiredPlayers: exchanges.length,
				retiredCards,
				replacementCards,
				deckSizes: gameState.decks.map((d) => d.length),
			},
		})
	);

	return { ...shift, exchanges, retiredCards, replacementCards };
}

/**
 * Produce at a level the shipped game cannot reach.
 *
 * Mirrors DecksEngine.produce — same validate-before-mutate order, same action token,
 * same `production` event — minus the "weight >= 3" guard in the helper underneath it.
 * Kept separate so that every production the real game can perform still runs through
 * the real engine, and only the proposed mechanic diverges. The event is emitted here
 * too, or the stream would fall silent exactly where the mechanic is interesting.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @param {number} playerStateIdx - the producing player's idx
 * @param {Array<{key: string}>} cards - the copies being exchanged
 * @returns {{newCards: Array<object>, producedCard: object, weight: number, actionTokens: number}}
 * @throws {Error} when the hand or the decks cannot satisfy the exchange
 */
export function produceAboveCeiling(entry, playerStateIdx, cards) {
	const { gameState, rules, events } = entry;
	const playerState = gameState.playersStates.find((p) => p.idx === playerStateIdx);
	if (!playerState) throw new Error('ERROR.PLAYER_NOT_FOUND');

	const amountCardsForProd = rules.amountCardsForProd;
	const idsToFilter = cards.map((c) => c.key);
	if (new Set(idsToFilter).size !== amountCardsForProd) throw new Error('ERROR.CARDS_NOT_UNIQUE');

	const cardsToExchange = playerState.cards.filter((card) => idsToFilter.includes(card.key));
	if (cardsToExchange.length !== amountCardsForProd) throw new Error('ERROR.NOT_ENOUGH_CARDS');

	const weight = cardsToExchange[0].weight;
	if (cardsToExchange.some((card) => card.weight !== weight)) throw new Error('ERROR.CARDS_MUST_HAVE_SAME_WEIGHT');
	const sameLevelAfterReturn = (gameState.decks[weight]?.length ?? 0) + cardsToExchange.length;
	if (sameLevelAfterReturn < amountCardsForProd || (gameState.decks[weight + 1]?.length ?? 0) < 1) {
		throw new Error('ERROR.NOT_ENOUGH_CARDS_IN_DECK');
	}

	playerState.cards = playerState.cards.filter((card) => !idsToFilter.includes(card.key));
	gameState.decks[weight] = _.shuffle([...gameState.decks[weight], ...cardsToExchange]);
	gameState.decks[weight + 1] = _.shuffle(gameState.decks[weight + 1]);

	const newCards = gameState.decks[weight].splice(0, amountCardsForProd);
	const newCardSup = gameState.decks[weight + 1].splice(0, 1)[0];

	playerState.cards = [...playerState.cards, ...newCards, newCardSup];
	playerState.actionTokens = (playerState.actionTokens ?? 0) + 1;

	events.push(
		EventHelper.createEvent(DB_EVENTS.PRODUCTION, gameState, {
			emitter: playerStateIdx,
			receiver: playerStateIdx,
			payload: { newCards },
		})
	);

	return { newCards, producedCard: newCardSup, weight, actionTokens: playerState.actionTokens };
}
