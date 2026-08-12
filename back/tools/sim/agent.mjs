import { recipeKeyOf, distinctCopiesByRecipe } from './metrics.mjs';
import { shuffled } from './rng.mjs';
import BankHelper from '../../src/gameState/helpers/bank.helper.js';
import BankEngine, { creditsOfPlayer } from '../../src/gameState/engine/bank.engine.js';

/**
 * Rank the recipes a player is building, closest to complete first.
 *
 * This is the whole of the agent's planning: chase whatever the hand already holds
 * most of, breaking ties toward recipes the room is rich in, then toward cheaper
 * levels. There is no memory of previous rounds and no lookahead.
 *
 * @param {{cards: Array<object>}} player
 * @param {Map<string, Set<string>>} pooledCopies - distinct copies visible across living hands
 * @returns {Array<{key: string, letter: string, weight: number, ownCopies: number,
 *                  ownKeys: Set<string>, pooledCopies: number}>} best target first
 */
export function rankedRecipesOf(player, pooledCopies) {
	const byRecipe = distinctCopiesByRecipe(player.cards);
	const ranked = [];
	for (const [key, copies] of byRecipe) {
		const [letter, weight] = key.split(':');
		ranked.push({
			key,
			letter,
			weight: Number(weight),
			ownCopies: copies.size,
			ownKeys: copies,
			pooledCopies: pooledCopies.get(key)?.size ?? copies.size,
		});
	}
	ranked.sort(
		(a, b) =>
			b.ownCopies - a.ownCopies ||
			b.pooledCopies - a.pooledCopies ||
			a.weight - b.weight ||
			a.letter.localeCompare(b.letter)
	);
	return ranked;
}

/**
 * The one recipe a player is furthest along on.
 *
 * @param {{cards: Array<object>}} player
 * @param {Map<string, Set<string>>} pooledCopies
 * @returns {object|null} null when the hand is empty
 */
export function bestRecipeOf(player, pooledCopies) {
	return rankedRecipesOf(player, pooledCopies)[0] ?? null;
}

/**
 * Index every distinct card key held by living players, grouped by recipe.
 *
 * Recomputed each round because hands change constantly. It is what lets an agent
 * judge whether a recipe is worth chasing at all.
 *
 * @param {Array<{cards: Array<object>}>} livingPlayers
 * @returns {Map<string, Set<string>>} recipe key to distinct card keys in play
 */
export function pooledCopiesOf(livingPlayers) {
	const pooled = new Map();
	for (const player of livingPlayers) {
		for (const card of player.cards) {
			const key = recipeKeyOf(card);
			if (!pooled.has(key)) pooled.set(key, new Set());
			pooled.get(key).add(card.key);
		}
	}
	return pooled;
}

/**
 * Decide whether a seller parts with a card — the only strategic behaviour modelled.
 *
 * A seller freely sells anything outside their own best recipe. Inside it they
 * hoard, unless the buyer is already further ahead on that same recipe (the chase
 * is lost either way) or is level with them and richer.
 *
 * @param {{cards: Array<object>, coins: number}} seller
 * @param {object} card - the card being asked for
 * @param {{cards: Array<object>, coins: number}} buyer
 * @param {Map<string, Set<string>>} pooledCopies
 * @returns {boolean} true when the trade goes ahead
 */
export function willSell(seller, card, buyer, pooledCopies) {
	const sellerBest = bestRecipeOf(seller, pooledCopies);
	const cardRecipe = recipeKeyOf(card);
	if (!sellerBest || sellerBest.key !== cardRecipe) return true;

	const buyerCopies = distinctCopiesByRecipe(buyer.cards).get(cardRecipe)?.size ?? 0;
	if (buyerCopies > sellerBest.ownCopies) return true;
	if (buyerCopies === sellerBest.ownCopies) return buyer.coins > seller.coins;
	return false;
}

/**
 * Choose this round's purchase from the players actually met.
 *
 * Walks the buyer's ranked recipes and takes the first one any reachable seller can
 * supply, affordably and willingly. When no recipe is left to chase — including the
 * empty hand a player is left with after selling everything — it falls back to
 * {@link findReentryPurchase} so the agent can re-enter the economy instead of
 * idling forever.
 *
 * @param {{idx: number, cards: Array<object>, coins: number}} buyer
 * @param {Array<object>} reachableSellers - players met this round
 * @param {Map<string, Set<string>>} pooledCopies
 * @param {(card: object) => number} priceOf - resolves a card's price in current money
 * @param {number} need - copies required by the recipe shape
 * @returns {{seller: object, card: object, price: number, recipe: object|null}|null}
 */
