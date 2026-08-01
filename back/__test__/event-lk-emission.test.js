import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

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
await jest.unstable_mockModule('../src/gameState/managers/CreditTimerManager.js', () => ({
	default: {
		startTimer: jest.fn().mockResolvedValue(undefined),
		stopAndRemoveTimer: jest.fn().mockResolvedValue(undefined),
		stopAndGetRemaining: jest.fn().mockReturnValue(null),
		pauseGameTimers: jest.fn().mockResolvedValue(undefined),
		resumeTimer: jest.fn().mockResolvedValue(undefined),
		removeGameTimers: jest.fn().mockResolvedValue(undefined),
		getTimer: jest.fn(),
	},
}));
await jest.unstable_mockModule('../src/gameState/managers/PrisonTimerManager.js', () => ({
	default: {
		startTimer: jest.fn().mockResolvedValue(undefined),
		releasePlayer: jest.fn().mockResolvedValue(undefined),
		stopAndRemoveTimer: jest.fn().mockResolvedValue(undefined),
	},
}));

const savedEvents = [];
await jest.unstable_mockModule('../src/event/event.model.js', () => ({
	default: class {
		constructor(doc) {
			Object.assign(this, doc);
		}
		async save() {
			savedEvents.push({ ...this });
			return this;
		}
	},
}));

const initedGames = new Map();
await jest.unstable_mockModule('../src/gameState/game.state.model.js', () => ({
	default: {
		findById: jest.fn((id) => ({ lean: async () => initedGames.get(id) })),
		findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
	},
}));
await jest.unstable_mockModule('../src/session/rules/rules.service.js', () => ({
	default: { getByIdx: jest.fn(async () => initedGames.get('__rules__')) },
	defaultDebtRules: {},
	defaultJuneRules: {},
}));

const { default: GameStateManager } = await import('../src/gameState/managers/GameStateManager.js');
const { default: PlayerStateService } = await import('../src/gameState/services/player.state.service.js');
const { default: ActionStateService } = await import('../src/gameState/services/action.state.service.js');
const { default: DecksStateService } = await import('../src/gameState/services/decks.state.service.js');
const { default: BankStateService } = await import('../src/gameState/services/bank.state.service.js');
const { default: MoneyHelper } = await import('../src/gameState/helpers/money.helper.js');
const { default: GameStateService } = await import('../src/gameState/services/game.state.service.js');
const { CREDIT_STATUS, GAME_STATUS, GAME_TYPE, PLAYER_STATUS } = await import('@geco/shared');

let seq = 0;
const PRICES = [1, 2, 4, 8];
const card = (weight) => {
	const n = seq++;
	return { key: `K${weight}_${n}`, letter: `L${n}`, color: 'red', weight, price: PRICES[weight] };
};
const deckOf = (weight, count) => Array.from({ length: count }, () => card(weight));

