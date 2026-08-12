import { jest } from '@jest/globals';
import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS, CREDIT_STATUS, LK_KEYS, isDeathEvent } from '@geco/shared';

await jest.unstable_mockModule('#config/log', () => ({
	default: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { default: PlayerEngine } = await import('../src/gameState/engine/player.engine.js');

/** A card of a given weight, priced 2^weight like the shipped ladder. */
const card = (key, weight = 0) => ({ key, letter: key[0], weight, price: 2 ** weight, color: 'red' });

/** A deck of `count` level-0 cards, enough to stay above the reincarnation reserve floor. */
const deck0 = (count = 20) => Array.from({ length: count }, (_, i) => card(`D${i}`, 0));

const makeLife = (idx, overrides = {}) => ({
	idx,
	avatarIdx: idx,
	status: PLAYER_STATUS.ALIVE,
	coins: 20,
	cards: [card(`A${idx}`), card(`B${idx}`)],
	actionTokens: 1,
	...overrides,
});

const makeGameState = (overrides = {}) => ({
	_id: 'game-001',
	sessionId: 'session-001',
	typeMoney: GAME_TYPE.JUNE,
	currentDU: 1,
	currentMassMonetary: 100,
	bankInterestEarned: 0,
	bankMoneyDestroyed: 0,
	bankMoneyLost: 0,
	bankGoodsEarned: 0,
	credits: [],
	playerStateIndexSeq: 2,
	decks: [deck0(), [], [], []],
	gameTimers: { deathState: { deathQueue: [0, 1] } },
	playersStates: [makeLife(0), makeLife(1)],
	...overrides,
});

const makeEntry = (gameState = makeGameState(), rules = {}) => ({
	gameState,
	rules: { amountCardsForProd: 4, distribInitCards: 4, startingTokens: 1, durationCredit: 5, ...rules },
	events: [],
});

const makeCredit = (playerStateIdx, overrides = {}) => ({
	id: `credit-${playerStateIdx}`,
	amount: 5,
	interest: 2,
	playerStateIdx,
	status: CREDIT_STATUS.RUNNING,
	...overrides,
});

describe('PlayerEngine — applyTransaction', () => {
	it('moves the card one way and the coins the other', () => {
		const entry = makeEntry();
		const cardKey = entry.gameState.playersStates[1].cards[0].key;

		const result = PlayerEngine.applyTransaction(entry, 0, 1, cardKey);

		expect(result.cost).toBe(1);
		expect(entry.gameState.playersStates[0].coins).toBe(19);
		expect(entry.gameState.playersStates[1].coins).toBe(21);
		expect(entry.gameState.playersStates[0].cards.map((c) => c.key)).toContain(cardKey);
		expect(entry.gameState.playersStates[1].cards.map((c) => c.key)).not.toContain(cardKey);
	});

	it('records exactly one transaction event carrying both Lives', () => {
		const entry = makeEntry();
		const cardKey = entry.gameState.playersStates[1].cards[0].key;

		PlayerEngine.applyTransaction(entry, 0, 1, cardKey);

		expect(entry.events).toHaveLength(1);
		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.TRANSACTION);
		expect(Object.keys(entry.events[0].payload[LK_KEYS.PLAYERS])).toEqual(['0', '1']);
	});

	it('scales the June price with the DU', () => {
		const gameState = makeGameState({ currentDU: 3.5 });
		const entry = makeEntry(gameState);
		const cardKey = gameState.playersStates[1].cards[0].key;

		const result = PlayerEngine.applyTransaction(entry, 0, 1, cardKey);

		expect(result.cost).toBe(3.5);
		expect(gameState.playersStates[0].coins).toBe(16.5);
	});

	it('uses the absolute price in the debt game', () => {
		const gameState = makeGameState({ typeMoney: GAME_TYPE.DEBT, currentDU: 3.5 });
		const entry = makeEntry(gameState);
		const cardKey = gameState.playersStates[1].cards[0].key;

		expect(PlayerEngine.applyTransaction(entry, 0, 1, cardKey).cost).toBe(1);
	});

	it('refuses a buyer who cannot afford the card, leaving nothing changed', () => {
		const gameState = makeGameState();
		gameState.playersStates[0].coins = 0;
		const entry = makeEntry(gameState);
		const cardKey = gameState.playersStates[1].cards[0].key;

		expect(() => PlayerEngine.applyTransaction(entry, 0, 1, cardKey)).toThrow('ERROR.NOT_ENOUGH_COINS');
		expect(gameState.playersStates[1].cards.map((c) => c.key)).toContain(cardKey);
		expect(entry.events).toHaveLength(0);
	});

	it('refuses a transaction involving a Life that is not alive', () => {
		const gameState = makeGameState();
		gameState.playersStates[1].status = PLAYER_STATUS.PRISON;
		const entry = makeEntry(gameState);
		const cardKey = gameState.playersStates[1].cards[0].key;

		expect(() => PlayerEngine.applyTransaction(entry, 0, 1, cardKey)).toThrow(
			'ERROR.TRANSACTION_CANNOT_INVOLVE_DEAD_OR_PRISONER'
		);
	});
});

describe('PlayerEngine — endLife records one event, typed by effect (ADR-0016)', () => {
	it('emits the plain death event for a June Life', () => {
		const entry = makeEntry();

		PlayerEngine.endLife(entry, entry.gameState.playersStates[0]);

		expect(entry.events).toHaveLength(1);
		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.PLAYER_DIED);
	});

	it('emits the plain death event for a debt Life that owed nothing', () => {
		const gameState = makeGameState({ typeMoney: GAME_TYPE.DEBT, credits: [] });
		const entry = makeEntry(gameState);

		PlayerEngine.endLife(entry, gameState.playersStates[0]);

		expect(entry.events).toHaveLength(1);
		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.PLAYER_DIED);
	});

	it('emits the seizure death event when the claw-back actually moved something', () => {
		const gameState = makeGameState({ typeMoney: GAME_TYPE.DEBT, credits: [makeCredit(0)] });
		const entry = makeEntry(gameState);

		PlayerEngine.endLife(entry, gameState.playersStates[0]);

		expect(entry.events).toHaveLength(1);
		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.PLAYER_DIED_WITH_SEIZURE);
	});

	it('declares the mass and the four bank counters only on the seizure form', () => {
		const gameState = makeGameState({ typeMoney: GAME_TYPE.DEBT, credits: [makeCredit(0)] });
		const entry = makeEntry(gameState);

		PlayerEngine.endLife(entry, gameState.playersStates[0]);
		const payload = entry.events[0].payload;

		expect(payload[LK_KEYS.MASS_MONETARY]).toBe(93);
		expect(payload[LK_KEYS.BANK_INTEREST_EARNED]).toBe(2);
		expect(payload[LK_KEYS.BANK_MONEY_DESTROYED]).toBe(5);
		expect(payload[LK_KEYS.BANK_GOODS_EARNED]).toBe(0);
		expect(payload[LK_KEYS.BANK_MONEY_LOST]).toBe(0);
	});

	it('leaves no bank readings on a June death, since there is no bank', () => {
		const entry = makeEntry();

		PlayerEngine.endLife(entry, entry.gameState.playersStates[0]);
		const payload = entry.events[0].payload;

		expect(payload[LK_KEYS.BANK_INTEREST_EARNED]).toBeUndefined();
		expect(payload[LK_KEYS.MASS_MONETARY]).toBeUndefined();
	});

	it('both forms answer to the shared "a Life ended" test', () => {
		const june = makeEntry();
		PlayerEngine.endLife(june, june.gameState.playersStates[0]);

		const debtState = makeGameState({ typeMoney: GAME_TYPE.DEBT, credits: [makeCredit(0)] });
		const debt = makeEntry(debtState);
		PlayerEngine.endLife(debt, debtState.playersStates[0]);

		expect(isDeathEvent(june.events[0].typeEvent)).toBe(true);
		expect(isDeathEvent(debt.events[0].typeEvent)).toBe(true);
	});

	it('keeps the dead Life as a frozen snapshot while cloning its hand back into the decks', () => {
		const entry = makeEntry();
		const player = entry.gameState.playersStates[0];
		const deckSizeBefore = entry.gameState.decks[0].length;

		PlayerEngine.endLife(entry, player);

		expect(player.status).toBe(PLAYER_STATUS.DEAD);
		expect(player.coins).toBe(20);
		expect(player.cards).toHaveLength(2);
		expect(entry.gameState.decks[0].length).toBe(deckSizeBefore + 2);
	});

	it('reports that the Life was imprisoned so the caller can cancel its timer', () => {
		const gameState = makeGameState();
		gameState.playersStates[0].status = PLAYER_STATUS.PRISON;
		const entry = makeEntry(gameState);

		expect(PlayerEngine.endLife(entry, gameState.playersStates[0]).wasInPrison).toBe(true);
	});
});

