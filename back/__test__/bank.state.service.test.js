import { jest } from '@jest/globals';
import { CREDIT_STATUS, GAME_STATUS, PLAYER_STATUS } from '@geco/shared';

// ─── Mocks (must come BEFORE imports of the module under test) ───────────────

await jest.unstable_mockModule('../src/gameState/managers/CreditTimerManager.js', () => ({
    default: {
        startTimer: jest.fn().mockResolvedValue(undefined),
        stopAndRemoveTimer: jest.fn().mockResolvedValue(undefined),
        stopAndGetRemaining: jest.fn().mockReturnValue(null),
        pauseGameTimers: jest.fn().mockResolvedValue(undefined),
        resumeTimer: jest.fn().mockResolvedValue(undefined),
        removeGameTimers: jest.fn().mockResolvedValue(undefined),
        getTimer: jest.fn()
    }
}));

await jest.unstable_mockModule('../src/gameState/managers/GameStateManager.js', () => ({
    default: {
        withQueue: jest.fn()
    }
}));

await jest.unstable_mockModule('#config/socket', () => ({
    default: {
        emitTo: jest.fn(),
        emitAckTo: jest.fn()
    }
}));

await jest.unstable_mockModule('#config/log', () => ({
    default: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Avoid importing Timer for real — mock it lightweight
await jest.unstable_mockModule('../src/misc/Timer.js', () => ({
    default: jest.fn().mockImplementation((id, data, duration) => ({
        id,
        data,
        duration,
        status: 'idle',
        getRemainingMs: jest.fn().mockReturnValue(duration),
        start: jest.fn(),
        stop: jest.fn(),
        pause: jest.fn().mockReturnValue(duration),
        resume: jest.fn()
    }))
}));

// ─── Late imports (after mocking) ────────────────────────────────────────────

const { default: BankStateService } = await import('../src/gameState/services/bank.state.service.js');
const { default: creditTimerManager } = await import('../src/gameState/managers/CreditTimerManager.js');
const { default: GameStateManager } = await import('../src/gameState/managers/GameStateManager.js');
const { default: socket } = await import('#config/socket');

// ─── Shared test helpers ──────────────────────────────────────────────────────

const makeGameState = (overrides = {}) => ({
    _id: 'game-001',
    sessionId: 'session-001',
    status: GAME_STATUS.PLAYING,
    creditIndexSeq: 0,
    currentMassMonetary: 100,
    bankInterestEarned: 0,
    bankMoneyDestroyed: 0,
    bankMoneyLost: 0,
    bankGoodsEarned: 0,
    credits: [],
    playersStates: [
        { idx: 1, status: PLAYER_STATUS.ALIVE, coins: 20, cards: [] },
        { idx: 2, status: PLAYER_STATUS.ALIVE, coins: 5,  cards: [] },
    ],
    ...overrides
});

const makeRules = (overrides = {}) => ({
    durationCredit: 5,   // minutes
    defaultCreditAmount: 3,
    defaultInterestAmount: 1,
    ...overrides
});

/**
 * Makes GameStateManager.withQueue immediately call the provided fn
 * with a synthetic entry built from gameState + rules.
 */
const setupWithQueue = (gameState, rules = makeRules()) => {
    GameStateManager.withQueue.mockImplementation(async (_id, fn) => {
        const entry = {
            gameState,
            rules,
            events: [],
            sessionId: gameState.sessionId,
            gameStateId: gameState._id.toString()
        };
        return fn(entry);
    });
};

// ─── describe blocks ─────────────────────────────────────────────────────────

describe('BankStateService — createCredit', () => {
    let gameState;
    const rules = makeRules();

    beforeEach(() => {
        jest.clearAllMocks();
        gameState = makeGameState({ status: GAME_STATUS.PLAYING });
        setupWithQueue(gameState, rules);
    });

    it('adds coins to the player and pushes a credit into gameState.credits', async () => {
        const result = await BankStateService.createCredit('game-001', 1, 3, 1);

        expect(gameState.playersStates[0].coins).toBe(23); // 20 + 3
        expect(gameState.credits).toHaveLength(1);
        expect(gameState.credits[0].amount).toBe(3);
        expect(gameState.credits[0].interest).toBe(1);
        expect(gameState.credits[0].playerStateIdx).toBe(1);
        expect(result.currentMassMonetary).toBe(103); // 100 + 3
    });

    it('sets credit status to RUNNING and starts timer when game is PLAYING', async () => {
        await BankStateService.createCredit('game-001', 1, 3, 1);

        expect(gameState.credits[0].status).toBe(CREDIT_STATUS.RUNNING);
        expect(creditTimerManager.startTimer).toHaveBeenCalledTimes(1);
    });

    it('sets credit status to IDLE and does NOT start timer when game is INITIALIZED', async () => {
        gameState.status = GAME_STATUS.INITIALIZED;
        await BankStateService.createCredit('game-001', 1, 3, 1);

        expect(gameState.credits[0].status).toBe(CREDIT_STATUS.IDLE);
        expect(creditTimerManager.startTimer).not.toHaveBeenCalled();
    });

    it('sets credit status to IDLE and does NOT start timer when game is PAUSED', async () => {
        gameState.status = GAME_STATUS.PAUSED;
        await BankStateService.createCredit('game-001', 1, 3, 1);

        expect(gameState.credits[0].status).toBe(CREDIT_STATUS.IDLE);
        expect(creditTimerManager.startTimer).not.toHaveBeenCalled();
    });

    it('increments creditIndexSeq for each credit', async () => {
        setupWithQueue(gameState, rules); // re-bind so mutations accumulate
        await BankStateService.createCredit('game-001', 1, 3, 1);
        await BankStateService.createCredit('game-001', 1, 3, 1);

        expect(gameState.creditIndexSeq).toBe(2);
        expect(gameState.credits).toHaveLength(2);
    });

    it('emits socket events to bank room and player room', async () => {
        await BankStateService.createCredit('game-001', 1, 3, 1);

        expect(socket.emitTo).toHaveBeenCalled();
        expect(socket.emitAckTo).toHaveBeenCalled();
    });

    it('throws when player is not ALIVE', async () => {
        gameState.playersStates[0].status = PLAYER_STATUS.DEAD;
        await expect(BankStateService.createCredit('game-001', 1, 3, 1)).rejects.toThrow();
    });

    it('throws when player is not found', async () => {
        await expect(BankStateService.createCredit('game-001', 99, 3, 1)).rejects.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BankStateService — createCreditForAll', () => {
    it('creates a credit for every ALIVE player', async () => {
        const gameState = makeGameState({
            status: GAME_STATUS.PLAYING,
            // createCreditForAll uses gameState.playerStates (no s)
            playerStates: [
                { idx: 1, status: PLAYER_STATUS.ALIVE, coins: 10, cards: [] },
                { idx: 2, status: PLAYER_STATUS.ALIVE, coins: 10, cards: [] },
                { idx: 3, status: PLAYER_STATUS.DEAD,  coins: 0,  cards: [] },
            ]
        });
        const rules = makeRules({ creditAmount: 3, creditInterest: 1 });

        GameStateManager.withQueue
            // outer call (createCreditForAll)
            .mockImplementationOnce(async (_id, fn) => {
                const entry = { gameState, rules, events: [], sessionId: gameState.sessionId, gameStateId: gameState._id };
                return fn(entry);
            })
            // two inner calls (one per ALIVE player)
            .mockImplementation(async (_id, fn) => {
                const entry = { gameState, rules, events: [], sessionId: gameState.sessionId, gameStateId: gameState._id };
                return fn(entry);
            });

        const result = await BankStateService.createCreditForAll('game-001');

        // 2 alive players → 2 credits
        expect(result.credits).toHaveLength(2);
    });

    it('skips dead / prison players', async () => {
        const gameState = makeGameState({
            playerStates: [
                { idx: 1, status: PLAYER_STATUS.DEAD, coins: 0, cards: [] }
            ]
        });
        GameStateManager.withQueue.mockImplementationOnce(async (_id, fn) => {
            const entry = { gameState, rules: makeRules(), events: [], sessionId: 's', gameStateId: 'g' };
            return fn(entry);
        });

        const result = await BankStateService.createCreditForAll('game-001');
        expect(result.credits).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BankStateService — cancelCredit', () => {
    let gameState;

    beforeEach(() => {
        jest.clearAllMocks();
        gameState = makeGameState({
            credits: [
                { id: 'credit-1', amount: 3, interest: 1, playerStateIdx: 1, status: CREDIT_STATUS.RUNNING, remainingTime: 60000 }
            ]
        });
        // player 1 has 20 coins — enough to repay 3
        setupWithQueue(gameState);
    });

    it('decreases player coins and mass monetary, marks credit CANCELED', async () => {
        const result = await BankStateService.cancelCredit('game-001', 'credit-1');

        expect(gameState.playersStates[0].coins).toBe(17); // 20 - 3
        expect(gameState.currentMassMonetary).toBe(97);   // 100 - 3
        expect(gameState.credits[0].status).toBe(CREDIT_STATUS.CANCELED);
        expect(result.credit.status).toBe(CREDIT_STATUS.CANCELED);
    });

    it('stops the credit timer', async () => {
        await BankStateService.cancelCredit('game-001', 'credit-1');
        expect(creditTimerManager.stopAndRemoveTimer).toHaveBeenCalledWith('credit-1');
    });

    it('emits socket events on success', async () => {
        await BankStateService.cancelCredit('game-001', 'credit-1');
        expect(socket.emitAckTo).toHaveBeenCalled();
        expect(socket.emitTo).toHaveBeenCalled();
    });

    it('throws when credit is not found', async () => {
        await expect(BankStateService.cancelCredit('game-001', 'no-such-credit')).rejects.toThrow('Credit not found');
    });

    it('throws when player does not have enough coins', async () => {
        gameState.playersStates[0].coins = 0; // can't repay 3
        await expect(BankStateService.cancelCredit('game-001', 'credit-1')).rejects.toThrow('Not enough coins');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BankStateService — freeMoney', () => {
    let gameState;

    beforeEach(() => {
        jest.clearAllMocks();
        gameState = makeGameState();
        setupWithQueue(gameState);
    });

    it('adds coins to player and increases mass monetary', async () => {
        const result = await BankStateService.freeMoney('game-001', 1, 5);

        expect(gameState.playersStates[0].coins).toBe(25); // 20 + 5
        expect(gameState.currentMassMonetary).toBe(105);
        expect(result.amount).toBe(5);
        expect(result.currentMassMonetary).toBe(105);
    });

    it('emits socket event to player room', async () => {
        await BankStateService.freeMoney('game-001', 1, 5);
        expect(socket.emitAckTo).toHaveBeenCalled();
    });

    it('pushes an event into the events buffer', async () => {
        let capturedEvents;
        GameStateManager.withQueue.mockImplementationOnce(async (_id, fn) => {
            const entry = { gameState, rules: makeRules(), events: [], sessionId: 's', gameStateId: gameState._id };
            const result = await fn(entry);
            capturedEvents = entry.events;
            return result;
        });

        await BankStateService.freeMoney('game-001', 1, 5);
        expect(capturedEvents).toHaveLength(1);
    });

    it('throws when player is not found', async () => {
        await expect(BankStateService.freeMoney('game-001', 99, 5)).rejects.toThrow();
    });

    it('throws when player is not ALIVE', async () => {
        gameState.playersStates[0].status = PLAYER_STATUS.DEAD;
        await expect(BankStateService.freeMoney('game-001', 1, 5)).rejects.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BankStateService — settleCredit', () => {
    let gameState;

    beforeEach(() => {
        jest.clearAllMocks();
        // player 1 has 20 coins; credit costs amount(3) + interest(1) = 4
        gameState = makeGameState({
            bankInterestEarned: 0,
            bankMoneyDestroyed: 0,
            credits: [
                { id: 'credit-1', amount: 3, interest: 1, playerStateIdx: 1, status: CREDIT_STATUS.REQUESTING, remainingTime: 60000 }
            ]
        });
        setupWithQueue(gameState);
    });

    it('deducts coins from player (amount + interest)', async () => {
        await BankStateService.settleCredit('game-001', 'credit-1', 1);
        expect(gameState.playersStates[0].coins).toBe(16); // 20 - (3+1)
    });

    it('updates monetary counters and mass monetary', async () => {
        await BankStateService.settleCredit('game-001', 'credit-1', 1);
        expect(gameState.currentMassMonetary).toBe(96);  // 100 - 4
        expect(gameState.bankInterestEarned).toBe(1);
        expect(gameState.bankMoneyDestroyed).toBe(3);
    });

    it('marks credit as DONE and stops the timer', async () => {
        await BankStateService.settleCredit('game-001', 'credit-1', 1);
        expect(gameState.credits[0].status).toBe(CREDIT_STATUS.DONE);
        expect(creditTimerManager.stopAndRemoveTimer).toHaveBeenCalledWith('credit-1');
    });

    it('emits socket events to player and bank', async () => {
        await BankStateService.settleCredit('game-001', 'credit-1', 1);
        expect(socket.emitAckTo).toHaveBeenCalled();
        expect(socket.emitTo).toHaveBeenCalled();
    });

    it('throws ERROR.NOT_ENOUGH_COINS when player cannot afford', async () => {
        gameState.playersStates[0].coins = 0;
        await expect(BankStateService.settleCredit('game-001', 'credit-1', 1))
            .rejects.toThrow('ERROR.NOT_ENOUGH_COINS');
    });

    it('throws when credit is DONE or CANCELED', async () => {
        gameState.credits[0].status = CREDIT_STATUS.DONE;
        await expect(BankStateService.settleCredit('game-001', 'credit-1', 1))
            .rejects.toThrow('ERROR.CREDIT_ALREADY_DONE_OR_CANCELED');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BankStateService — seizureOnDead', () => {
    /**
     * seizureOnDead is NOT a BankStateService method that goes through withQueue.
     * It is a pure synchronous helper called with (gameState, events, player).
     * We test its accounting logic directly.
     *
     * NOTE: Because it imports DecksHelper (which does real DB calls), we only
     * exercise the financial accounting path here and accept that DecksHelper will
     * be a no-op when cards array is empty (nothing to seize → no call needed).
     */

    const makePlayer = (overrides = {}) => ({
        idx: 1,
        coins: 10,
        cards: [],
        ...overrides
    });

    const makeCredit = (overrides = {}) => ({
        id: 'credit-1',
        amount: 3,
        interest: 1,
        playerStateIdx: 1,
        status: CREDIT_STATUS.RUNNING,
        remainingTime: 60000,
        ...overrides
    });

    it('marks all player credits as DONE', async () => {
        const player = makePlayer({ coins: 20 });
        const credit = makeCredit();
        const gameState = makeGameState({ credits: [credit] });
        const events = [];

        await BankStateService.seizureOnDead(gameState, events, player);

        expect(credit.status).toBe(CREDIT_STATUS.DONE);
    });

    it('deducts interest from player coins when affordable', async () => {
        const player = makePlayer({ coins: 10 });
        const credit = makeCredit({ amount: 3, interest: 2 });
        const gameState = makeGameState({ credits: [credit] });

        await BankStateService.seizureOnDead(gameState, [credit], player);

        // interest (2) paid from coins, then amount (3) paid from coins
        expect(player.coins).toBe(5); // 10 - 2 - 3
    });

    it('accumulates bankMoneyDestroyed and bankInterestEarned on gameState', async () => {
        const player = makePlayer({ coins: 20 });
        const credit = makeCredit({ amount: 5, interest: 2 });
        const gameState = makeGameState({ credits: [credit], bankMoneyDestroyed: 0, bankInterestEarned: 0 });

        await BankStateService.seizureOnDead(gameState, [], player);

        // Paid interest from coins → bankInterestEarned += 2
        expect(gameState.bankInterestEarned).toBe(2);
        // Paid amount from coins  → bankMoneyDestroyed += 5
        expect(gameState.bankMoneyDestroyed).toBe(5);
    });

    it('handles multiple credits for same player', async () => {
        const player = makePlayer({ coins: 30 });
        const credit1 = makeCredit({ id: 'c1', amount: 3, interest: 1 });
        const credit2 = makeCredit({ id: 'c2', amount: 4, interest: 2, playerStateIdx: 1 });
        const gameState = makeGameState({ credits: [credit1, credit2] });

        await BankStateService.seizureOnDead(gameState, [], player);

        expect(credit1.status).toBe(CREDIT_STATUS.DONE);
        expect(credit2.status).toBe(CREDIT_STATUS.DONE);
        // Total paid: 1+3 + 2+4 = 10
        expect(player.coins).toBe(20); // 30 - 10
    });

    it('does not change credits of other players', async () => {
        const player = makePlayer({ idx: 1, coins: 20 });
        const myCredit    = makeCredit({ id: 'c1', amount: 3, interest: 1, playerStateIdx: 1 });
        const otherCredit = makeCredit({ id: 'c2', amount: 3, interest: 1, playerStateIdx: 2 });
        const gameState   = makeGameState({ credits: [myCredit, otherCredit] });

        await BankStateService.seizureOnDead(gameState, [], player);

        expect(myCredit.status).toBe(CREDIT_STATUS.DONE);
        expect(otherCredit.status).toBe(CREDIT_STATUS.RUNNING); // untouched
    });

    it('pushes a CREDIT_SEIZED_DEAD event', async () => {
        const player = makePlayer({ coins: 20 });
        const credit = makeCredit();
        const gameState = makeGameState({ credits: [credit] });
        const events = [];

        await BankStateService.seizureOnDead(gameState, events, player);

        expect(events).toHaveLength(1);
        expect(events[0].typeEvent).toBe('credit-seized-dead');
    });
});
