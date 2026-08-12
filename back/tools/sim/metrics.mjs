/**
 * Board-state measurements taken once per round.
 *
 * The vocabulary here matches CONTEXT.md: a *recipe* is a letter+level pair; a
 * *ready* square sits complete in one hand; a *latent* square could be assembled
 * from living hands alone; a *theoretical* square could be assembled if the decks
 * were opened too. Cards belonging to a theoretical-but-not-latent recipe are
 * *stranded* — the player chasing them cannot win, which is the conversation the
 * animator has to have.
 *
 * @module tools/sim/metrics
 */

/**
 * Identity of a recipe: the letter and level a card belongs to.
 *
 * @param {{letter: string, weight: number}} card
 * @returns {string} key of the form `"A:0"`
 */
export const recipeKeyOf = (card) => `${card.letter}:${card.weight}`;

/**
 * Group cards by recipe, counting DISTINCT copies.
 *
 * Production needs `amountCardsForProd` different physical copies of the same
 * recipe, so duplicates of one card key must never inflate the count — hence the
 * Set of card keys rather than a tally.
 *
 * @param {Array<{key: string, letter: string, weight: number}>} cards
 * @returns {Map<string, Set<string>>} recipe key to the set of distinct card keys
 */
export function distinctCopiesByRecipe(cards) {
	const byRecipe = new Map();
	for (const card of cards) {
		const key = recipeKeyOf(card);
		if (!byRecipe.has(key)) byRecipe.set(key, new Set());
		byRecipe.get(key).add(card.key);
	}
	return byRecipe;
}

/**
 * Recipes this player already holds complete and could produce right now.
 *
 * @param {{cards: Array<object>}} playerState
 * @param {number} need - copies required by the recipe shape
 * @returns {string[]} recipe keys that are ready
 */
export function readySquaresOf(playerState, need) {
	const byRecipe = distinctCopiesByRecipe(playerState.cards);
	const ready = [];
	for (const [key, copies] of byRecipe) if (copies.size >= need) ready.push(key);
	return ready;
}

/**
 * Total ready squares across every living hand.
 *
 * @param {Array<{cards: Array<object>}>} livingPlayers
 * @param {number} need - copies required by the recipe shape
 * @returns {number}
 */
export function countReadySquares(livingPlayers, need) {
	return livingPlayers.reduce((total, p) => total + readySquaresOf(p, need).length, 0);
}

/**
 * Recipes completable from living hands alone — the trades that can actually happen.
 *
 * @param {Array<{cards: Array<object>}>} livingPlayers
 * @param {number} need - copies required by the recipe shape
 * @returns {Set<string>} latent recipe keys
 */
export function latentRecipeSet(livingPlayers, need) {
	const pooled = new Map();
	for (const player of livingPlayers) {
		for (const card of player.cards) {
			const key = recipeKeyOf(card);
			if (!pooled.has(key)) pooled.set(key, new Set());
			pooled.get(key).add(card.key);
		}
	}
	const latent = new Set();
	for (const [key, copies] of pooled) if (copies.size >= need) latent.add(key);
	return latent;
}

/**
 * Recipes completable if deck cards counted too — the paper-possible set.
 *
 * The gap between this and {@link latentRecipeSet} is the doomed-chase zone:
 * enough copies exist, but some are buried in a deck where no player can reach them.
 *
 * @param {Array<{cards: Array<object>}>} livingPlayers
 * @param {Array<Array<object>>} decks - deck per level
 * @param {number} need - copies required by the recipe shape
 * @returns {Set<string>} theoretical recipe keys
 */
export function theoreticalRecipeSet(livingPlayers, decks, need) {
	const pooled = new Map();
	const add = (card) => {
		const key = recipeKeyOf(card);
		if (!pooled.has(key)) pooled.set(key, new Set());
		pooled.get(key).add(card.key);
	};
	for (const player of livingPlayers) for (const card of player.cards) add(card);
	for (const deck of decks) for (const card of deck) add(card);

	const theoretical = new Set();
	for (const [key, copies] of pooled) if (copies.size >= need) theoretical.add(key);
	return theoretical;
}

/**
 * Fraction of held cards whose recipe is theoretically completable but not latent.
 *
 * A high share is the measurable form of "I asked everyone and my card is not in
 * the game" — the player is chasing copies that sit in a deck.
 *
 * @param {Array<{cards: Array<object>}>} livingPlayers
 * @param {Array<Array<object>>} decks - deck per level
 * @param {number} need - copies required by the recipe shape
 * @returns {{held: number, doomed: number, share: number}} share is 0 when no cards are held
 */
export function strandedShareOf(livingPlayers, decks, need) {
	const latent = latentRecipeSet(livingPlayers, need);
	const theoretical = theoreticalRecipeSet(livingPlayers, decks, need);

	let held = 0;
	let doomed = 0;
	for (const player of livingPlayers) {
		for (const card of player.cards) {
			held++;
			const key = recipeKeyOf(card);
			if (!latent.has(key) && theoretical.has(key)) doomed++;
		}
	}
	return { held, doomed, share: held ? doomed / held : 0 };
}

/**
 * Gini coefficient over a set of non-negative values.
 *
 * Reported as information only: the simulator's tie-break is minimum production
 * per player, not equality of outcome.
 *
 * @param {number[]} values - negative entries are discarded
 * @returns {number} 0 for perfect equality, approaching 1 for total concentration
 */
export function giniOf(values) {
	const sorted = values.filter((v) => v >= 0).sort((a, b) => a - b);
	const n = sorted.length;
	const sum = sorted.reduce((s, v) => s + v, 0);
	if (!n || !sum) return 0;
	let cumulative = 0;
	for (let i = 0; i < n; i++) cumulative += (i + 1) * sorted[i];
	return (2 * cumulative) / (n * sum) - (n + 1) / n;
}

/**
 * Snapshot of the board for one round, appended to the run's time series.
 *
 * @param {object} gameState - mutable in-memory sim state
 * @param {number} need - copies required by the recipe shape
 * @param {Array<{cards: Array<object>}>} livingPlayers
 * @returns {{latentSquares: number, readySquares: number, theoreticalSquares: number,
 *            strandedShare: number, deckSizes: number[], massMonetary: number, aliveCount: number}}
 */
export function sampleState(gameState, need, livingPlayers) {
	const latent = latentRecipeSet(livingPlayers, need);
	const theoretical = theoreticalRecipeSet(livingPlayers, gameState.decks, need);
	const stranded = strandedShareOf(livingPlayers, gameState.decks, need);
	return {
		latentSquares: latent.size,
		readySquares: countReadySquares(livingPlayers, need),
		theoreticalSquares: theoretical.size,
		strandedShare: stranded.share,
		deckSizes: gameState.decks.map((d) => d.length),
		massMonetary: gameState.currentMassMonetary,
		aliveCount: livingPlayers.length,
	};
}