describe('PlayerEngine — reincarnate', () => {
	it('ends the old Life and appends a fresh one for the same avatar', () => {
		const entry = makeEntry();

		const result = PlayerEngine.reincarnate(entry, 0);

		expect(result.oldPlayerStateIdx).toBe(0);
		expect(result.newPlayerStateIdx).toBe(2);
		expect(entry.gameState.playersStates).toHaveLength(3);
		expect(entry.gameState.playerStateIndexSeq).toBe(3);

		const newLife = entry.gameState.playersStates[2];
		expect(newLife.avatarIdx).toBe(0);
		expect(newLife.status).toBe(PLAYER_STATUS.ALIVE);
		expect(newLife.coins).toBe(0);
		expect(newLife.cards).toHaveLength(4);
	});

	it('records the death and the birth, in that order', () => {
		const entry = makeEntry();

		PlayerEngine.reincarnate(entry, 0);

		expect(entry.events.map((e) => e.typeEvent)).toEqual([DB_EVENTS.PLAYER_DIED, DB_EVENTS.PLAYER_BIRTH]);
	});

	it('is a no-op for an avatar with no living Life', () => {
		const entry = makeEntry();
		entry.gameState.playersStates[0].status = PLAYER_STATUS.DEAD;

		expect(PlayerEngine.reincarnate(entry, 0)).toBeNull();
		expect(entry.events).toHaveLength(0);
	});

	it('reincarnates an imprisoned Life and says so', () => {
		const gameState = makeGameState();
		gameState.playersStates[0].status = PLAYER_STATUS.PRISON;
		const entry = makeEntry(gameState);

		const result = PlayerEngine.reincarnate(entry, 0);

		expect(result.wasInPrison).toBe(true);
		expect(gameState.playersStates[2].status).toBe(PLAYER_STATUS.ALIVE);
	});
});

