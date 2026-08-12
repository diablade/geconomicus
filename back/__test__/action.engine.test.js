import { jest } from '@jest/globals';
import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS, LK_KEYS } from '@geco/shared';

await jest.unstable_mockModule('#config/log', () => ({
	default: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { default: ActionEngine } = await import('../src/gameState/engine/action.engine.js');

const card = (letter, copy, weight = 0) => ({
	key: `${letter}${weight}${copy}`,
	letter,
	weight,
	price: 2 ** weight,
	color: 'red',
});

const hand = (letter, count) => Array.from({ length: count }, (_, i) => card(letter, i + 1));

const life = (idx, overrides = {}) => ({
	idx,
	avatarIdx: idx,
	status: PLAYER_STATUS.ALIVE,
	coins: 10,
	cards: hand(String.fromCharCode(65 + idx), 4),
	actionTokens: 5,
	...overrides,
});

const ACTIONS = ['give', 'steal', 'silentSteal', 'association', 'war', 'ong', 'whoHaveCard'].map((key) => ({
	key,
	enabled: true,
	cost: 1,
}));

const makeGameState = (overrides = {}) => ({
	_id: 'game-001',
	sessionId: 'session-001',
	typeMoney: GAME_TYPE.JUNE,
	currentDU: 1,
	currentMassMonetary: 100,
	credits: [],
	decks: [[card('Z', 1)], [], [], []],
	playersStates: [life(0), life(1), life(2)],
	...overrides,
});

const makeEntry = (gameState = makeGameState(), actions = ACTIONS) => ({
	gameState,
	rules: { actions, amountCardsForProd: 4 },
	events: [],
});

const keysOf = (player) => player.cards.map((c) => c.key);

describe('ActionEngine — give', () => {
	it('moves the card and charges the giver a token', () => {
		const entry = makeEntry();
		const cardKey = entry.gameState.playersStates[0].cards[0].key;

		const { giver, receiver } = ActionEngine.give(entry, 0, 1, cardKey);

		expect(keysOf(giver)).not.toContain(cardKey);
		expect(keysOf(receiver)).toContain(cardKey);
		expect(giver.actionTokens).toBe(4);
	});

	it('records one give event naming both sides', () => {
		const entry = makeEntry();
		ActionEngine.give(entry, 0, 1, entry.gameState.playersStates[0].cards[0].key);

		expect(entry.events).toHaveLength(1);
		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.ACTION_GIVE);
		expect(Object.keys(entry.events[0].payload[LK_KEYS.PLAYERS])).toEqual(['0', '1']);
	});

	it('refuses a giver who cannot pay the cost, changing nothing', () => {
		const gameState = makeGameState();
		gameState.playersStates[0].actionTokens = 0;
		const entry = makeEntry(gameState);
		const cardKey = gameState.playersStates[0].cards[0].key;

		expect(() => ActionEngine.give(entry, 0, 1, cardKey)).toThrow('ERROR.NOT_ENOUGH_TOKENS');
		expect(keysOf(gameState.playersStates[0])).toContain(cardKey);
		expect(entry.events).toHaveLength(0);
	});

	it('refuses an action the game has switched off', () => {
		const entry = makeEntry(makeGameState(), [{ key: 'give', enabled: false, cost: 1 }]);

		expect(() => ActionEngine.give(entry, 0, 1, 'A01')).toThrow('ERROR.ACTION_DISABLED');
	});

	it('refuses an action the game does not configure at all', () => {
		const entry = makeEntry(makeGameState(), []);

		expect(() => ActionEngine.give(entry, 0, 1, 'A01')).toThrow('ERROR.ACTION_NOT_FOUND');
	});

	it('refuses a target who is not alive', () => {
		const gameState = makeGameState();
		gameState.playersStates[1].status = PLAYER_STATUS.PRISON;
		const entry = makeEntry(gameState);

		expect(() => ActionEngine.give(entry, 0, 1, gameState.playersStates[0].cards[0].key)).toThrow(
			'ERROR.TARGET_NOT_FOUND'
		);
	});

	it('refuses a card the giver does not hold', () => {
		const entry = makeEntry();

		expect(() => ActionEngine.give(entry, 0, 1, 'NOPE')).toThrow('ERROR.CARD_NOT_FOUND');
	});
});

describe('ActionEngine — steal and silentSteal', () => {
	it('takes the named card from the victim', () => {
		const entry = makeEntry();
		const cardKey = entry.gameState.playersStates[1].cards[0].key;

		const { stealer, victim } = ActionEngine.steal(entry, 0, 1, cardKey);

		expect(keysOf(stealer)).toContain(cardKey);
		expect(keysOf(victim)).not.toContain(cardKey);
		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.ACTION_STEAL);
	});

	it('records the silent variant under its own type', () => {
		const entry = makeEntry();
		ActionEngine.silentSteal(entry, 0, 1, entry.gameState.playersStates[1].cards[0].key);

		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.ACTION_SILENT_STEAL);
	});
});

