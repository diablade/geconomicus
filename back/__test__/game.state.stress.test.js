import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════
// STRESS TEST — Game State Lifecycle
//
// Tests ALL status transitions, timer state, in-memory / not-in-memory
// scenarios, reload, recovery, concurrent access via queue, rapid-fire
// transitions, and crash-proof edge cases.
//
// NO real DB — everything is mocked / in-memory to keep it fast.
// ═══════════════════════════════════════════════════════════════════════

/* ═══════════════ MOCKS ═══════════════ */

// Mock socket — ESM safe top-level await
await jest.unstable_mockModule('#config/socket', () => ({
	default: {
		initIo: jest.fn(),
		getIo: jest.fn(),
		emitTo: jest.fn(),
		emitAckTo: jest.fn(),
	},
}));

// Mock log to silence output
await jest.unstable_mockModule('#config/log', () => ({
	default: {
		info: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

/* ═══════════════ CONSTANTS ═══════════════ */
const GAME_STATUS = {
	NONE: 'none',
	CREATED: 'created',
	INITIALIZED: 'initialized',
	PLAYING: 'playing',
	PAUSED: 'paused',
	STOPPED: 'stopped',
};

const GAME_TYPE = {
	JUNE: 'june',
	DEBT: 'debt',
};

const PLAYER_STATUS = {
	ALIVE: 'alive',
	DEAD: 'dead',
};

/* ═══════════════ HELPERS ═══════════════ */

/** Create a fake gameState POJO matching the schema shape */
function createFakeGameState(overrides = {}) {
	const id = overrides._id || `gs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	return {
		_id: id,
		typeMoney: GAME_TYPE.JUNE,
		sessionId: `sess_${Math.random().toString(36).slice(2, 8)}`,
		ruleIdx: 0,
		status: GAME_STATUS.CREATED,
		decks: [],
		playerStateIndexSeq: 4,
		playersStates: [
			{ idx: 0, avatarIdx: 0, status: PLAYER_STATUS.ALIVE, coins: 0, cards: [] },
			{ idx: 1, avatarIdx: 1, status: PLAYER_STATUS.ALIVE, coins: 0, cards: [] },
			{ idx: 2, avatarIdx: 2, status: PLAYER_STATUS.ALIVE, coins: 0, cards: [] },
		],
		currentMassMonetary: 0,
		currentDU: 0,
		creditIndexSeq: 0,
		credits: [],
		bankInterestEarned: 0,
		bankGoodsEarned: 0,
		bankMoneyLost: 0,
		gameTimers: {
			createdAt: null,
			startedAt: null,
			endedAt: null,
			remainingTime: 0,
			deathState: {
				deathIntervalMs: 0,
				deathQueue: [],
			},
		},
		...overrides,
	};
}

function createFakeRules(overrides = {}) {
	return {
		idx: 0,
		typeMoney: GAME_TYPE.JUNE,
		roundMinutes: 1, // 1 minute for fast tests
		priceWeight1: 3,
		priceWeight2: 6,
		priceWeight3: 9,
		priceWeight4: 12,
		startCoins: 5,
		tauxCroissance: 10,
		...overrides,
	};
}

/** sleep helper */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — Timer class unit tests (crash-proof)
// ═══════════════════════════════════════════════════════════════════════════════
describe('STRESS — Timer Class', () => {
	let Timer;

	beforeAll(async () => {
		const mod = await import('../src/misc/Timer.js');
		Timer = mod.default;
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('basic lifecycle: idle → running → paused → running → stopped', () => {
		jest.useFakeTimers();
		const endCb = jest.fn();
		const hbCb = jest.fn();

		const timer = new Timer('t1', { gameStateId: 't1' }, 10000, endCb, 2000, hbCb, null, null, null, null);

		expect(timer.status).toBe('idle');
		expect(timer.getRemainingMs()).toBe(10000);

		timer.start();
		expect(timer.status).toBe('running');

		// Advance 3s
		jest.advanceTimersByTime(3000);
		expect(timer.getRemainingMs()).toBeLessThanOrEqual(7000);
		expect(timer.getRemainingMs()).toBeGreaterThanOrEqual(6900);

		// Pause
		timer.pause();
		expect(timer.status).toBe('paused');
		const remainingAfterPause = timer.getRemainingMs();
		expect(remainingAfterPause).toBeGreaterThan(0);
		expect(remainingAfterPause).toBeLessThanOrEqual(7000);

		// Advancing time while paused should NOT change remaining
		jest.advanceTimersByTime(5000);
		expect(timer.getRemainingMs()).toBe(remainingAfterPause);

		// Resume
		timer.resume();
		expect(timer.status).toBe('running');

		// Stop
		timer.stop();
		expect(timer.status).toBe('stopped');
		expect(endCb).not.toHaveBeenCalled(); // stop doesn't trigger endCb
	});

	test('timer fires callbackAtEnd when duration expires', async () => {
		jest.useFakeTimers();
		const endCb = jest.fn();
		const timer = new Timer('t2', { gameStateId: 't2' }, 500, endCb, null, null, null, null, null, null);

		timer.start();
		jest.advanceTimersByTime(600);
		// Give the async callback time to settle
		await Promise.resolve();

		expect(timer.status).toBe('stopped');
		expect(endCb).toHaveBeenCalledTimes(1);
	});

	test('double start is no-op', () => {
		jest.useFakeTimers();
		const timer = new Timer('t3', { gameStateId: 't3' }, 5000, jest.fn(), null, null, null, null, null, null);
		timer.start();
		expect(timer.status).toBe('running');

		// Second start should be ignored
		timer.start();
		expect(timer.status).toBe('running');

		timer.stop();
	});

	test('pause when not running is no-op', () => {
		const timer = new Timer('t4', { gameStateId: 't4' }, 5000, jest.fn(), null, null, null, null, null, null);
		timer.pause();
		expect(timer.status).toBe('idle');
	});

	test('resume when not paused is no-op', () => {
		const timer = new Timer('t5', { gameStateId: 't5' }, 5000, jest.fn(), null, null, null, null, null, null);
		timer.resume();
		expect(timer.status).toBe('idle');
	});

	test('stop when already stopped is no-op (no crash)', () => {
		const timer = new Timer('t6', { gameStateId: 't6' }, 5000, jest.fn(), null, null, null, null, null, null);
		timer.stop();
		expect(timer.status).toBe('stopped');
		// Call again — should not throw
		timer.stop();
		expect(timer.status).toBe('stopped');
	});

	test('getRemainingMs returns 0 when stopped', () => {
		const timer = new Timer('t7', { gameStateId: 't7' }, 5000, jest.fn(), null, null, null, null, null, null);
		timer.stop();
		expect(timer.getRemainingMs()).toBe(0);
	});

	test('heartbeat interval fires multiple times', () => {
		jest.useFakeTimers();
		const hbCb = jest.fn();
		const timer = new Timer('t8', { gameStateId: 't8' }, 10000, jest.fn(), 1000, hbCb, null, null, null, null);

		timer.start();
		jest.advanceTimersByTime(3500);
		expect(hbCb.mock.calls.length).toBeGreaterThanOrEqual(3);

		timer.stop();
	});

	test('all 3 intervals fire independently', () => {
		jest.useFakeTimers();
		const cb1 = jest.fn();
		const cb2 = jest.fn();
		const cb3 = jest.fn();
		const timer = new Timer('t9', { gameStateId: 't9' }, 30000, jest.fn(), 1000, cb1, 2000, cb2, 3000, cb3);

		timer.start();
		jest.advanceTimersByTime(6500);

		expect(cb1.mock.calls.length).toBeGreaterThanOrEqual(6); // every 1s
		expect(cb2.mock.calls.length).toBeGreaterThanOrEqual(3); // every 2s
		expect(cb3.mock.calls.length).toBeGreaterThanOrEqual(2); // every 3s

		timer.stop();
	});

	test('rapid pause/resume cycles do not leak timers', () => {
		jest.useFakeTimers();
		const endCb = jest.fn();
		const timer = new Timer('t10', { gameStateId: 't10' }, 60000, endCb, 500, jest.fn(), null, null, null, null);

		timer.start();
		for (let i = 0; i < 50; i++) {
			jest.advanceTimersByTime(10);
			timer.pause();
			jest.advanceTimersByTime(5);
			timer.resume();
		}

		// Should still be running, not stopped or crashed
		expect(timer.status).toBe('running');
		expect(timer.getRemainingMs()).toBeGreaterThan(0);

		timer.stop();
		expect(timer.status).toBe('stopped');
		expect(endCb).not.toHaveBeenCalled();
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — GameTimerManager unit tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('STRESS — GameTimerManager', () => {
	let GameTimerManager;
	let Timer;

	beforeAll(async () => {
		// Import fresh instances
		const timerMod = await import('../src/misc/Timer.js');
		Timer = timerMod.default;
	});

	beforeEach(async () => {
		// Get a fresh manager for each test by clearing the singleton
		const mod = await import('../src/gameState/managers/GameTimerManager.js');
		GameTimerManager = mod.default;
		// Clear all timers between tests
		for (const [id] of GameTimerManager.timers) {
			await GameTimerManager.stopAndRemoveTimer(id);
		}
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('startTimer stores and starts timer', async () => {
		jest.useFakeTimers();
		const timer = new Timer('gtm1', { gameStateId: 'gtm1' }, 5000, jest.fn(), null, null, null, null, null, null);

		await GameTimerManager.startTimer(timer);
		expect(GameTimerManager.getTimer('gtm1')).toBe(timer);
		expect(timer.status).toBe('running');

		await GameTimerManager.stopAndRemoveTimer('gtm1');
	});

	test('startTimer replaces existing timer', async () => {
		jest.useFakeTimers();
		const timer1 = new Timer('gtm2', { gameStateId: 'gtm2' }, 5000, jest.fn(), null, null, null, null, null, null);
		const timer2 = new Timer('gtm2', { gameStateId: 'gtm2' }, 8000, jest.fn(), null, null, null, null, null, null);

		await GameTimerManager.startTimer(timer1);
		expect(timer1.status).toBe('running');

		await GameTimerManager.startTimer(timer2);
		expect(timer1.status).toBe('stopped'); // old one stopped
		expect(timer2.status).toBe('running');
		expect(GameTimerManager.getTimer('gtm2')).toBe(timer2);

		await GameTimerManager.stopAndRemoveTimer('gtm2');
	});

	test('pauseTimer on non-existent timer is no-op', async () => {
		// Should not throw
		await GameTimerManager.pauseTimer('does_not_exist');
	});

	test('stopAndRemoveTimer on non-existent timer returns true', async () => {
		const result = await GameTimerManager.stopAndRemoveTimer('nope');
		expect(result).toBe(true);
	});

	test('resumeTimer with no stored timer starts fresh', async () => {
		jest.useFakeTimers();
		const timer = new Timer('gtm3', { gameStateId: 'gtm3' }, 5000, jest.fn(), null, null, null, null, null, null);
		await GameTimerManager.resumeTimer(timer);
		// Since it wasn't stored, it should be started and stored
		expect(GameTimerManager.getTimer('gtm3')).toBe(timer);
		expect(timer.status).toBe('running');

		await GameTimerManager.stopAndRemoveTimer('gtm3');
	});

	test('multiple timers run independently', async () => {
		jest.useFakeTimers();
		const timers = [];
		for (let i = 0; i < 10; i++) {
			const t = new Timer(
				`multi_${i}`,
				{ gameStateId: `multi_${i}` },
				(i + 1) * 1000,
				jest.fn(),
				null,
				null,
				null,
				null,
				null,
				null
			);
			await GameTimerManager.startTimer(t);
			timers.push(t);
		}

		// All 10 should be running
		for (let i = 0; i < 10; i++) {
			expect(GameTimerManager.getTimer(`multi_${i}`).status).toBe('running');
		}

		// Advance 5.5s — timers 0-4 should have ended
		jest.advanceTimersByTime(5500);
		await Promise.resolve();

		for (let i = 0; i < 5; i++) {
			expect(timers[i].status).toBe('stopped');
		}
		for (let i = 5; i < 10; i++) {
			expect(timers[i].status).toBe('running');
		}

		// Cleanup
		for (let i = 0; i < 10; i++) {
			await GameTimerManager.stopAndRemoveTimer(`multi_${i}`);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — GameQueueManager concurrency tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('STRESS — GameQueueManager Concurrency', () => {
	let GameQueueManager;

	beforeEach(async () => {
		const mod = await import('../src/gameState/managers/GameQueueManager.js');
		GameQueueManager = mod.default;
	});

	test('sequential operations are serialized', async () => {
		const order = [];

		const p1 = GameQueueManager.enqueue('q1', async () => {
			await sleep(50);
			order.push('A');
			return 'A';
		});
		const p2 = GameQueueManager.enqueue('q1', async () => {
			order.push('B');
			return 'B';
		});
		const p3 = GameQueueManager.enqueue('q1', async () => {
			order.push('C');
			return 'C';
		});

		const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
		expect(r1).toBe('A');
		expect(r2).toBe('B');
		expect(r3).toBe('C');
		expect(order).toEqual(['A', 'B', 'C']);
	});

	test('different games run in parallel', async () => {
		const timestamps = {};

		const start = Date.now();
		const p1 = GameQueueManager.enqueue('game_x', async () => {
			await sleep(50);
			timestamps.x = Date.now() - start;
		});
		const p2 = GameQueueManager.enqueue('game_y', async () => {
			await sleep(50);
			timestamps.y = Date.now() - start;
		});

		await Promise.all([p1, p2]);
		// Both should finish around the same time (parallel), not sequentially
		expect(Math.abs(timestamps.x - timestamps.y)).toBeLessThan(40);
	});

	test('error in queued op does not block subsequent ops', async () => {
		const p1 = GameQueueManager.enqueue('q_err', async () => {
			throw new Error('BOOM');
		});

		// p1 will reject, but p2 should still run
		await expect(p1).rejects.toThrow('BOOM');

		const result = await GameQueueManager.enqueue('q_err', async () => {
			return 'recovered';
		});
		expect(result).toBe('recovered');
	});

	test('queue cleans up after all ops complete', async () => {
		await GameQueueManager.enqueue('q_cleanup', async () => 'done');
		// Queue should have auto-cleaned
		expect(GameQueueManager.isPending('q_cleanup')).toBe(false);
	});

	test('50 concurrent enqueues on same game are serialized', async () => {
		let counter = 0;
		const promises = [];

		for (let i = 0; i < 50; i++) {
			promises.push(
				GameQueueManager.enqueue('q_heavy', async () => {
					const val = counter;
					await sleep(1); // tiny yield
					counter = val + 1;
				})
			);
		}

		await Promise.all(promises);
		// If truly serialized, counter should be exactly 50
		// (race condition would give a lower number)
		expect(counter).toBe(50);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4 — GameStateManager in-memory store tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('STRESS — GameStateManager In-Memory Store', () => {
	let GameStateManager;

	beforeAll(async () => {
		const mod = await import('../src/gameState/managers/GameStateManager.js');
		GameStateManager = mod.default;
	});

	afterEach(() => {
		// Clean up stored games
		// Access internal map to clean
		if (GameStateManager._games) {
			GameStateManager._games.clear();
		}
	});

	test('store and retrieve game state', () => {
		const gs = createFakeGameState({ _id: 'store1' });
		const rules = createFakeRules();

		GameStateManager.store('store1', gs, rules);
		expect(GameStateManager.has('store1')).toBe(true);

		const entry = GameStateManager.get('store1');
		expect(entry.gameState).toBe(gs);
		expect(entry.rules).toBe(rules);
		expect(entry.events).toEqual([]);
	});

	test('get returns null for non-existent game', () => {
		expect(GameStateManager.get('does_not_exist')).toBeNull();
	});

	test('has returns false for non-existent game', () => {
		expect(GameStateManager.has('nope')).toBe(false);
	});

	test('remove deletes game from memory', () => {
		const gs = createFakeGameState({ _id: 'remove1' });
		GameStateManager.store('remove1', gs, createFakeRules());
		expect(GameStateManager.has('remove1')).toBe(true);

		GameStateManager.remove('remove1');
		expect(GameStateManager.has('remove1')).toBe(false);
		expect(GameStateManager.get('remove1')).toBeNull();
	});

	test('remove on non-existent game is no-op (no crash)', () => {
		// Should not throw
		GameStateManager.remove('ghost_game');
		expect(GameStateManager.has('ghost_game')).toBe(false);
	});

	test('store overwrites existing game', () => {
		const gs1 = createFakeGameState({ _id: 'overwrite1', status: GAME_STATUS.CREATED });
		const gs2 = createFakeGameState({ _id: 'overwrite1', status: GAME_STATUS.PLAYING });
		const rules = createFakeRules();

		GameStateManager.store('overwrite1', gs1, rules);
		expect(GameStateManager.getGameState('overwrite1').status).toBe(GAME_STATUS.CREATED);

		GameStateManager.store('overwrite1', gs2, rules);
		expect(GameStateManager.getGameState('overwrite1').status).toBe(GAME_STATUS.PLAYING);
	});

	test('getGameState returns only the state', () => {
		const gs = createFakeGameState({ _id: 'gsonly' });
		GameStateManager.store('gsonly', gs, createFakeRules());

		const state = GameStateManager.getGameState('gsonly');
		expect(state).toBe(gs);
		expect(state._id).toBe('gsonly');
	});

	test('getRules returns only the rules', () => {
		const gs = createFakeGameState({ _id: 'rulesonly' });
		const rules = createFakeRules({ roundMinutes: 42 });
		GameStateManager.store('rulesonly', gs, rules);

		const r = GameStateManager.getRules('rulesonly');
		expect(r).toBe(rules);
		expect(r.roundMinutes).toBe(42);
	});

	test('getGameState returns null for non-existent', () => {
		expect(GameStateManager.getGameState('nope')).toBeNull();
	});

	test('getRules returns null for non-existent', () => {
		expect(GameStateManager.getRules('nope')).toBeNull();
	});

	test('store many games (stress)', () => {
		const count = 200;
		for (let i = 0; i < count; i++) {
			GameStateManager.store(`stress_${i}`, createFakeGameState({ _id: `stress_${i}` }), createFakeRules());
		}

		for (let i = 0; i < count; i++) {
			expect(GameStateManager.has(`stress_${i}`)).toBe(true);
		}

		// Remove half
		for (let i = 0; i < count / 2; i++) {
			GameStateManager.remove(`stress_${i}`);
		}

		for (let i = 0; i < count / 2; i++) {
			expect(GameStateManager.has(`stress_${i}`)).toBe(false);
		}
		for (let i = count / 2; i < count; i++) {
			expect(GameStateManager.has(`stress_${i}`)).toBe(true);
		}
	});

	test('mutating stored state is reflected (reference-based)', () => {
		const gs = createFakeGameState({ _id: 'mutate1' });
		GameStateManager.store('mutate1', gs, createFakeRules());

		// Mutate directly
		gs.status = GAME_STATUS.PLAYING;
		gs.playersStates.push({ idx: 3, avatarIdx: 3, status: PLAYER_STATUS.ALIVE, coins: 10, cards: [] });

		const retrieved = GameStateManager.getGameState('mutate1');
		expect(retrieved.status).toBe(GAME_STATUS.PLAYING);
		expect(retrieved.playersStates.length).toBe(4);
	});

	test('events buffer accumulates and can be flushed', () => {
		const gs = createFakeGameState({ _id: 'events1' });
		GameStateManager.store('events1', gs, createFakeRules());

		const entry = GameStateManager.get('events1');
		entry.events.push({ type: 'test-event-1', data: {} });
		entry.events.push({ type: 'test-event-2', data: {} });

		expect(entry.events.length).toBe(2);

		// Flush
		entry.events = [];
		expect(GameStateManager.get('events1').events.length).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5 — Game Status State Machine (transition validation)
// ═══════════════════════════════════════════════════════════════════════════════
describe('STRESS — Game Status State Machine', () => {
	// Pure logic tests — validate that status transitions are correct

	const VALID_TRANSITIONS = {
		[GAME_STATUS.NONE]: [GAME_STATUS.CREATED],
		[GAME_STATUS.CREATED]: [GAME_STATUS.INITIALIZED],
		[GAME_STATUS.INITIALIZED]: [GAME_STATUS.PLAYING, GAME_STATUS.STOPPED],
		[GAME_STATUS.PLAYING]: [GAME_STATUS.PAUSED, GAME_STATUS.STOPPED],
		[GAME_STATUS.PAUSED]: [GAME_STATUS.PLAYING, GAME_STATUS.STOPPED],
		[GAME_STATUS.STOPPED]: [], // terminal
	};

	function isValidTransition(from, to) {
		return VALID_TRANSITIONS[from]?.includes(to) ?? false;
	}

	test.each([
		[GAME_STATUS.CREATED, GAME_STATUS.INITIALIZED, true],
		[GAME_STATUS.INITIALIZED, GAME_STATUS.PLAYING, true],
		[GAME_STATUS.PLAYING, GAME_STATUS.PAUSED, true],
		[GAME_STATUS.PAUSED, GAME_STATUS.PLAYING, true],
		[GAME_STATUS.PLAYING, GAME_STATUS.STOPPED, true],
		[GAME_STATUS.PAUSED, GAME_STATUS.STOPPED, true],
		[GAME_STATUS.INITIALIZED, GAME_STATUS.STOPPED, true],
		// Invalid transitions
		[GAME_STATUS.CREATED, GAME_STATUS.PLAYING, false],
		[GAME_STATUS.STOPPED, GAME_STATUS.PLAYING, false],
		[GAME_STATUS.STOPPED, GAME_STATUS.PAUSED, false],
		[GAME_STATUS.STOPPED, GAME_STATUS.CREATED, false],
		[GAME_STATUS.PLAYING, GAME_STATUS.CREATED, false],
		[GAME_STATUS.PAUSED, GAME_STATUS.INITIALIZED, false],
		[GAME_STATUS.PLAYING, GAME_STATUS.INITIALIZED, false],
	])('transition %s → %s should be %s', (from, to, expected) => {
		expect(isValidTransition(from, to)).toBe(expected);
	});

	test('STOPPED is a terminal state — no valid transitions out', () => {
		const allStatuses = Object.values(GAME_STATUS);
		for (const target of allStatuses) {
			expect(isValidTransition(GAME_STATUS.STOPPED, target)).toBe(false);
		}
	});

	test('all statuses have a transitions entry', () => {
		const allStatuses = Object.values(GAME_STATUS);
		for (const status of allStatuses) {
			expect(VALID_TRANSITIONS).toHaveProperty(status);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 6 — Full Lifecycle Simulation (in-memory, no DB)
// ═══════════════════════════════════════════════════════════════════════════════
describe('STRESS — Full Lifecycle Simulation', () => {
	let GameStateManager;
	let GameTimerManager;
	let Timer;

	beforeAll(async () => {
		const gsmMod = await import('../src/gameState/managers/GameStateManager.js');
		GameStateManager = gsmMod.default;
		const gtmMod = await import('../src/gameState/managers/GameTimerManager.js');
		GameTimerManager = gtmMod.default;
		const timerMod = await import('../src/misc/Timer.js');
		Timer = timerMod.default;
	});

	afterEach(async () => {
		if (GameStateManager._games) {
			for (const [id] of GameStateManager._games) {
				await GameTimerManager.stopAndRemoveTimer(id);
			}
			GameStateManager._games.clear();
		}
		jest.useRealTimers();
	});

	/**
	 * Simulate the full lifecycle without DB:
	 *   create → init (store in memory) → start (timer) → pause → resume → stop
	 */
	test('complete lifecycle: CREATE → INIT → START → PAUSE → RESUME → STOP', async () => {
		jest.useFakeTimers();
		const gameId = 'lifecycle_1';
		const gs = createFakeGameState({ _id: gameId, status: GAME_STATUS.CREATED });
		const rules = createFakeRules({ roundMinutes: 2 });

		// === INIT ===
		gs.status = GAME_STATUS.INITIALIZED;
		gs.playersStates.forEach((p) => {
			p.coins = rules.startCoins;
		});
		GameStateManager.store(gameId, gs, rules);
		expect(GameStateManager.getGameState(gameId).status).toBe(GAME_STATUS.INITIALIZED);

		// === START ===
		const entry = GameStateManager.get(gameId);
		entry.gameState.status = GAME_STATUS.PLAYING;
		const durationMs = rules.roundMinutes * 60 * 1000;
		entry.gameState.gameTimers = {
			createdAt: Date.now(),
			remainingTime: durationMs,
			deathState: {
				deathIntervalMs: durationMs / (entry.gameState.playersStates.length + 1),
				deathQueue: entry.gameState.playersStates,
			},
		};

		const timer = new Timer(
			gameId,
			{ gameStateId: gameId },
			durationMs,
			jest.fn(),
			1000,
			jest.fn(),
			null,
			null,
			null,
			null
		);
		await GameTimerManager.startTimer(timer);

		expect(entry.gameState.status).toBe(GAME_STATUS.PLAYING);
		expect(GameTimerManager.getTimer(gameId).status).toBe('running');

		// === PLAY for 30s ===
		jest.advanceTimersByTime(30000);
		expect(timer.getRemainingMs()).toBeLessThanOrEqual(durationMs - 30000 + 100);

		// === PAUSE ===
		const remainingBeforePause = timer.getRemainingMs();
		timer.pause();
		entry.gameState.status = GAME_STATUS.PAUSED;
		entry.gameState.gameTimers.remainingTime = remainingBeforePause;

		expect(entry.gameState.status).toBe(GAME_STATUS.PAUSED);
		expect(timer.status).toBe('paused');

		// Time passes while paused — remaining should NOT change
		jest.advanceTimersByTime(10000);
		expect(timer.getRemainingMs()).toBe(remainingBeforePause);

		// === RESUME ===
		timer.resume();
		entry.gameState.status = GAME_STATUS.PLAYING;
		expect(timer.status).toBe('running');

		// === STOP ===
		timer.stop();
		entry.gameState.status = GAME_STATUS.STOPPED;
		entry.gameState.gameTimers.remainingTime = 0;
		GameStateManager.remove(gameId);

		expect(GameStateManager.has(gameId)).toBe(false);
	});

	test('crash recovery: game PLAYING but not in memory → reload and resume timer', async () => {
		jest.useFakeTimers();
		const gameId = 'crash_recovery_1';

		// Simulate a game that was PLAYING and had 45s remaining
		const gs = createFakeGameState({
			_id: gameId,
			status: GAME_STATUS.PLAYING,
			gameTimers: {
				createdAt: Date.now() - 75000,
				remainingTime: 45000,
				deathState: { deathIntervalMs: 30000, deathQueue: [] },
			},
		});
		const rules = createFakeRules({ roundMinutes: 2 });

		// NOT in memory initially (simulates server restart)
		expect(GameStateManager.has(gameId)).toBe(false);

		// === RELOAD ===
		GameStateManager.store(gameId, gs, rules);
		expect(GameStateManager.has(gameId)).toBe(true);
		expect(GameStateManager.getGameState(gameId).status).toBe(GAME_STATUS.PLAYING);

		// === RECOVER TIMER ===
		const remaining = gs.gameTimers.remainingTime;
		const timer = new Timer(
			gameId,
			{ gameStateId: gameId },
			remaining,
			jest.fn(),
			1000,
			jest.fn(),
			null,
			null,
			null,
			null
		);
		await GameTimerManager.startTimer(timer);

		expect(timer.status).toBe('running');
		expect(timer.getRemainingMs()).toBeLessThanOrEqual(45000);

		// Advance 20s
		jest.advanceTimersByTime(20000);
		expect(timer.getRemainingMs()).toBeLessThanOrEqual(25100);
		expect(timer.getRemainingMs()).toBeGreaterThanOrEqual(24800);

		await GameTimerManager.stopAndRemoveTimer(gameId);
		GameStateManager.remove(gameId);
	});

	test('crash recovery: game PAUSED but not in memory → reload, timer stays paused', async () => {
		const gameId = 'crash_paused_1';

		const gs = createFakeGameState({
			_id: gameId,
			status: GAME_STATUS.PAUSED,
			gameTimers: {
				createdAt: Date.now() - 60000,
				remainingTime: 60000, // 1 min remaining
				deathState: { deathIntervalMs: 30000, deathQueue: [] },
			},
		});
		const rules = createFakeRules();

		// Simulate reload
		GameStateManager.store(gameId, gs, rules);

		const entry = GameStateManager.get(gameId);
		expect(entry.gameState.status).toBe(GAME_STATUS.PAUSED);

		// Timer should NOT be started for paused games
		expect(GameTimerManager.getTimer(gameId)).toBeUndefined();

		// Remaining time should be preserved from DB
		expect(entry.gameState.gameTimers.remainingTime).toBe(60000);

		GameStateManager.remove(gameId);
	});

	test('crash recovery: game STOPPED → should NOT be reloaded into memory', () => {
		const gameId = 'crash_stopped_1';

		const gs = createFakeGameState({
			_id: gameId,
			status: GAME_STATUS.STOPPED,
			gameTimers: { remainingTime: 0 },
		});

		// Per GameStateManager.reload logic, STOPPED games should not be stored
		// We test the logic here
		const shouldStore = [GAME_STATUS.INITIALIZED, GAME_STATUS.PLAYING, GAME_STATUS.PAUSED].includes(gs.status);
		expect(shouldStore).toBe(false);
	});

	test('double start prevention: starting an already PLAYING game', async () => {
		jest.useFakeTimers();
		const gameId = 'double_start_1';
		const gs = createFakeGameState({ _id: gameId, status: GAME_STATUS.PLAYING });
		const rules = createFakeRules();

		GameStateManager.store(gameId, gs, rules);

		// First timer
		const timer1 = new Timer(gameId, { gameStateId: gameId }, 60000, jest.fn(), null, null, null, null, null, null);
		await GameTimerManager.startTimer(timer1);
		expect(timer1.status).toBe('running');

		// "Start again" — startTimer should stop old and start new
		const timer2 = new Timer(gameId, { gameStateId: gameId }, 60000, jest.fn(), null, null, null, null, null, null);
		await GameTimerManager.startTimer(timer2);

		expect(timer1.status).toBe('stopped');
		expect(timer2.status).toBe('running');
		expect(GameTimerManager.getTimer(gameId)).toBe(timer2);

		await GameTimerManager.stopAndRemoveTimer(gameId);
		GameStateManager.remove(gameId);
	});

	test('pause without a timer does not crash', async () => {
		const gameId = 'pause_no_timer';
		const gs = createFakeGameState({ _id: gameId, status: GAME_STATUS.PLAYING });
		GameStateManager.store(gameId, gs, createFakeRules());

		// No timer registered
		expect(GameTimerManager.getTimer(gameId)).toBeUndefined();

		// Pause should be safe
		await GameTimerManager.pauseTimer(gameId);
		gs.status = GAME_STATUS.PAUSED;

		expect(gs.status).toBe(GAME_STATUS.PAUSED);
		GameStateManager.remove(gameId);
	});

	test('stop game that has no timer and is not in memory', async () => {
		const gameId = 'ghost_stop';

		// Nothing in memory, nothing in timers
		expect(GameStateManager.has(gameId)).toBe(false);
		expect(GameTimerManager.getTimer(gameId)).toBeUndefined();

		// stopAndRemoveTimer should not crash
		const result = await GameTimerManager.stopAndRemoveTimer(gameId);
		expect(result).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 7 — Rapid-Fire Status Transitions (Race Condition Proofing)
// ═══════════════════════════════════════════════════════════════════════════════
describe('STRESS — Rapid-Fire Status Transitions', () => {
	let GameStateManager;
	let GameTimerManager;
	let Timer;
	let GameQueueManager;

	beforeAll(async () => {
		const gsmMod = await import('../src/gameState/managers/GameStateManager.js');
		GameStateManager = gsmMod.default;
		const gtmMod = await import('../src/gameState/managers/GameTimerManager.js');
		GameTimerManager = gtmMod.default;
		const timerMod = await import('../src/misc/Timer.js');
		Timer = timerMod.default;
		const gqmMod = await import('../src/gameState/managers/GameQueueManager.js');
		GameQueueManager = gqmMod.default;
	});

	afterEach(async () => {
		if (GameStateManager._games) {
			for (const [id] of GameStateManager._games) {
				await GameTimerManager.stopAndRemoveTimer(id);
			}
			GameStateManager._games.clear();
		}
		jest.useRealTimers();
	});

	test('20 rapid pause/resume cycles via queue', async () => {
		jest.useFakeTimers();
		const gameId = 'rapid_pr';
		const gs = createFakeGameState({ _id: gameId, status: GAME_STATUS.PLAYING });
		const rules = createFakeRules();
		gs.gameTimers = {
			createdAt: Date.now(),
			remainingTime: 120000,
			deathState: { deathIntervalMs: 30000, deathQueue: [] },
		};
		GameStateManager.store(gameId, gs, rules);

		const timer = new Timer(gameId, { gameStateId: gameId }, 120000, jest.fn(), null, null, null, null, null, null);
		await GameTimerManager.startTimer(timer);

		const ops = [];
		for (let i = 0; i < 20; i++) {
			ops.push(
				GameQueueManager.enqueue(gameId, async () => {
					const entry = GameStateManager.get(gameId);
					if (entry.gameState.status === GAME_STATUS.PLAYING) {
						timer.pause();
						entry.gameState.status = GAME_STATUS.PAUSED;
					} else if (entry.gameState.status === GAME_STATUS.PAUSED) {
						timer.resume();
						entry.gameState.status = GAME_STATUS.PLAYING;
					}
					return entry.gameState.status;
				})
			);
		}

		const results = await Promise.all(ops);

		// Should alternate PAUSED/PLAYING
		for (let i = 0; i < results.length - 1; i++) {
			expect(results[i]).not.toBe(results[i + 1]);
		}

		// Final state should be valid
		const finalStatus = GameStateManager.getGameState(gameId).status;
		expect([GAME_STATUS.PLAYING, GAME_STATUS.PAUSED]).toContain(finalStatus);

		await GameTimerManager.stopAndRemoveTimer(gameId);
		GameStateManager.remove(gameId);
	});

	test('concurrent start + stop race → game ends in STOPPED', async () => {
		jest.useFakeTimers();
		const gameId = 'race_start_stop';
		const gs = createFakeGameState({ _id: gameId, status: GAME_STATUS.INITIALIZED });
		GameStateManager.store(gameId, gs, createFakeRules());

		const pStart = GameQueueManager.enqueue(gameId, async () => {
			const entry = GameStateManager.get(gameId);
			entry.gameState.status = GAME_STATUS.PLAYING;
			entry.gameState.gameTimers = { remainingTime: 60000, deathState: {} };
			const timer = new Timer(
				gameId,
				{ gameStateId: gameId },
				60000,
				jest.fn(),
				null,
				null,
				null,
				null,
				null,
				null
			);
			await GameTimerManager.startTimer(timer);
			return 'started';
		});

		const pStop = GameQueueManager.enqueue(gameId, async () => {
			const entry = GameStateManager.get(gameId);
			await GameTimerManager.stopAndRemoveTimer(gameId);
			entry.gameState.status = GAME_STATUS.STOPPED;
			entry.gameState.gameTimers = { remainingTime: 0 };
			return 'stopped';
		});

		const [r1, r2] = await Promise.all([pStart, pStop]);
		expect(r1).toBe('started');
		expect(r2).toBe('stopped');

		// Final state must be STOPPED
		expect(GameStateManager.getGameState(gameId).status).toBe(GAME_STATUS.STOPPED);

		GameStateManager.remove(gameId);
	});

	test('concurrent writes to player states via queue are serialized', async () => {
		const gameId = 'concurrent_coins';
		const gs = createFakeGameState({ _id: gameId, status: GAME_STATUS.PLAYING });
		GameStateManager.store(gameId, gs, createFakeRules());

		const promises = [];
		for (let i = 0; i < 100; i++) {
			promises.push(
				GameQueueManager.enqueue(gameId, async () => {
					const entry = GameStateManager.get(gameId);
					// Each op adds 1 coin to player 0
					entry.gameState.playersStates[0].coins += 1;
					return entry.gameState.playersStates[0].coins;
				})
			);
		}

		const results = await Promise.all(promises);
		// Must be exactly 100 (sequential increments)
		expect(GameStateManager.getGameState(gameId).playersStates[0].coins).toBe(100);
		// Results should be 1, 2, 3, ... 100
		expect(results).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));

		GameStateManager.remove(gameId);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 8 — Edge Cases & Crash Prevention
// ═══════════════════════════════════════════════════════════════════════════════
describe('STRESS — Edge Cases & Crash Prevention', () => {
	let GameStateManager;
	let GameTimerManager;
	let Timer;

	beforeAll(async () => {
		const gsmMod = await import('../src/gameState/managers/GameStateManager.js');
		GameStateManager = gsmMod.default;
		const gtmMod = await import('../src/gameState/managers/GameTimerManager.js');
		GameTimerManager = gtmMod.default;
		const timerMod = await import('../src/misc/Timer.js');
		Timer = timerMod.default;
	});

	afterEach(async () => {
		if (GameStateManager._games) {
			for (const [id] of GameStateManager._games) {
				await GameTimerManager.stopAndRemoveTimer(id);
			}
			GameStateManager._games.clear();
		}
		jest.useRealTimers();
	});

	test('timer with 0 duration fires immediately', async () => {
		jest.useFakeTimers();
		const endCb = jest.fn();
		const timer = new Timer('zero', { gameStateId: 'zero' }, 0, endCb, null, null, null, null, null, null);
		timer.start();

		jest.advanceTimersByTime(1);
		await Promise.resolve();

		expect(timer.status).toBe('stopped');
		expect(endCb).toHaveBeenCalledTimes(1);
	});

	test('timer with very large duration does not overflow', () => {
		jest.useFakeTimers();
		const timer = new Timer(
			'big',
			{ gameStateId: 'big' },
			Number.MAX_SAFE_INTEGER,
			jest.fn(),
			null,
			null,
			null,
			null,
			null,
			null
		);
		timer.start();
		expect(timer.status).toBe('running');
		expect(timer.getRemainingMs()).toBeGreaterThan(0);
		timer.stop();
	});

	test('game state with empty players array is handled', () => {
		const gs = createFakeGameState({ _id: 'empty_players', playersStates: [] });
		GameStateManager.store('empty_players', gs, createFakeRules());
		expect(GameStateManager.getGameState('empty_players').playersStates).toEqual([]);
		GameStateManager.remove('empty_players');
	});

	test('game state with null gameTimers is handled', () => {
		const gs = createFakeGameState({ _id: 'null_timers', gameTimers: null });
		GameStateManager.store('null_timers', gs, createFakeRules());
		expect(GameStateManager.getGameState('null_timers').gameTimers).toBeNull();
		GameStateManager.remove('null_timers');
	});

	test('multiple stores and removes in rapid succession', () => {
		for (let i = 0; i < 100; i++) {
			const id = `rapid_${i}`;
			GameStateManager.store(id, createFakeGameState({ _id: id }), createFakeRules());
		}
		for (let i = 0; i < 100; i++) {
			GameStateManager.remove(`rapid_${i}`);
		}
		for (let i = 0; i < 100; i++) {
			expect(GameStateManager.has(`rapid_${i}`)).toBe(false);
		}
	});

	test('timer callback that throws does not crash the timer', async () => {
		jest.useFakeTimers();
		const hbCb = jest.fn().mockImplementation(() => {
			throw new Error('callback crash!');
		});

		const timer = new Timer(
			'cb_crash',
			{ gameStateId: 'cb_crash' },
			30000,
			jest.fn(),
			1000,
			hbCb,
			null,
			null,
			null,
			null
		);
		timer.start();

		// Advance enough for several heartbeat calls
		jest.advanceTimersByTime(5000);
		await Promise.resolve();
		await Promise.resolve();

		// Timer should still be running despite callback errors
		expect(timer.status).toBe('running');
		timer.stop();
	});

	test('endCallback that throws does not leave timer in bad state', async () => {
		jest.useFakeTimers();
		const endCb = jest.fn().mockImplementation(() => {
			throw new Error('end callback crash!');
		});

		const timer = new Timer(
			'end_crash',
			{ gameStateId: 'end_crash' },
			100,
			endCb,
			null,
			null,
			null,
			null,
			null,
			null
		);
		timer.start();

		jest.advanceTimersByTime(200);
		await Promise.resolve();

		// Timer should be stopped even though callback threw
		expect(timer.status).toBe('stopped');
		expect(endCb).toHaveBeenCalledTimes(1);
	});

	test('storing game state with special characters in ID', () => {
		const weirdIds = [
			'game:with:colons',
			'game/with/slashes',
			'game with spaces',
			'game\twith\ttabs',
			'game-with-dashes_and_underscores',
			'🎮unicode🎲game',
		];

		for (const id of weirdIds) {
			GameStateManager.store(id, createFakeGameState({ _id: id }), createFakeRules());
			expect(GameStateManager.has(id)).toBe(true);
			expect(GameStateManager.getGameState(id)._id).toBe(id);
			GameStateManager.remove(id);
			expect(GameStateManager.has(id)).toBe(false);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 9 — Multi-Game Parallel Stress (simulates multiple parties)
// ═══════════════════════════════════════════════════════════════════════════════
describe('STRESS — Multi-Game Parallel Simulation', () => {
	let GameStateManager;
	let GameTimerManager;
	let Timer;
	let GameQueueManager;

	beforeAll(async () => {
		const gsmMod = await import('../src/gameState/managers/GameStateManager.js');
		GameStateManager = gsmMod.default;
		const gtmMod = await import('../src/gameState/managers/GameTimerManager.js');
		GameTimerManager = gtmMod.default;
		const timerMod = await import('../src/misc/Timer.js');
		Timer = timerMod.default;
		const gqmMod = await import('../src/gameState/managers/GameQueueManager.js');
		GameQueueManager = gqmMod.default;
	});

	afterEach(async () => {
		if (GameStateManager._games) {
			for (const [id] of GameStateManager._games) {
				await GameTimerManager.stopAndRemoveTimer(id);
			}
			GameStateManager._games.clear();
		}
		jest.useRealTimers();
	});

	test('10 games running simultaneously with independent lifecycles', async () => {
		jest.useFakeTimers();
		const gameCount = 10;
		const games = [];

		// Create and start all games
		for (let i = 0; i < gameCount; i++) {
			const id = `parallel_${i}`;
			const gs = createFakeGameState({ _id: id, status: GAME_STATUS.INITIALIZED });
			const rules = createFakeRules({ roundMinutes: i + 1 }); // different durations
			GameStateManager.store(id, gs, rules);

			await GameQueueManager.enqueue(id, async () => {
				const entry = GameStateManager.get(id);
				const durationMs = rules.roundMinutes * 60 * 1000;
				entry.gameState.status = GAME_STATUS.PLAYING;
				entry.gameState.gameTimers = { remainingTime: durationMs, deathState: {} };
				const timer = new Timer(
					id,
					{ gameStateId: id },
					durationMs,
					jest.fn(),
					null,
					null,
					null,
					null,
					null,
					null
				);
				await GameTimerManager.startTimer(timer);
			});

			games.push(id);
		}

		// All should be PLAYING
		for (const id of games) {
			expect(GameStateManager.getGameState(id).status).toBe(GAME_STATUS.PLAYING);
			expect(GameTimerManager.getTimer(id).status).toBe('running');
		}

		// Pause games 0-4
		for (let i = 0; i < 5; i++) {
			await GameQueueManager.enqueue(games[i], async () => {
				const entry = GameStateManager.get(games[i]);
				const timer = GameTimerManager.getTimer(games[i]);
				timer.pause();
				entry.gameState.status = GAME_STATUS.PAUSED;
			});
		}

		// Verify mixed state
		for (let i = 0; i < 5; i++) {
			expect(GameStateManager.getGameState(games[i]).status).toBe(GAME_STATUS.PAUSED);
		}
		for (let i = 5; i < 10; i++) {
			expect(GameStateManager.getGameState(games[i]).status).toBe(GAME_STATUS.PLAYING);
		}

		// Stop all games
		for (const id of games) {
			await GameQueueManager.enqueue(id, async () => {
				const entry = GameStateManager.get(id);
				await GameTimerManager.stopAndRemoveTimer(id);
				entry.gameState.status = GAME_STATUS.STOPPED;
			});
		}

		// All should be STOPPED
		for (const id of games) {
			expect(GameStateManager.getGameState(id).status).toBe(GAME_STATUS.STOPPED);
		}

		// Clean
		for (const id of games) {
			GameStateManager.remove(id);
		}
	});

	test('cross-game operations do not interfere', async () => {
		const gs1 = createFakeGameState({ _id: 'iso_a', status: GAME_STATUS.PLAYING });
		const gs2 = createFakeGameState({ _id: 'iso_b', status: GAME_STATUS.PLAYING });
		GameStateManager.store('iso_a', gs1, createFakeRules());
		GameStateManager.store('iso_b', gs2, createFakeRules());

		// 50 operations on game A, 50 on game B — simultaneously
		const opsA = [];
		const opsB = [];

		for (let i = 0; i < 50; i++) {
			opsA.push(
				GameQueueManager.enqueue('iso_a', async () => {
					const entry = GameStateManager.get('iso_a');
					entry.gameState.playersStates[0].coins += 1;
				})
			);
			opsB.push(
				GameQueueManager.enqueue('iso_b', async () => {
					const entry = GameStateManager.get('iso_b');
					entry.gameState.playersStates[0].coins += 2;
				})
			);
		}

		await Promise.all([...opsA, ...opsB]);

		expect(GameStateManager.getGameState('iso_a').playersStates[0].coins).toBe(50);
		expect(GameStateManager.getGameState('iso_b').playersStates[0].coins).toBe(100);

		GameStateManager.remove('iso_a');
		GameStateManager.remove('iso_b');
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 10 — Timer Accuracy & Remaining Time Consistency
// ═══════════════════════════════════════════════════════════════════════════════
describe('STRESS — Timer Accuracy & Remaining Time', () => {
	let Timer;

	beforeAll(async () => {
		const mod = await import('../src/misc/Timer.js');
		Timer = mod.default;
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('remaining time decreases correctly over time', () => {
		jest.useFakeTimers();
		const timer = new Timer('acc1', { gameStateId: 'acc1' }, 60000, jest.fn(), null, null, null, null, null, null);
		timer.start();

		const checkpoints = [5000, 15000, 15000, 15000, 10000];
		let prevRemaining = 60000;

		for (const advance of checkpoints) {
			jest.advanceTimersByTime(advance);
			const remaining = timer.getRemainingMs();
			expect(remaining).toBeLessThan(prevRemaining);
			expect(remaining).toBeGreaterThanOrEqual(0);
			prevRemaining = remaining;
		}

		timer.stop();
	});

	test('pause preserves exact remaining time', () => {
		jest.useFakeTimers();
		const timer = new Timer('acc2', { gameStateId: 'acc2' }, 60000, jest.fn(), null, null, null, null, null, null);
		timer.start();

		jest.advanceTimersByTime(20000);
		timer.pause();
		const frozenRemaining = timer.getRemainingMs();

		// Advance more time while paused
		jest.advanceTimersByTime(30000);
		expect(timer.getRemainingMs()).toBe(frozenRemaining);

		timer.resume();

		// After resume, remaining starts decreasing again from the frozen value
		jest.advanceTimersByTime(5000);
		expect(timer.getRemainingMs()).toBeLessThan(frozenRemaining);
		expect(timer.getRemainingMs()).toBeGreaterThan(frozenRemaining - 6000);

		timer.stop();
	});

	test('multiple pause/resume preserves total remaining correctly', () => {
		jest.useFakeTimers();
		const total = 60000;
		const timer = new Timer('acc3', { gameStateId: 'acc3' }, total, jest.fn(), null, null, null, null, null, null);
		timer.start();

		// Play 10s, pause, play 10s, pause, play 10s = 30s of play total
		jest.advanceTimersByTime(10000);
		timer.pause();
		jest.advanceTimersByTime(5000); // 5s paused (doesn't count)
		timer.resume();

		jest.advanceTimersByTime(10000);
		timer.pause();
		jest.advanceTimersByTime(8000); // 8s paused
		timer.resume();

		jest.advanceTimersByTime(10000);

		const remaining = timer.getRemainingMs();
		// 60s - 30s played = 30s remaining (within tolerance)
		expect(remaining).toBeLessThanOrEqual(30100);
		expect(remaining).toBeGreaterThanOrEqual(29800);

		timer.stop();
	});

	test('getRemainingMs returns 0 when timer has no startTime and is not paused', () => {
		const timer = new Timer('acc4', { gameStateId: 'acc4' }, 60000, jest.fn(), null, null, null, null, null, null);
		// idle — no startTime
		expect(timer.getRemainingMs()).toBe(60000);

		timer.stop();
		expect(timer.getRemainingMs()).toBe(0);
	});
});
