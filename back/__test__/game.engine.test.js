import { jest } from '@jest/globals';
import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS, PLAYER_TYPE, LK_KEYS } from '@geco/shared';

await jest.unstable_mockModule('#config/log', () => ({
	default: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { default: GameEngine } = await import('../src/gameState/engine/game.engine.js');

const life = (idx, overrides = {}) => ({
	idx,
	avatarIdx: idx,
	status: PLAYER_STATUS.ALIVE,
	coins: 100,
	cards: [],
	...overrides,
});

const makeGameState = (overrides = {}) => ({
	_id: 'game-001',
	sessionId: 'session-001',
	typeMoney: GAME_TYPE.JUNE,
	currentDU: 10,
	currentMassMonetary: 300,
	credits: [],
	decks: [[], [], [], []],
	playersStates: [life(0), life(1), life(2)],
	gameTimers: { deathState: { deathIntervalMs: 15000, intervalDeathLeft: 4000, deathQueue: [0, 1, 2] } },
	...overrides,
});

const makeEntry = (gameState = makeGameState(), rules = {}) => ({
	gameState,
	rules: { autoDeath: true, tauxCroissance: 10, ...rules },
	events: [],
});

describe('GameEngine — the scheduled death tick', () => {
	it('pops the next avatar due to die', () => {
		const entry = makeEntry();

		expect(GameEngine.popScheduledDeath(entry)).toBe(0);
		expect(entry.gameState.gameTimers.deathState.deathQueue).toEqual([1, 2]);
	});

	it('refreshes the time to the next death, so a crash-recovery resumes on a full interval', () => {
		const entry = makeEntry();

		GameEngine.popScheduledDeath(entry);

		expect(entry.gameState.gameTimers.deathState.intervalDeathLeft).toBe(15000);
	});

	it('pops nobody when autoDeath is off, leaving the queue untouched', () => {
		const entry = makeEntry(makeGameState(), { autoDeath: false });

		expect(GameEngine.popScheduledDeath(entry)).toBeNull();
		expect(entry.gameState.gameTimers.deathState.deathQueue).toEqual([0, 1, 2]);
	});

	it('pops nobody once everyone scheduled has died', () => {
		const gameState = makeGameState();
		gameState.gameTimers.deathState.deathQueue = [];

		expect(GameEngine.popScheduledDeath(makeEntry(gameState))).toBeNull();
	});

	it('pops nobody when the game has no death schedule at all', () => {
		const gameState = makeGameState({ gameTimers: {} });

		expect(GameEngine.popScheduledDeath(makeEntry(gameState))).toBeNull();
	});
});

describe('GameEngine — the universal dividend', () => {
	it('pays every living Life the same dividend', async () => {
		const entry = makeEntry();

		const { du, alive } = await GameEngine.distributeDU(entry);

		expect(du).toBe(10);
		expect(alive).toHaveLength(3);
		expect(entry.gameState.playersStates.map((p) => p.coins)).toEqual([110, 110, 110]);
	});

	it('grows the money mass by the whole tick', async () => {
		const entry = makeEntry();

		const { currentMassMonetary } = await GameEngine.distributeDU(entry);

		expect(currentMassMonetary).toBe(330);
		expect(entry.gameState.currentMassMonetary).toBe(330);
	});

	it('skips the dead, and prices the dividend off the living only', async () => {
		const gameState = makeGameState();
		gameState.playersStates[2].status = PLAYER_STATUS.DEAD;
		const entry = makeEntry(gameState);

		const { du, alive } = await GameEngine.distributeDU(entry);

		expect(alive.map((p) => p.idx)).toEqual([0, 1]);
		expect(du).toBe(15);
		expect(gameState.playersStates[2].coins).toBe(100);
	});

	it('records one event per recipient, never one for the tick', async () => {
		const entry = makeEntry();

		await GameEngine.distributeDU(entry);

		expect(entry.events).toHaveLength(3);
		expect(entry.events.every((e) => e.typeEvent === DB_EVENTS.DISTRIB_DU)).toBe(true);
		expect(entry.events.map((e) => e.receiver)).toEqual([0, 1, 2]);
		expect(entry.events.every((e) => e.emitter === PLAYER_TYPE.BANK)).toBe(true);
	});

	it('carries a rising partial sum of the mass, each row a true reading', async () => {
		const entry = makeEntry();

		await GameEngine.distributeDU(entry);

		expect(entry.events.map((e) => e.payload[LK_KEYS.MASS_MONETARY])).toEqual([310, 320, 330]);
	});

	it('pays a prisoner nothing, since only the living receive', async () => {
		const gameState = makeGameState();
		gameState.playersStates[1].status = PLAYER_STATUS.PRISON;
		const entry = makeEntry(gameState);

		const { alive } = await GameEngine.distributeDU(entry);

		expect(alive.map((p) => p.idx)).toEqual([0, 2]);
		expect(gameState.playersStates[1].coins).toBe(100);
	});

	it('knows which game type pays a dividend at all', () => {
		expect(GameEngine.paysDividend(makeGameState())).toBe(true);
		expect(GameEngine.paysDividend(makeGameState({ typeMoney: GAME_TYPE.DEBT }))).toBe(false);
	});
});