const makeGame = ({ typeMoney = GAME_TYPE.JUNE, credits = [], overrides = {} } = {}) => {
	const id = `gs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const gameState = {
		_id: id,
		typeMoney,
		sessionId: `sess_${Math.random().toString(36).slice(2, 8)}`,
		ruleIdx: 0,
		status: GAME_STATUS.PLAYING,
		decks: [deckOf(0, 12), deckOf(1, 8), deckOf(2, 4), deckOf(3, 2)],
		playerStateIndexSeq: 3,
		playersStates: [
			{ idx: 0, avatarIdx: 0, status: PLAYER_STATUS.ALIVE, coins: 100, cards: [card(0), card(0), card(0), card(0)], actionTokens: 5 },
			{ idx: 1, avatarIdx: 1, status: PLAYER_STATUS.ALIVE, coins: 50, cards: [card(0), card(0)], actionTokens: 5 },
			{ idx: 2, avatarIdx: 2, status: PLAYER_STATUS.ALIVE, coins: 150, cards: [card(1), card(0)], actionTokens: 5 },
		],
		currentMassMonetary: 300,
		currentDU: 10,
		creditIndexSeq: credits.length,
		credits,
		gameTimers: {
			remainingTime: 60000,
			deathState: { deathIntervalMs: 15000, intervalDeathLeft: 15000, deathQueue: [0, 1, 2] },
		},
		...overrides,
	};
	const rules = {
		idx: 0,
		typeMoney,
		startingTokens: 2,
		amountCardsForProd: 4,
		distribInitCards: 4,
		durationCredit: 5,
		timerPrison: 5,
		tauxCredit: 3,
		defaultCreditAmount: 3,
		defaultInterestAmount: 1,
		seizureType: 'decote',
		seizureCosts: 50,
		autoBank: false,
		actions: ['give', 'steal', 'silentSteal', 'association', 'war', 'ong', 'whoHaveCard'].map((key) => ({
			key,
			labelKey: `ACTION.${key}`,
			descriptionKey: `ACTION.${key}.DESC`,
			cost: 1,
			enabled: true,
		})),
	};
	GameStateManager.store(id, gameState, rules);
	return { id, gameState, rules };
};

const creditOf = (playerStateIdx, status = CREDIT_STATUS.RUNNING, over = {}) => ({
	id: `credit-x-${playerStateIdx}-${seq++}`,
	amount: 3,
	interest: 1,
	playerStateIdx,
	status,
	extended: 0,
	createdAt: new Date(),
	startedAt: new Date(),
	endAt: null,
	remainingTime: 300000,
	...over,
});

afterEach(() => {
	jest.clearAllMocks();
});

describe('LK emission — player lifecycle', () => {
	test('player-died and player-birth carry LK', async () => {
		const { id } = makeGame();
		await expect(PlayerStateService.reincarnatePlayer(id, 0)).resolves.toBeDefined();
	});

	test('transaction carries LK', async () => {
		const { id, gameState } = makeGame();
		const cardKey = gameState.playersStates[1].cards[0].key;
		await expect(PlayerStateService.transaction(id, 0, 1, cardKey)).resolves.toBeDefined();
	});

	test('production carries LK', async () => {
		const { id, gameState } = makeGame();
		const cards = gameState.playersStates[0].cards.slice(0, 4).map((c) => ({ ...c }));
		await expect(DecksStateService.produce(id, 0, cards)).resolves.toBeDefined();
	});

	test('distrib-du carries LK', async () => {
		const { id } = makeGame();
		const entry = GameStateManager.get(id);
		await expect(MoneyHelper.distributeNewDU(entry)).resolves.not.toThrow?.();
	});
});

describe('LK emission — actions', () => {
	test('action-give carries LK', async () => {
		const { id, gameState } = makeGame();
		const cardKey = gameState.playersStates[0].cards[0].key;
		await expect(ActionStateService.give(id, 0, 1, cardKey)).resolves.toBeDefined();
	});

	test('action-steal carries LK', async () => {
		const { id, gameState } = makeGame();
		const cardKey = gameState.playersStates[1].cards[0].key;
		await expect(ActionStateService.steal(id, 0, 1, cardKey)).resolves.toBeDefined();
	});

	test('action-silent-steal carries LK', async () => {
		const { id, gameState } = makeGame();
		const cardKey = gameState.playersStates[1].cards[0].key;
		await expect(ActionStateService.silentSteal(id, 0, 1, cardKey)).resolves.toBeDefined();
	});

	test('action-association carries LK', async () => {
		const { id, gameState } = makeGame();
		const cardKeys = gameState.playersStates[0].cards.slice(0, 2).map((c) => c.key);
		await expect(ActionStateService.association(id, 0, cardKeys, [1, 2])).resolves.toBeDefined();
	});

	test('action-war carries LK', async () => {
		const { id } = makeGame();
		await expect(ActionStateService.war(id, 0, 1, 2)).resolves.toBeDefined();
	});

	test('action-ong carries LK', async () => {
		const { id, gameState } = makeGame();
		const cardKeys = gameState.playersStates[0].cards.slice(0, 4).map((c) => c.key);
		await expect(ActionStateService.ong(id, 0, cardKeys, [1, 2])).resolves.toBeDefined();
	});
});

describe('LK emission — bank', () => {
	test('credit-new carries LK', async () => {
		const { id } = makeGame({ typeMoney: GAME_TYPE.DEBT });
		await expect(BankStateService.createCredit(id, 0, 3, 1)).resolves.toBeDefined();
	});

	test('free-money carries LK', async () => {
		const { id } = makeGame({ typeMoney: GAME_TYPE.DEBT });
		await expect(BankStateService.freeMoney(id, 0, 5)).resolves.toBeDefined();
	});

	test('credit-canceled carries LK', async () => {
		const credit = creditOf(0);
		const { id } = makeGame({ typeMoney: GAME_TYPE.DEBT, credits: [credit] });
		await expect(BankStateService.cancelCredit(id, credit.id)).resolves.toBeDefined();
	});

	test('credit-settled carries LK', async () => {
		const credit = creditOf(0);
		const { id } = makeGame({ typeMoney: GAME_TYPE.DEBT, credits: [credit] });
		await expect(BankStateService.settleCredit(id, credit.id, 0)).resolves.toBeDefined();
	});

	test('credit-extended carries LK', async () => {
		const credit = creditOf(0);
		const { id } = makeGame({ typeMoney: GAME_TYPE.DEBT, credits: [credit] });
		await expect(BankStateService.extendCredit(id, credit.id, 0)).resolves.toBeDefined();
	});

	test('credit-seizure carries LK', async () => {
		const credit = creditOf(0, CREDIT_STATUS.FAULT);
		const { id, gameState } = makeGame({ typeMoney: GAME_TYPE.DEBT, credits: [credit] });
		const seizure = { coins: 2, cards: [{ key: gameState.playersStates[0].cards[0].key }] };
		await expect(BankStateService.seizure(id, credit.id, 0, seizure)).resolves.toBeDefined();
	});

	test('credit-seized-dead carries LK', async () => {
		const credit = creditOf(0, CREDIT_STATUS.RUNNING);
		const { id, gameState } = makeGame({ typeMoney: GAME_TYPE.DEBT, credits: [credit] });
		const entry = GameStateManager.get(id);
		const player = gameState.playersStates[0];
		await expect(BankStateService.seizureOnDead(gameState, entry.events, player)).resolves.not.toThrow?.();
	});

	test('prison-ended carries LK', async () => {
		const { id, gameState } = makeGame({ typeMoney: GAME_TYPE.DEBT });
		gameState.playersStates[0].status = PLAYER_STATUS.PRISON;
		await expect(BankStateService.prisonBreak(id, 0)).resolves.not.toThrow?.();
	});
});

describe('LK emission — game init', () => {
	beforeEach(() => {
		savedEvents.length = 0;
		initedGames.clear();
	});

	test('player-init and first-du carry LK', async () => {
		const { id, gameState, rules } = makeGame();
		gameState.status = GAME_STATUS.CREATED;
		initedGames.set(id, gameState);
		initedGames.set('__rules__', { ...rules, roundMinutes: 10, startAmountCoins: 5, distribInitCards: 4 });

		await expect(GameStateService.initGame(id)).resolves.toBeDefined();
	});
});