export function findPurchase(buyer, reachableSellers, pooledCopies, priceOf, need) {
	const others = reachableSellers.filter((p) => p.idx !== buyer.idx);
	const ranked = rankedRecipesOf(buyer, pooledCopies);

	for (const recipe of ranked) {
		if (recipe.ownCopies >= need) continue;

		const offers = [];
		for (const seller of others) {
			for (const card of seller.cards) {
				if (recipeKeyOf(card) !== recipe.key) continue;
				if (recipe.ownKeys.has(card.key)) continue;
				const price = priceOf(card);
				if (buyer.coins < price) continue;
				if (!willSell(seller, card, buyer, pooledCopies)) continue;
				offers.push({ seller, card, price, recipe });
			}
		}
		if (offers.length) return shuffled(offers)[0];
	}
	if (ranked.some((recipe) => recipe.ownCopies < need)) return null;
	return findReentryPurchase(buyer, others, pooledCopies, priceOf);
}

/**
 * Every card on offer from the given sellers, priced and flagged for willingness.
 *
 * @param {object} buyer
 * @param {Array<object>} others - candidate sellers, buyer already excluded
 * @param {Map<string, Set<string>>} pooledCopies
 * @param {(card: object) => number} priceOf
 * @returns {Array<{seller: object, card: object, price: number, recipe: null, willing: boolean}>}
 */
function reentryOffersFor(buyer, others, pooledCopies, priceOf) {
	const offers = [];
	for (const seller of others) {
		for (const card of seller.cards) {
			offers.push({
				seller,
				card,
				price: priceOf(card),
				recipe: null,
				willing: willSell(seller, card, buyer, pooledCopies),
			});
		}
	}
	return offers;
}

/**
 * Buy the cheapest card at the lowest level available — how a player restarts.
 *
 * Reached only when the buyer has no recipe left to chase. Without this an empty
 * hand is terminal, because purchase targets are derived from the hand itself.
 *
 * @param {object} buyer
 * @param {Array<object>} others - candidate sellers, buyer already excluded
 * @param {Map<string, Set<string>>} pooledCopies
 * @param {(card: object) => number} priceOf
 * @returns {{seller: object, card: object, price: number, recipe: null}|null}
 */
function findReentryPurchase(buyer, others, pooledCopies, priceOf) {
	const affordable = reentryOffersFor(buyer, others, pooledCopies, priceOf).filter(
		(offer) => offer.willing && buyer.coins >= offer.price
	);
	if (!affordable.length) return null;
	const lowestWeight = Math.min(...affordable.map((offer) => offer.card.weight));
	const entryLevel = affordable.filter((offer) => offer.card.weight === lowestWeight);
	const cheapest = Math.min(...entryLevel.map((offer) => offer.price));
	return shuffled(entryLevel.filter((offer) => offer.price === cheapest))[0];
}

/**
 * Explain why a round produced no purchase, for the action log.
 *
 * Searching is never chosen — it is what a round becomes when buying and borrowing
 * both failed. This names the wall that was hit so the log can be audited.
 *
 * @param {object} buyer
 * @param {Array<object>} encountered - players met this round
 * @param {Array<object>} livingPlayers - everyone still alive
 * @param {Map<string, Set<string>>} pooledCopies
 * @param {(card: object) => number} priceOf
 * @param {number} need - copies required by the recipe shape
 * @returns {{reason: 'broke'|'refused'|'notMet'|'nowhere', price?: number}}
 *   broke: met a willing seller but could not pay;
 *   refused: met a holder who is hoarding;
 *   notMet: someone in the game holds it, just nobody met;
 *   nowhere: no living player holds it, the copies are stranded in a deck
 */