describe('PlayerEngine — forceDeath', () => {
	it('reincarnates a first death and drops the avatar from the death queue', () => {
		const entry = makeEntry();

		const result = PlayerEngine.forceDeath(entry, 0);

		expect(result.reincarnated).toBe(true);
		expect(entry.gameState.gameTimers.deathState.deathQueue).toEqual([1]);
	});

	it('is terminal once the avatar has already reincarnated', () => {
		const entry = makeEntry();
		PlayerEngine.forceDeath(entry, 0);
		entry.events.length = 0;

		const result = PlayerEngine.forceDeath(entry, 2);

		expect(result.reincarnated).toBe(false);
		expect(entry.gameState.playersStates).toHaveLength(3);
		expect(entry.gameState.playersStates[2].status).toBe(PLAYER_STATUS.DEAD);
		expect(entry.events.map((e) => e.typeEvent)).toEqual([DB_EVENTS.PLAYER_DIED]);
	});

	it('refuses to kill a Life that is already dead', () => {
		const entry = makeEntry();
		entry.gameState.playersStates[0].status = PLAYER_STATUS.DEAD;

		expect(() => PlayerEngine.forceDeath(entry, 0)).toThrow('ERROR.PLAYER_ALREADY_DEAD');
	});

	it('refuses a playerStateIdx that does not exist', () => {
		const entry = makeEntry();

		expect(() => PlayerEngine.forceDeath(entry, 99)).toThrow('ERROR.PLAYER_NOT_FOUND');
	});
});
