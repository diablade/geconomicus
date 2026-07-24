import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════
// Reincarnation — service-level tests (in-memory, mocked socket/log).
// Covers: appended-life model, snapshot untouched, ghost money persists,
// deck return + reserve-floor/level-1 substitution, Force Death semantics.
// ═══════════════════════════════════════════════════════════════════════

// Mirror the REAL SocketManager surface (emitTo/emitAckTo) — NO `.to()`, so any
// `socket.to(...).emit(...)` misuse throws and fails the test instead of silently passing.
await jest.unstable_mockModule('#config/socket', () => ({
	default: {
		initIo: jest.fn(),
		getIo: jest.fn(),
		emitTo: jest.fn(),
		emitAckTo: jest.fn(),
		broadcastTo: jest.fn(),
	},
}));
await jest.unstable_mockModule('#config/log', () => ({
	default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { default: GameStateManager } = await import('../src/gameState/managers/GameStateManager.js');
const { default: PlayerStateService } = await import('../src/gameState/services/player.state.service.js');
const { PLAYER_STATUS, GAME_TYPE } = await import('@geco/shared');

/* ═══════════════ HELPERS ═══════════════ */

let seq = 0;
const card = (weight, priceByWeight = [1, 2, 4, 8]) => {
	const n = seq++;
	return { key: `K${weight}_${n}`, letter: `L${n}`, color: 'red', weight, price: priceByWeight[weight] };
};
const deckOf = (weight, count) => Array.from({ length: count }, () => card(weight));

function makeGame(overrides = {}) {
	const id = `gs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const gameState = {
		_id: id,
		typeMoney: GAME_TYPE.JUNE,
		sessionId: `sess_${Math.random().toString(36).slice(2, 8)}`,
		ruleIdx: 0,
		status: 'playing',
		decks: [deckOf(0, 10), deckOf(1, 6), deckOf(2, 4), deckOf(3, 2)],
		playerStateIndexSeq: 3,
		playersStates: [
			{ idx: 0, avatarIdx: 0, status: PLAYER_STATUS.ALIVE, coins: 100, cards: [card(0), card(0)] },
			{ idx: 1, avatarIdx: 1, status: PLAYER_STATUS.ALIVE, coins: 50, cards: [card(0)] },
			{ idx: 2, avatarIdx: 2, status: PLAYER_STATUS.ALIVE, coins: 150, cards: [card(1)] },
		],
		currentMassMonetary: 300,
		currentDU: 10,
		creditIndexSeq: 0,
		credits: [],
		gameTimers: {
			remainingTime: 60000,
			deathState: { deathIntervalMs: 15000, intervalDeathLeft: 15000, deathQueue: [0, 1, 2] },
		},
		...overrides,
	};
	const rules = { idx: 0, typeMoney: gameState.typeMoney, startingTokens: 2, amountCardsForProd: 4, distribInitCards: 4 };
	GameStateManager.store(id, gameState, rules);
	return { id, gameState, rules };
}

afterEach(() => {
	jest.clearAllMocks();
});

/* ═══════════════ TESTS ═══════════════ */

describe('reincarnatePlayer (June)', () => {
	test('appends a new ALIVE life and freezes the old one as an untouched snapshot', async () => {
		const { id, gameState } = makeGame();
		const deadCardsBefore = gameState.playersStates[0].cards.map((c) => c.key);

		const result = await PlayerStateService.reincarnatePlayer(id, 0);

		const lives = gameState.playersStates.filter((p) => p.avatarIdx === 0);
		expect(lives).toHaveLength(2);

		const dead = lives.find((p) => p.status === PLAYER_STATUS.DEAD);
		const fresh = lives.find((p) => p.status === PLAYER_STATUS.ALIVE);

		// Old life is the frozen snapshot: coins + cards untouched.
		expect(dead.idx).toBe(0);
		expect(dead.coins).toBe(100);
		expect(dead.cards.map((c) => c.key)).toEqual(deadCardsBefore);

		// New life: fresh idx from the seq, coins 0, tokens reset, cards dealt.
		expect(fresh.idx).toBe(3);
		expect(fresh.coins).toBe(0);
		expect(fresh.actionTokens).toBe(2);
		expect(fresh.cards.length).toBe(4);
		expect(gameState.playerStateIndexSeq).toBe(4);
		expect(result).toEqual({ oldPlayerStateIdx: 0, newPlayerStateIdx: 3 });
	});

	test('ghost money persists — currentMassMonetary is not reduced by a June death', async () => {
		const { id, gameState } = makeGame();
		await PlayerStateService.reincarnatePlayer(id, 0);
		expect(gameState.currentMassMonetary).toBe(300);
		// Ghost money = sum of DEAD lives' coins
		const ghost = gameState.playersStates
			.filter((p) => p.status === PLAYER_STATUS.DEAD)
			.reduce((acc, p) => acc + p.coins, 0);
		expect(ghost).toBe(100);
	});

	test('returns the dead hand to the deck (clones) while the snapshot keeps its own copy', async () => {
		const { id, gameState } = makeGame();
		const deadKeys = gameState.playersStates[0].cards.map((c) => c.key);

		await PlayerStateService.reincarnatePlayer(id, 0);

		// Each returned card is back in the weight-0 pool — either still in the deck
		// or re-drawn into the new life's opening hand.
		const fresh = gameState.playersStates.find((p) => p.status === PLAYER_STATUS.ALIVE && p.avatarIdx === 0);
		const inCirculation = new Set([...gameState.decks[0], ...fresh.cards].map((c) => c.key));
		for (const k of deadKeys) expect(inCirculation.has(k)).toBe(true);

		// …and still present on the frozen snapshot (history untouched).
		const dead = gameState.playersStates.find((p) => p.idx === 0);
		expect(dead.cards.map((c) => c.key)).toEqual(deadKeys);
	});

	test('reincarnates a PRISON life too (death overrides imprisonment)', async () => {
		const { id, gameState } = makeGame();
		gameState.playersStates[0].status = PLAYER_STATUS.PRISON;

		await PlayerStateService.reincarnatePlayer(id, 0);

		const lives = gameState.playersStates.filter((p) => p.avatarIdx === 0);
		expect(lives.find((p) => p.idx === 0).status).toBe(PLAYER_STATUS.DEAD);
		expect(lives.find((p) => p.status === PLAYER_STATUS.ALIVE)).toBeTruthy();
	});
});

describe('reincarnation card draw — reserve floor + level-1 substitution', () => {
	test('keeps ≥4 in decks[0] and covers the shortfall with level-1 cards (2 units each)', async () => {
		// decks[0] has exactly 5 → only 1 can be drawn before the floor of 4.
		// Give the dying life only high-weight cards so nothing refills decks[0]/decks[1].
		const { id, gameState } = makeGame({
			decks: [deckOf(0, 5), deckOf(1, 6), deckOf(2, 4), deckOf(3, 2)],
			playersStates: [
				{ idx: 0, avatarIdx: 0, status: PLAYER_STATUS.ALIVE, coins: 100, cards: [card(2), card(3)] },
				{ idx: 1, avatarIdx: 1, status: PLAYER_STATUS.ALIVE, coins: 50, cards: [card(2)] },
				{ idx: 2, avatarIdx: 2, status: PLAYER_STATUS.ALIVE, coins: 150, cards: [card(3)] },
			],
		});

		await PlayerStateService.reincarnatePlayer(id, 0);

		const fresh = gameState.playersStates.find((p) => p.status === PLAYER_STATUS.ALIVE && p.avatarIdx === 0);
		const level0 = fresh.cards.filter((c) => c.weight === 0).length;
		const level1 = fresh.cards.filter((c) => c.weight === 1).length;
		// decks[0]=5, floor=4 → 1 level-0 drawn; remaining 3 units → ceil(3/2)=2 level-1.
		expect(level0).toBe(1);
		expect(level1).toBe(2);
		expect(level0 + level1 * 2).toBeGreaterThanOrEqual(4); // total endowment >= target in units
		expect(gameState.decks[0].length).toBeGreaterThanOrEqual(4); // reserve floor preserved
	});
});

describe('reincarnatePlayer (Debt) — seizure on death', () => {
	function makeDebtGame() {
		return makeGame({
			typeMoney: GAME_TYPE.DEBT,
			playersStates: [
				// coins (5) < debt (amount 10 + interest 2) → coins drained AND cards seized
				{ idx: 0, avatarIdx: 0, status: PLAYER_STATUS.ALIVE, coins: 5, cards: [card(0), card(1), card(2)] },
				{ idx: 1, avatarIdx: 1, status: PLAYER_STATUS.ALIVE, coins: 0, cards: [card(0)] },
			],
			credits: [
				{
					id: 'c1',
					amount: 10,
					interest: 2,
					playerStateIdx: 0,
					status: 'running',
					extended: 0,
					createdAt: new Date(),
					remainingTime: 1000,
				},
			],
			currentMassMonetary: 300,
		});
	}

	test('reincarnates through seizure without throwing (coins drained + cards seized)', async () => {
		const { id, gameState } = makeDebtGame();

		const result = await PlayerStateService.reincarnatePlayer(id, 0);

		// New life exists and old one is the dead snapshot.
		expect(result).toEqual({ oldPlayerStateIdx: 0, newPlayerStateIdx: 3 });
		const lives = gameState.playersStates.filter((p) => p.avatarIdx === 0);
		expect(lives.find((p) => p.idx === 0).status).toBe(PLAYER_STATUS.DEAD);
		const fresh = lives.find((p) => p.status === PLAYER_STATUS.ALIVE);
		expect(fresh.coins).toBe(0);
		expect(fresh.cards.length).toBeGreaterThan(0);

		// Credit resolved, coins seized removed from the mass (interest 2 + amount 3 = 5).
		expect(gameState.credits.find((c) => c.id === 'c1').status).toBe('credit-done');
		expect(gameState.currentMassMonetary).toBe(295);
	});
});

describe('Force Death (manual kill)', () => {
	test('first death: reincarnates, drops the avatar from the queue', async () => {
		const { id, gameState } = makeGame();

		const res = await PlayerStateService.forceDeath(id, 0); // idx 0 = avatar 0, first life

		expect(res.reincarnated).toBe(true);
		expect(gameState.gameTimers.deathState.deathQueue).not.toContain(0);
		expect(gameState.playersStates.filter((p) => p.avatarIdx === 0)).toHaveLength(2);
	});

	test('second death on an already-reincarnated avatar is terminal (no new life)', async () => {
		const { id, gameState } = makeGame();
		await PlayerStateService.reincarnatePlayer(id, 0); // avatar 0 now has lives idx 0 (dead) + 3 (alive)

		const res = await PlayerStateService.forceDeath(id, 3); // kill the second life

		expect(res.reincarnated).toBe(false);
		const lives = gameState.playersStates.filter((p) => p.avatarIdx === 0);
		expect(lives).toHaveLength(2); // no third life
		expect(lives.every((p) => p.status === PLAYER_STATUS.DEAD)).toBe(true);
	});
});