export function classifySearch(buyer, encountered, livingPlayers, pooledCopies, priceOf, need) {
	const chasing = rankedRecipesOf(buyer, pooledCopies).filter((r) => r.ownCopies < need);
	const met = encountered.filter((p) => p.idx !== buyer.idx);
	const elsewhere = livingPlayers.filter((p) => p.idx !== buyer.idx);

	if (!chasing.length) {
		const offers = reentryOffersFor(buyer, met, pooledCopies, priceOf);
		const willing = offers.filter((offer) => offer.willing);
		if (willing.length) return { reason: 'broke', price: Math.min(...willing.map((o) => o.price)) };
		if (offers.length) return { reason: 'refused' };
		return { reason: elsewhere.some((p) => p.cards.length) ? 'notMet' : 'nowhere' };
	}

	let metHolder = false;
	let cheapestWilling = null;
	for (const recipe of chasing) {
		for (const seller of met) {
			for (const card of seller.cards) {
				if (recipeKeyOf(card) !== recipe.key) continue;
				if (recipe.ownKeys.has(card.key)) continue;
				metHolder = true;
				if (!willSell(seller, card, buyer, pooledCopies)) continue;
				const price = priceOf(card);
				if (cheapestWilling === null || price < cheapestWilling) cheapestWilling = price;
			}
		}
	}
	if (cheapestWilling !== null) return { reason: 'broke', price: cheapestWilling };
	if (metHolder) return { reason: 'refused' };

	for (const recipe of chasing) {
		for (const seller of elsewhere) {
			for (const card of seller.cards) {
				if (recipeKeyOf(card) !== recipe.key) continue;
				if (recipe.ownKeys.has(card.key)) continue;
				return { reason: 'notMet' };
			}
		}
	}
	return { reason: 'nowhere' };
}

/**
 * Price of the next card the buyer would want, ignoring who they happened to meet.
 *
 * Used for borrowing decisions, where the question is what the player is saving
 * toward rather than what is reachable this round.
 *
 * @param {object} buyer
 * @param {Array<object>} livingPlayers
 * @param {Map<string, Set<string>>} pooledCopies
 * @param {(card: object) => number} priceOf
 * @param {number} need - copies required by the recipe shape
 * @returns {number|null} null when nothing is worth buying
 */
export function findAnyAffordableTarget(buyer, livingPlayers, pooledCopies, priceOf, need) {
	const others = livingPlayers.filter((p) => p.idx !== buyer.idx);
	const ranked = rankedRecipesOf(buyer, pooledCopies);
	for (const recipe of ranked) {
		if (recipe.ownCopies >= need) continue;
		for (const seller of others) {
			for (const card of seller.cards) {
				if (recipeKeyOf(card) !== recipe.key) continue;
				if (recipe.ownKeys.has(card.key)) continue;
				if (!willSell(seller, card, buyer, pooledCopies)) continue;
				return priceOf(card);
			}
		}
	}
	return null;
}

/**
 * Decide whether a player asks the animator for a credit.
 *
 * Borrow only when short of the next thing worth buying, and only while the credit
 * would leave the player solvent — a crude rule, not a plan. Solvency, wealth and
 * what counts as still owed are the bank's definitions, not the agent's; the agent
 * only supplies the appetite.
 *
 * The prospective credit is measured against wealth *after* the money lands, which is
 * what the extra `defaultCreditAmount` on the wealth side stands for.
 *
 * @param {object} gameState
 * @param {object} player
 * @param {number|null} neededPrice - price of the next wanted card, null when nothing is wanted
 * @param {{defaultCreditAmount: number, defaultInterestAmount: number}} rules
 * @returns {boolean}
 */
export function wantsCredit(gameState, player, neededPrice, rules) {
	if (neededPrice === null) return false;
	if (player.coins >= neededPrice) return false;

	const { wealth, obligation } = BankHelper.computeSolvency(
		player,
		creditsOfPlayer(gameState, player.idx),
		rules.defaultCreditAmount,
		rules.defaultInterestAmount
	);
	return obligation <= wealth + rules.defaultCreditAmount;
}

/**
 * Decide what a player does when a credit falls due.
 *
 * What the player *can* do is the bank's ruling; which of those they pick is the
 * agent's. Settles when that still leaves enough for the next purchase, otherwise
 * rolls the debt over by paying interest alone, otherwise defaults into seizure.
 *
 * @param {object} player
 * @param {{amount: number, interest: number}} credit
 * @param {number|null} neededPrice - price of the next wanted card
 * @returns {'settle'|'extend'|'fault'}
 */
export function maturityChoice(player, credit, neededPrice) {
	const { canSettle, canExtend } = BankEngine.whatCanDoCredit(credit, player);
	const owed = credit.amount + credit.interest;
	if (canSettle && player.coins - owed >= (neededPrice ?? 0)) return 'settle';
	if (canExtend) return 'extend';
	return 'fault';
}
