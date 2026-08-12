import { jest } from '@jest/globals';
import { CREDIT_STATUS, DB_EVENTS, GAME_STATUS, GAME_TYPE, PLAYER_STATUS, PLAYER_TYPE, LK_KEYS } from '@geco/shared';

await jest.unstable_mockModule('#config/log', () => ({
	default: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { default: BankEngine } = await import('../src/gameState/engine/bank.engine.js');

const card = (key, weight = 0) => ({ key, letter: key[0], weight, price: 2 ** weight, color: 'red' });

const life = (idx, overrides = {}) => ({
	idx,
	avatarIdx: idx,
	status: PLAYER_STATUS.ALIVE,
	coins: 20,
	cards: [card(`A${idx}`), card(`B${idx}`)],
	actionTokens: 1,
	...overrides,
});

const credit = (overrides = {}) => ({
	id: 'credit-1',
	amount: 5,
	interest: 2,
	playerStateIdx: 0,
	status: CREDIT_STATUS.RUNNING,
	extended: 0,
	remainingTime: 300000,
	...overrides,
});

const makeGameState = (overrides = {}) => ({
	_id: 'game-001',
	sessionId: 'session-001',
	typeMoney: GAME_TYPE.DEBT,
	status: GAME_STATUS.PLAYING,
	currentDU: 1,
	currentMassMonetary: 100,
	bankInterestEarned: 0,
	bankMoneyDestroyed: 0,
	bankMoneyLost: 0,
	bankGoodsEarned: 0,
	creditIndexSeq: 0,
	credits: [],
	decks: [[card('Z1'), card('Z2'), card('Z3'), card('Z4'), card('Z5')], [], [], []],
	playersStates: [life(0), life(1)],
	...overrides,
});

const makeEntry = (gameState = makeGameState(), rules = {}) => ({
	gameState,
	rules: { durationCredit: 5, timerPrison: 5, defaultCreditAmount: 3, defaultInterestAmount: 1, ...rules },
	events: [],
});

describe('BankEngine — credit maturity has three outcomes (ADR-0018)', () => {
	it('asks a borrower who can cover everything to settle, and waits', () => {
		const c = credit();
		const entry = makeEntry(makeGameState({ credits: [c] }));

		const { outcome } = BankEngine.resolveCreditMaturity(entry, 'credit-1');

		expect(outcome).toBe('settlement-call');
		expect(c.status).toBe(CREDIT_STATUS.REQUESTING);
		expect(entry.events.map((e) => e.typeEvent)).toEqual([DB_EVENTS.CREDIT_REQUEST]);
	});

	it('takes the interest and restarts the term when only that is affordable', () => {
		const c = credit();
		const gameState = makeGameState({ credits: [c] });
		gameState.playersStates[0].coins = 3;
		const entry = makeEntry(gameState);

		const { outcome } = BankEngine.resolveCreditMaturity(entry, 'credit-1');

		expect(outcome).toBe('extended');
		expect(c.status).toBe(CREDIT_STATUS.RUNNING);
		expect(c.extended).toBe(1);
		expect(gameState.playersStates[0].coins).toBe(1);
	});

	it('defaults a borrower who can cover neither', () => {
		const c = credit();
		const gameState = makeGameState({ credits: [c] });
		gameState.playersStates[0].coins = 0;
		const entry = makeEntry(gameState);

		const { outcome } = BankEngine.resolveCreditMaturity(entry, 'credit-1');

		expect(outcome).toBe('fault');
		expect(c.status).toBe(CREDIT_STATUS.FAULT);
		expect(entry.events.map((e) => e.typeEvent)).toEqual([DB_EVENTS.CREDIT_FAULT]);
	});

	it('credits a bank-driven extension to the bank, not the borrower', () => {
		const gameState = makeGameState({ credits: [credit()] });
		gameState.playersStates[0].coins = 3;
		const entry = makeEntry(gameState);

		BankEngine.resolveCreditMaturity(entry, 'credit-1');

		expect(entry.events[0].emitter).toBe(PLAYER_TYPE.BANK);
		expect(entry.events[0].receiver).toBe(0);
	});
});

describe('BankEngine — a stale maturity callback is a no-op, not an error', () => {
	it('does nothing for a credit already settled', () => {
		const c = credit({ status: CREDIT_STATUS.DONE });
		const entry = makeEntry(makeGameState({ credits: [c] }));

		expect(BankEngine.resolveCreditMaturity(entry, 'credit-1').outcome).toBe('gone');
		expect(entry.events).toHaveLength(0);
	});

	it('does nothing for a credit already cancelled', () => {
		const c = credit({ status: CREDIT_STATUS.CANCELED });
		const entry = makeEntry(makeGameState({ credits: [c] }));

		expect(BankEngine.resolveCreditMaturity(entry, 'credit-1').outcome).toBe('gone');
		expect(entry.events).toHaveLength(0);
	});

	it('does nothing for a credit that no longer exists', () => {
		const entry = makeEntry();

		expect(BankEngine.resolveCreditMaturity(entry, 'vanished').outcome).toBe('gone');
		expect(entry.events).toHaveLength(0);
	});

	it('does nothing when the borrower has died', () => {
		const gameState = makeGameState({ credits: [credit()] });
		gameState.playersStates[0].status = PLAYER_STATUS.DEAD;
		const entry = makeEntry(gameState);

		expect(BankEngine.resolveCreditMaturity(entry, 'credit-1').outcome).toBe('gone');
		expect(entry.events).toHaveLength(0);
	});
});

describe('BankEngine — extendCredit records one event (ADR-0018)', () => {
	it('writes exactly one extension event, attributed to the borrower', () => {
		const gameState = makeGameState({ credits: [credit()] });
		const entry = makeEntry(gameState);

		BankEngine.extendCredit(entry, 'credit-1');

		expect(entry.events).toHaveLength(1);
		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.CREDIT_EXTENDED);
		expect(entry.events[0].emitter).toBe(0);
		expect(entry.events[0].receiver).toBe(PLAYER_TYPE.BANK);
	});

	it('takes the interest out of the money mass', () => {
		const gameState = makeGameState({ credits: [credit()] });
		const entry = makeEntry(gameState);

		BankEngine.extendCredit(entry, 'credit-1');

		expect(gameState.playersStates[0].coins).toBe(18);
		expect(gameState.currentMassMonetary).toBe(98);
		expect(gameState.bankInterestEarned).toBe(2);
	});

	it('refuses a borrower who cannot pay the interest', () => {
		const gameState = makeGameState({ credits: [credit()] });
		gameState.playersStates[0].coins = 0;
		const entry = makeEntry(gameState);

		expect(() => BankEngine.extendCredit(entry, 'credit-1')).toThrow('ERROR.NOT_ENOUGH_COINS');
		expect(entry.events).toHaveLength(0);
	});
});

describe('BankEngine — createCredit', () => {
	it('creates money rather than moving it', () => {
		const entry = makeEntry();

		const { credit: made } = BankEngine.createCredit(entry, 0, 6, 2, 'animator');

		expect(entry.gameState.playersStates[0].coins).toBe(26);
		expect(entry.gameState.currentMassMonetary).toBe(106);
		expect(made.status).toBe(CREDIT_STATUS.RUNNING);
	});

	it('waits IDLE when the round has not started', () => {
		const entry = makeEntry(makeGameState({ status: GAME_STATUS.INITIALIZED }));

		const { credit: made, startNow } = BankEngine.createCredit(entry, 0, 3, 1, 'first-question');

		expect(startNow).toBe(false);
		expect(made.status).toBe(CREDIT_STATUS.IDLE);
	});

	it('declares the borrower and the mass on the event', () => {
		const entry = makeEntry();

		BankEngine.createCredit(entry, 0, 3, 1, 'animator');

		const payload = entry.events[0].payload;
		expect(Object.keys(payload[LK_KEYS.PLAYERS])).toEqual(['0']);
		expect(payload[LK_KEYS.MASS_MONETARY]).toBe(103);
	});

	it('refuses a borrower who is not alive, with an i18n key', () => {
		const gameState = makeGameState();
		gameState.playersStates[0].status = PLAYER_STATUS.PRISON;
		const entry = makeEntry(gameState);

		expect(() => BankEngine.createCredit(entry, 0, 3, 1, 'animator')).toThrow('ERROR.PLAYER_NOT_ALIVE');
	});

	it('refuses an unknown borrower, with an i18n key', () => {
		const entry = makeEntry();

		expect(() => BankEngine.createCredit(entry, 99, 3, 1, 'animator')).toThrow('ERROR.PLAYER_NOT_FOUND');
	});
});

describe('BankEngine — settle, cancel and free money', () => {
	it('destroys the principal and earns the interest on settlement', () => {
		const gameState = makeGameState({ credits: [credit()] });
		const entry = makeEntry(gameState);

		BankEngine.settleCredit(entry, 'credit-1');

		expect(gameState.playersStates[0].coins).toBe(13);
		expect(gameState.currentMassMonetary).toBe(93);
		expect(gameState.bankMoneyDestroyed).toBe(5);
		expect(gameState.bankInterestEarned).toBe(2);
	});

	it('returns only the principal on cancellation', () => {
		const c = credit();
		const gameState = makeGameState({ credits: [c] });
		const entry = makeEntry(gameState);

		BankEngine.cancelCredit(entry, 'credit-1');

		expect(c.status).toBe(CREDIT_STATUS.CANCELED);
		expect(gameState.playersStates[0].coins).toBe(15);
		expect(gameState.bankInterestEarned).toBe(0);
	});

	it('grows the mass with free money', () => {
		const entry = makeEntry();

		BankEngine.freeMoney(entry, 0, 7);

		expect(entry.gameState.playersStates[0].coins).toBe(27);
		expect(entry.gameState.currentMassMonetary).toBe(107);
		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.FREE_MONEY);
	});
});

describe('BankEngine — releaseFromPrison', () => {
	it('deals four fresh cards and returns the Life to play', () => {
		const gameState = makeGameState();
		gameState.playersStates[0].status = PLAYER_STATUS.PRISON;
		gameState.playersStates[0].cards = [];
		const entry = makeEntry(gameState);

		const released = BankEngine.releaseFromPrison(entry, 0);

		expect(released.newCards).toHaveLength(4);
		expect(gameState.playersStates[0].status).toBe(PLAYER_STATUS.ALIVE);
		expect(entry.events[0].typeEvent).toBe(DB_EVENTS.PRISON_ENDED);
	});

	it('is a no-op for a Life that is not in prison', () => {
		const entry = makeEntry();

		expect(BankEngine.releaseFromPrison(entry, 0)).toBeNull();
		expect(entry.events).toHaveLength(0);
	});
});
