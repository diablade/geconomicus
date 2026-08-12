import { jest } from '@jest/globals';
import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS, LK_KEYS } from '@geco/shared';

await jest.unstable_mockModule('#config/log', () => ({
	default: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { default: DecksEngine } = await import('../src/gameState/engine/decks.engine.js');

const card = (letter, weight, copy) => ({
	key: `${letter}${weight}${copy}`,
	letter,
	weight,
	price: 2 ** weight,
	color: 'red',
});

/** A hand holding one complete 4-copy recipe of `letter` at `weight`, plus a spare. */
const completeRecipe = (letter, weight) => [1, 2, 3, 4].map((copy) => card(letter, weight, copy));

const makeGameState = (overrides = {}) => ({
	_id: 'game-001',
	sessionId: 'session-001',
	typeMoney: GAME_TYPE.JUNE,
	currentDU: 1,
	currentMassMonetary: 100,
	credits: [],
	decks: [
		[card('B', 0, 1), card('B', 0, 2), card('B', 0, 3), card('B', 0, 4), card('B', 0, 5)],
		[card('C', 1, 1), card('C', 1, 2)],
		[card('D', 2, 1)],
		[],
	],
	playersStates: [
		{ idx: 0, avatarIdx: 0, status: PLAYER_STATUS.ALIVE, coins: 10, cards: completeRecipe('A', 0), actionTokens: 2 },
		{ idx: 1, avatarIdx: 1, status: PLAYER_STATUS.ALIVE, coins: 10, cards: [], actionTokens: 0 },
	],
	...overrides,
});

const makeEntry = (gameState = makeGameState()) => ({
	gameState,
	rules: { amountCardsForProd: 4, generatedIdenticalLetters: 5 },
	events: [],
});

const handOf = (entry, idx = 0) => entry.gameState.playersStates.find((p) => p.idx === idx).cards;

describe('DecksEngine — produce', () => {
	it('exchanges the recipe for a card one weight up', () => {
		const entry = makeEntry();

		const result = DecksEngine.produce(entry, 0, completeRecipe('A', 0));

		expect(result.weight).toBe(0);
		expect(result.producedCard.weight).toBe(1);
		expect(result.newCards).toHaveLength(4);
		expect(handOf(entry).map((c) => c.key)).toContain(result.producedCard.key);
	});

	it('pays the producer one action token', () => {
		const entry = makeEntry();

		const result = DecksEngine.produce(entry, 0, completeRecipe('A', 0));

		expect(result.actionTokens).toBe(3);
		expect(entry.gameState.playersStates[0].actionTokens).toBe(3);
	});

	it('records exactly one production event, carrying the producer', () => {
		const entry = makeEntry();

		DecksEngine.produce(entry, 0, completeRecipe('A', 0));

		expect(entry.events).toHaveLength(1);
		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.PRODUCTION);
		expect(Object.keys(entry.events[0].payload[LK_KEYS.PLAYERS])).toEqual(['0']);
	});

	it('names the cards handed in and the card produced in the event', () => {
		const entry = makeEntry();

		const result = DecksEngine.produce(entry, 0, completeRecipe('A', 0));

		const { consumed, produced, newCards } = entry.events[0].payload;
		expect(consumed.map((c) => c.key)).toEqual(completeRecipe('A', 0).map((c) => c.key));
		expect(produced.key).toBe(result.producedCard.key);
		expect(newCards).toHaveLength(4);
	});

	it('keeps the consumed cards as a snapshot, untouched by the reshuffle', () => {
		const entry = makeEntry();

		DecksEngine.produce(entry, 0, completeRecipe('A', 0));

		const { consumed } = entry.events[0].payload;
		expect(consumed.every((c) => c.letter === 'A' && c.weight === 0)).toBe(true);
		expect(entry.gameState.decks[0].some((c) => c === consumed[0])).toBe(false);
	});

	it('conserves every card across the exchange', () => {
		const entry = makeEntry();
		const before =
			entry.gameState.decks.reduce((sum, deck) => sum + deck.length, 0) +
			entry.gameState.playersStates.reduce((sum, p) => sum + p.cards.length, 0);

		DecksEngine.produce(entry, 0, completeRecipe('A', 0));

		const after =
			entry.gameState.decks.reduce((sum, deck) => sum + deck.length, 0) +
			entry.gameState.playersStates.reduce((sum, p) => sum + p.cards.length, 0);
		expect(after).toBe(before);
	});

	it('loses no card when the level above is out of stock (ADR-0017)', () => {
		const gameState = makeGameState();
		gameState.decks[1] = [];
		const entry = makeEntry(gameState);
		const deck0Before = gameState.decks[0].length;

		expect(() => DecksEngine.produce(entry, 0, completeRecipe('A', 0))).toThrow(
			'ERROR.NOT_ENOUGH_CARDS_IN_DECK'
		);

		expect(handOf(entry)).toHaveLength(4);
		expect(gameState.decks[0]).toHaveLength(deck0Before);
		expect(entry.events).toHaveLength(0);
		expect(gameState.playersStates[0].actionTokens).toBe(2);
	});

	it('refuses a recipe built from the same copy twice', () => {
		const entry = makeEntry();
		const duplicated = [card('A', 0, 1), card('A', 0, 1), card('A', 0, 2), card('A', 0, 3)];

		expect(() => DecksEngine.produce(entry, 0, duplicated)).toThrow('ERROR.CARDS_NOT_UNIQUE');
		expect(entry.events).toHaveLength(0);
	});

	it('refuses a hand that does not hold the whole recipe', () => {
		const gameState = makeGameState();
		gameState.playersStates[0].cards = completeRecipe('A', 0).slice(0, 3);
		const entry = makeEntry(gameState);

		expect(() => DecksEngine.produce(entry, 0, completeRecipe('A', 0))).toThrow('ERROR.NOT_ENOUGH_CARDS');
	});

	it('refuses copies of mixed weights', () => {
		const gameState = makeGameState();
		gameState.playersStates[0].cards = [card('A', 0, 1), card('A', 0, 2), card('A', 0, 3), card('A', 1, 1)];
		const entry = makeEntry(gameState);

		expect(() =>
			DecksEngine.produce(entry, 0, [card('A', 0, 1), card('A', 0, 2), card('A', 0, 3), card('A', 1, 1)])
		).toThrow('ERROR.CARDS_MUST_HAVE_SAME_WEIGHT');
	});

	it('still refuses to produce at the unimplemented top level', () => {
		const gameState = makeGameState();
		gameState.playersStates[0].cards = completeRecipe('A', 3);
		const entry = makeEntry(gameState);

		expect(() => DecksEngine.produce(entry, 0, completeRecipe('A', 3))).toThrow(/Technological change/);
	});

	it('refuses an unknown producer', () => {
		const entry = makeEntry();

		expect(() => DecksEngine.produce(entry, 99, completeRecipe('A', 0))).toThrow('ERROR.PLAYER_NOT_FOUND');
	});
});