describe('ActionEngine — association', () => {
	it('gives one card to each of two targets', () => {
		const entry = makeEntry();
		const [c1, c2] = entry.gameState.playersStates[0].cards;

		const { giver, targets } = ActionEngine.association(entry, 0, [c1.key, c2.key], [1, 2]);

		expect(keysOf(giver)).toHaveLength(2);
		expect(keysOf(targets[0])).toContain(c1.key);
		expect(keysOf(targets[1])).toContain(c2.key);
	});

	it('names every touched Life, since the targets are neither emitter nor receiver', () => {
		const entry = makeEntry();
		const [c1, c2] = entry.gameState.playersStates[0].cards;

		ActionEngine.association(entry, 0, [c1.key, c2.key], [1, 2]);

		expect(Object.keys(entry.events[0].payload[LK_KEYS.PLAYERS])).toEqual(['0', '1', '2']);
	});

	it('refuses two cards to the same target', () => {
		const entry = makeEntry();
		const [c1, c2] = entry.gameState.playersStates[0].cards;

		expect(() => ActionEngine.association(entry, 0, [c1.key, c2.key], [1, 1])).toThrow(
			'ERROR.TARGETS_MUST_BE_DIFFERENT'
		);
	});

	it('refuses anything other than two cards', () => {
		const entry = makeEntry();

		expect(() => ActionEngine.association(entry, 0, ['A01'], [1, 2])).toThrow(
			'ERROR.ASSOCIATION_REQUIRES_2_CARDS'
		);
	});
});

describe('ActionEngine — war', () => {
	it('takes two cards from each victim and gives them to the attacker', () => {
		const entry = makeEntry();

		const { attacker, victims } = ActionEngine.war(entry, 0, 1, 2);

		expect(attacker.cards).toHaveLength(8);
		expect(victims[0].cards).toHaveLength(2);
		expect(victims[1].cards).toHaveLength(2);
	});

	it('takes only what a thin hand holds', () => {
		const gameState = makeGameState();
		gameState.playersStates[1].cards = [card('B', 1)];
		const entry = makeEntry(gameState);

		const { attacker, victims } = ActionEngine.war(entry, 0, 1, 2);

		expect(victims[0].cards).toHaveLength(0);
		expect(attacker.cards).toHaveLength(7);
	});

	it('names all three touched Lives', () => {
		const entry = makeEntry();
		ActionEngine.war(entry, 0, 1, 2);

		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.ACTION_WAR);
		expect(Object.keys(entry.events[0].payload[LK_KEYS.PLAYERS])).toEqual(['0', '1', '2']);
	});

	it('refuses the same victim twice', () => {
		const entry = makeEntry();

		expect(() => ActionEngine.war(entry, 0, 1, 1)).toThrow('ERROR.TARGETS_MUST_BE_DIFFERENT');
	});
});

describe('ActionEngine — ong', () => {
	it('gives four cards away in pairs to two named targets', () => {
		const entry = makeEntry();
		const keys = entry.gameState.playersStates[0].cards.map((c) => c.key);

		const { giver, targets, batches } = ActionEngine.ong(entry, 0, keys, [1, 2]);

		expect(giver.cards).toHaveLength(0);
		expect(batches[0]).toHaveLength(2);
		expect(targets[0].cards).toHaveLength(6);
		expect(targets[1].cards).toHaveLength(6);
	});

	it('picks the two poorest when no targets are named', () => {
		const gameState = makeGameState();
		gameState.playersStates[1].coins = 0;
		gameState.playersStates[1].cards = [];
		gameState.playersStates[2].coins = 500;
		gameState.playersStates.push(life(3, { coins: 1, cards: [] }));
		const entry = makeEntry(gameState);
		const keys = gameState.playersStates[0].cards.map((c) => c.key);

		const { targets } = ActionEngine.ong(entry, 0, keys, null);

		expect(targets.map((t) => t.idx).sort()).toEqual([1, 3]);
	});

	it('refuses anything other than four cards', () => {
		const entry = makeEntry();

		expect(() => ActionEngine.ong(entry, 0, ['A01', 'A02'], [1, 2])).toThrow('ERROR.ONG_REQUIRES_4_CARDS');
	});
});

describe('ActionEngine — whoHaveCard', () => {
	it('names the avatar holding the family', () => {
		const entry = makeEntry();

		const answer = ActionEngine.whoHaveCard(entry, 0, 'B01');

		expect(answer.status).toBe('player');
		expect(answer.avatarIdx).toBe(1);
	});

	it('reports a family stranded in a deck', () => {
		const entry = makeEntry();

		expect(ActionEngine.whoHaveCard(entry, 0, 'Z01').status).toBe('deck');
	});

	it('reports a family that is nowhere', () => {
		const entry = makeEntry();

		expect(ActionEngine.whoHaveCard(entry, 0, 'Q01').status).toBe('unknown');
	});

	it('charges the token even when the chase is doomed', () => {
		const entry = makeEntry();

		const answer = ActionEngine.whoHaveCard(entry, 0, 'Q01');

		expect(answer.actionTokens).toBe(4);
		expect(entry.gameState.playersStates[0].actionTokens).toBe(4);
	});

	it('records no event', () => {
		const entry = makeEntry();
		ActionEngine.whoHaveCard(entry, 0, 'B01');

		expect(entry.events).toHaveLength(0);
	});
});

describe('ActionEngine — wealth ranking', () => {
	it('counts cards plus coins in the June game', () => {
		const gameState = makeGameState();
		expect(ActionEngine.wealthScore(gameState.playersStates[0], gameState.credits, GAME_TYPE.JUNE)).toBe(14);
	});

	it('subtracts outstanding debt in the debt game', () => {
		const gameState = makeGameState({
			typeMoney: GAME_TYPE.DEBT,
			credits: [{ playerStateIdx: 0, amount: 6, interest: 2 }],
		});

		expect(ActionEngine.wealthScore(gameState.playersStates[0], gameState.credits, GAME_TYPE.DEBT)).toBe(8);
	});

	it('never ranks the actor among the poorest', () => {
		const gameState = makeGameState();
		gameState.playersStates[0].coins = 0;
		gameState.playersStates[0].cards = [];

		expect(ActionEngine.twoPoorestPlayers(gameState, 0).map((p) => p.idx)).not.toContain(0);
	});
});
