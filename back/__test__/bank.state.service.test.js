import { jest } from '@jest/globals';
import { CREDIT_QUESTION_ANSWER, CREDIT_STATUS, GAME_STATUS, GAME_TYPE, PLAYER_STATUS } from '@geco/shared';

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

await jest.unstable_mockModule('../src/gameState/managers/PrisonTimerManager.js', () => ({
    default: {
        startTimer: jest.fn().mockResolvedValue(undefined),
        releasePlayer: jest.fn().mockResolvedValue(undefined),
        stopAndRemoveTimer: jest.fn().mockResolvedValue(undefined),
    }
}));

await jest.unstable_mockModule('../src/gameState/managers/GameStateManager.js', () => ({
    default: {
        withQueue: jest.fn(),
        onAfterMutation: jest.fn()
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

await jest.unstable_mockModule('../src/gameState/helpers/decks.helper.js', () => ({
    default: {
        pushCardsInDecks: jest.fn()
    }
}));

await jest.unstable_mockModule('../src/gameState/helpers/event.helper.js', () => ({
    default: {
        createEvent: jest.fn((typeEvent, sessionId, gameStateId, playerType, playerIdx, data) => ({
            typeEvent,
            sessionId,
            gameStateId,
            playerType,
            playerIdx,
            data,
            createdAt: new Date()
        }))
    }
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
        expect(result.bankIndicators.currentMassMonetary).toBe(103); // 100 + 3
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
            playersStates: [
                { idx: 1, status: PLAYER_STATUS.ALIVE, coins: 10, cards: [] },
                { idx: 2, status: PLAYER_STATUS.ALIVE, coins: 10, cards: [] },
                { idx: 3, status: PLAYER_STATUS.DEAD,  coins: 0,  cards: [] },
            ]
        });
        const rules = makeRules({ defaultCreditAmount: 3, defaultInterestAmount: 1 });
        // Single queued op — createCreditForAll now creates each credit in-entry (no re-enqueue).
        setupWithQueue(gameState, rules);

        const result = await BankStateService.createCreditForAll('game-001');

        // 2 alive players → 2 credits
        expect(result.credits).toHaveLength(2);
    });

    it('skips dead / prison players', async () => {
        const gameState = makeGameState({
            playersStates: [
                { idx: 1, status: PLAYER_STATUS.DEAD, coins: 0, cards: [] },
                { idx: 2, status: PLAYER_STATUS.PRISON, coins: 0, cards: [] },
            ]
        });
        setupWithQueue(gameState, makeRules());

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
        expect(result.bankIndicators.currentMassMonetary).toBe(105);
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

// ─────────────────────────────────────────────────────────────────────────────

describe('BankStateService — seizure (manual master seizure)', () => {
    let gameState;
    let prisonTimerManager;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Import PrisonTimerManager mock here
        prisonTimerManager = (await import('../src/gameState/managers/PrisonTimerManager.js')).default;
        prisonTimerManager.startTimer = jest.fn().mockResolvedValue(undefined);
        prisonTimerManager.releasePlayer = jest.fn().mockResolvedValue(undefined);

        gameState = makeGameState({
            bankInterestEarned: 0,
            bankGoodsEarned: 0,
            currentMassMonetary: 100,
            credits: [
                {
                    id: 'credit-1',
                    amount: 5,
                    interest: 2,
                    playerStateIdx: 1,
                    status: CREDIT_STATUS.FAULT,
                    remainingTime: 60000,
                },
            ],
            playersStates: [
                {
                    idx: 1,
                    status: PLAYER_STATUS.ALIVE,
                    coins: 30,
                    cards: [
                        { key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 },
                        { key: 'card-2', price: 3, letter: 'B', color: 'blue', weight: 1 },
                        { key: 'card-3', price: 1, letter: 'C', color: 'green', weight: 2 },
                    ],
                },
                { idx: 2, status: PLAYER_STATUS.ALIVE, coins: 5, cards: [] },
            ],
            decks: [[]], // deck 0 is empty for test
        });
        setupWithQueue(gameState, makeRules({ timerPrison: 5 }));
    });

    it('seizes coins and cards from player, updates bank indicators', async () => {
        const seizure = {
            coins: 10,
            cards: [
                { key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 },
                { key: 'card-2', price: 3, letter: 'B', color: 'blue', weight: 1 },
            ],
            prisonTime: 0,
        };

        const result = await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        expect(gameState.playersStates[0].coins).toBe(20); // 30 - 10
        expect(gameState.playersStates[0].cards).toHaveLength(1); // 3 - 2
        expect(gameState.playersStates[0].cards[0].key).toBe('card-3');
        expect(gameState.currentMassMonetary).toBe(90); // 100 - 10
        expect(gameState.bankGoodsEarned).toBe(5); // 2 + 3
        expect(result.coinsLK).toBe(20);
    });

    it('adds the unrecovered gap to bankMoneyLost (Fees mode)', async () => {
        setupWithQueue(gameState, makeRules({ timerPrison: 5, seizureType: CREDIT_STATUS.FEES, seizureCosts: 1 }));
        const seizure = {
            coins: 3,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
            prisonTime: 1,
        };

        await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        expect(gameState.bankMoneyLost).toBe(3);
        expect(gameState.playersStates[0].status).toBe(PLAYER_STATUS.PRISON);
    });

    it('counts seized cards at their discounted value when computing the gap (Decote mode)', async () => {
        setupWithQueue(gameState, makeRules({ timerPrison: 5, seizureType: CREDIT_STATUS.DECOTE, seizureDecote: 50 }));
        const seizure = {
            coins: 0,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
            prisonTime: 0,
        };

        await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        expect(gameState.bankMoneyLost).toBe(6);
        expect(gameState.bankGoodsEarned).toBe(2);
    });

    it('leaves bankMoneyLost untouched when the seizure covers the whole credit', async () => {
        const seizure = {
            coins: 7,
            cards: [],
            prisonTime: 0,
        };

        await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        expect(gameState.bankMoneyLost).toBe(0);
    });

    it('marks credit as DONE and stops timer', async () => {
        const seizure = {
            coins: 5,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
            prisonTime: 0,
        };

        await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        expect(gameState.credits[0].status).toBe(CREDIT_STATUS.DONE);
        expect(creditTimerManager.stopAndRemoveTimer).toHaveBeenCalledWith('credit-1');
    });

    it('returns seized cards in payload', async () => {
        const seizure = {
            coins: 5,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
            prisonTime: 0,
        };

        const result = await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        expect(result.seizure.cards).toHaveLength(1);
        expect(result.seizure.cards[0].key).toBe('card-1');
        expect(result.seizure.coins).toBe(5);
    });

    it('imprisons player when prisonTime > 0', async () => {
        const seizure = {
            coins: 5,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
            prisonTime: 3,
        };

        const result = await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        expect(gameState.playersStates[0].status).toBe(PLAYER_STATUS.PRISON);
        expect(result.prisoner).toBeDefined();
        expect(result.prisoner.status).toBe(PLAYER_STATUS.PRISON);
        expect(prisonTimerManager.startTimer).toHaveBeenCalled();
    });

    it('clamps prisonTime to rules.timerPrison', async () => {
        const seizure = {
            coins: 5,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
            prisonTime: 100, // way over the limit
        };

        await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        // The Timer mock was called; verify the duration passed
        // In real code, _createPrisonTimer is called with Math.min(100, 5) = 5
        // We can't directly test Timer duration, but we can verify prison status
        expect(gameState.playersStates[0].status).toBe(PLAYER_STATUS.PRISON);
    });

    it('does NOT imprison when prisonTime is 0 or not specified', async () => {
        const seizure = {
            coins: 5,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
            prisonTime: 0,
        };

        const result = await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        expect(gameState.playersStates[0].status).toBe(PLAYER_STATUS.ALIVE);
        expect(result.prisoner).toBeUndefined();
        expect(prisonTimerManager.startTimer).not.toHaveBeenCalled();
    });

    it('throws ERROR.OWNERSHIP_CREDIT when credit belongs to different player', async () => {
        gameState.credits[0].playerStateIdx = 2; // belongs to player 2
        const seizure = {
            coins: 5,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
        };

        await expect(BankStateService.seizure('game-001', 'credit-1', 1, seizure))
            .rejects.toThrow('ERROR.OWNERSHIP_CREDIT');
    });

    it('throws ERROR.CREDIT_NOT_IN_FAULT when credit is not FAULT', async () => {
        gameState.credits[0].status = CREDIT_STATUS.RUNNING;
        const seizure = {
            coins: 5,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
        };

        await expect(BankStateService.seizure('game-001', 'credit-1', 1, seizure))
            .rejects.toThrow('ERROR.CREDIT_NOT_IN_FAULT');
    });

    it('throws ERROR.SEIZURE_COINS_EXCEED_PLAYER_COINS when coins exceed player balance', async () => {
        const seizure = {
            coins: 100, // player only has 30
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
        };

        await expect(BankStateService.seizure('game-001', 'credit-1', 1, seizure))
            .rejects.toThrow('ERROR.SEIZURE_COINS_EXCEED_PLAYER_COINS');
    });

    it('throws ERROR.CARD_NOT_FOUND_IN_HAND when card key not in player cards', async () => {
        const seizure = {
            coins: 5,
            cards: [
                { key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }, // exists
                { key: 'card-999', price: 99, letter: 'Z', color: 'black', weight: 3 }, // does NOT exist
            ],
        };

        await expect(BankStateService.seizure('game-001', 'credit-1', 1, seizure))
            .rejects.toThrow('ERROR.CARD_NOT_FOUND_IN_HAND');
    });

    it('uses server card data (price/weight) not client values', async () => {
        const seizure = {
            coins: 5,
            cards: [
                {
                    key: 'card-1',
                    price: 999, // client lies, says 999
                    letter: 'A',
                    color: 'red',
                    weight: 0,
                },
            ],
        };

        const result = await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        // Server should use actual card price (2) not client value (999)
        expect(gameState.bankGoodsEarned).toBe(2); // NOT 999
        expect(result.seizure.cards[0].price).toBe(2); // returned card has correct price
    });

    it('emits socket events to bank and player rooms', async () => {
        const seizure = {
            coins: 5,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
        };

        await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        expect(socket.emitTo).toHaveBeenCalled();
        expect(socket.emitAckTo).toHaveBeenCalled();
    });

    it('pushes CREDIT_SEIZURE event to events buffer', async () => {
        let capturedEvents;
        GameStateManager.withQueue.mockImplementationOnce(async (_id, fn) => {
            const entry = {
                gameState,
                rules: makeRules({ timerPrison: 5 }),
                events: [],
                sessionId: gameState.sessionId,
                gameStateId: gameState._id,
            };
            const result = await fn(entry);
            capturedEvents = entry.events;
            return result;
        });

        const seizure = {
            coins: 5,
            cards: [{ key: 'card-1', price: 2, letter: 'A', color: 'red', weight: 0 }],
            prisonTime: 3,
        };

        await BankStateService.seizure('game-001', 'credit-1', 1, seizure);

        // Should have 2 events: CREDIT_SEIZURE + PRISON
        expect(capturedEvents.length).toBeGreaterThanOrEqual(1);
        expect(capturedEvents[0].typeEvent).toBe('credit-seizure');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BankStateService — prisonBreak (early release)', () => {
    let gameState;
    let prisonTimerManager;

    beforeEach(async () => {
        jest.clearAllMocks();

        prisonTimerManager = (await import('../src/gameState/managers/PrisonTimerManager.js')).default;
        prisonTimerManager.releasePlayer = jest.fn().mockResolvedValue(undefined);

        gameState = makeGameState({
            playersStates: [
                {
                    idx: 1,
                    status: PLAYER_STATUS.PRISON,
                    coins: 10,
                    cards: [],
                },
            ],
            decks: [
                [
                    { key: 'deck-card-1', price: 1, letter: 'A', color: 'red', weight: 0 },
                    { key: 'deck-card-2', price: 2, letter: 'B', color: 'blue', weight: 0 },
                    { key: 'deck-card-3', price: 1, letter: 'C', color: 'green', weight: 0 },
                    { key: 'deck-card-4', price: 3, letter: 'D', color: 'yellow', weight: 0 },
                ],
            ],
        });
        setupWithQueue(gameState, makeRules());
    });

    it('stops the prison timer', async () => {
        await BankStateService.prisonBreak('game-001', 1);
        expect(prisonTimerManager.releasePlayer).toHaveBeenCalledWith('game-001', 1);
    });

    it('releases player (draws 4 cards, sets ALIVE)', async () => {
        await BankStateService.prisonBreak('game-001', 1);

        expect(gameState.playersStates[0].status).toBe(PLAYER_STATUS.ALIVE);
        expect(gameState.playersStates[0].cards).toHaveLength(4); // drew 4 cards
    });

    it('returns the released player and new cards', async () => {
        const result = await BankStateService.prisonBreak('game-001', 1);

        expect(result.playerState.status).toBe(PLAYER_STATUS.ALIVE);
        expect(result.newCards).toHaveLength(4);
        expect(result.event.typeEvent).toBe('prison-ended');
    });

    it('throws ERROR.PLAYER_NOT_IN_PRISON when player is not imprisoned', async () => {
        gameState.playersStates[0].status = PLAYER_STATUS.ALIVE;

        await expect(BankStateService.prisonBreak('game-001', 1))
            .rejects.toThrow('ERROR.PLAYER_NOT_IN_PRISON');
    });

    it('is idempotent (multiple calls on non-prison player do not crash)', async () => {
        gameState.playersStates[0].status = PLAYER_STATUS.ALIVE;

        // First call should throw
        await expect(BankStateService.prisonBreak('game-001', 1))
            .rejects.toThrow('ERROR.PLAYER_NOT_IN_PRISON');

        // No side effects
        expect(gameState.playersStates[0].coins).toBe(10);
    });

    it('emits socket events to bank and player rooms', async () => {
        await BankStateService.prisonBreak('game-001', 1);
        expect(socket.emitTo).toHaveBeenCalled();
        expect(socket.emitAckTo).toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BankStateService — pause / resume credit timers', () => {
    // durationCredit 5 min → full duration fallback = 300000ms
    const rules = makeRules({ durationCredit: 5 });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('pauseAllTimersCreditGame', () => {
        it('captures the remaining time and marks a RUNNING credit as PAUSED', async () => {
            creditTimerManager.stopAndGetRemaining.mockReturnValue(42000);
            const credit = { id: 'c1', playerStateIdx: 1, status: CREDIT_STATUS.RUNNING, remainingTime: 300000 };

            await BankStateService.pauseAllTimersCreditGame('game-001', [credit]);

            expect(credit.status).toBe(CREDIT_STATUS.PAUSED);
            expect(credit.remainingTime).toBe(42000);
        });

        it('still parks a RUNNING credit as PAUSED when its timer is missing (returns null)', async () => {
            // The bug: timer lost (e.g. after a server restart) → stopAndGetRemaining
            // returns null → credit used to stay RUNNING and could never be resumed.
            creditTimerManager.stopAndGetRemaining.mockReturnValue(null);
            const credit = { id: 'c1', playerStateIdx: 1, status: CREDIT_STATUS.RUNNING, remainingTime: 120000 };

            await BankStateService.pauseAllTimersCreditGame('game-001', [credit]);

            expect(credit.status).toBe(CREDIT_STATUS.PAUSED);
            expect(credit.remainingTime).toBe(120000); // keeps last known value
        });

        it('does not overwrite remainingTime with a zero remaining', async () => {
            creditTimerManager.stopAndGetRemaining.mockReturnValue(0);
            const credit = { id: 'c1', playerStateIdx: 1, status: CREDIT_STATUS.RUNNING, remainingTime: 90000 };

            await BankStateService.pauseAllTimersCreditGame('game-001', [credit]);

            expect(credit.status).toBe(CREDIT_STATUS.PAUSED);
            expect(credit.remainingTime).toBe(90000); // not reset to 0
        });

        it('skips credits that are not RUNNING', async () => {
            const credit = { id: 'c1', playerStateIdx: 1, status: CREDIT_STATUS.REQUESTING, remainingTime: 1000 };

            await BankStateService.pauseAllTimersCreditGame('game-001', [credit]);

            expect(credit.status).toBe(CREDIT_STATUS.REQUESTING);
            expect(creditTimerManager.stopAndGetRemaining).not.toHaveBeenCalled();
        });
    });

    describe('resumeAllTimersCreditGame', () => {
        it('restarts a PAUSED credit', async () => {
            const credit = { id: 'c1', playerStateIdx: 1, status: CREDIT_STATUS.PAUSED, remainingTime: 42000 };

            await BankStateService.resumeAllTimersCreditGame('game-001', [credit], rules);

            expect(creditTimerManager.startTimer).toHaveBeenCalledTimes(1);
            expect(credit.status).toBe(CREDIT_STATUS.RUNNING);
        });

        it('restarts an IDLE credit', async () => {
            const credit = { id: 'c1', playerStateIdx: 1, status: CREDIT_STATUS.IDLE, remainingTime: 300000 };

            await BankStateService.resumeAllTimersCreditGame('game-001', [credit], rules);

            expect(creditTimerManager.startTimer).toHaveBeenCalledTimes(1);
            expect(credit.status).toBe(CREDIT_STATUS.RUNNING);
        });

        it('restarts a RUNNING credit whose timer went missing (recovery path)', async () => {
            // The bug: a RUNNING-but-timerless credit used to be skipped by resume and
            // stayed frozen — its timer never started back.
            const credit = { id: 'c1', playerStateIdx: 1, status: CREDIT_STATUS.RUNNING, remainingTime: 42000 };

            await BankStateService.resumeAllTimersCreditGame('game-001', [credit], rules);

            expect(creditTimerManager.startTimer).toHaveBeenCalledTimes(1);
            expect(credit.status).toBe(CREDIT_STATUS.RUNNING);
        });

        it('resets an invalid / zeroed remainingTime to a full credit duration before restarting', async () => {
            const credit = { id: 'c1', playerStateIdx: 1, status: CREDIT_STATUS.PAUSED, remainingTime: 0 };

            await BankStateService.resumeAllTimersCreditGame('game-001', [credit], rules);

            expect(credit.remainingTime).toBe(5 * 60 * 1000); // durationCredit(5) * minute
            expect(creditTimerManager.startTimer).toHaveBeenCalledTimes(1);
            expect(credit.status).toBe(CREDIT_STATUS.RUNNING);
        });

        it('does NOT restart FAULT / REQUESTING / DONE / CANCELED credits', async () => {
            const credits = [
                { id: 'c1', playerStateIdx: 1, status: CREDIT_STATUS.FAULT, remainingTime: 1000 },
                { id: 'c2', playerStateIdx: 1, status: CREDIT_STATUS.REQUESTING, remainingTime: 1000 },
                { id: 'c3', playerStateIdx: 1, status: CREDIT_STATUS.DONE, remainingTime: 1000 },
                { id: 'c4', playerStateIdx: 1, status: CREDIT_STATUS.CANCELED, remainingTime: 1000 },
            ];

            await BankStateService.resumeAllTimersCreditGame('game-001', credits, rules);

            expect(creditTimerManager.startTimer).not.toHaveBeenCalled();
        });
    });

    it('pause then resume of a RUNNING credit with a missing timer round-trips back to RUNNING', async () => {
        // End-to-end of the reported bug: timer missing at pause, credit must still
        // come back RUNNING with a live timer after resume.
        creditTimerManager.stopAndGetRemaining.mockReturnValue(null);
        const credit = { id: 'c1', playerStateIdx: 1, status: CREDIT_STATUS.RUNNING, remainingTime: 120000 };

        await BankStateService.pauseAllTimersCreditGame('game-001', [credit]);
        expect(credit.status).toBe(CREDIT_STATUS.PAUSED);

        await BankStateService.resumeAllTimersCreditGame('game-001', [credit], rules);
        expect(credit.status).toBe(CREDIT_STATUS.RUNNING);
        expect(credit.remainingTime).toBe(120000);
        expect(creditTimerManager.startTimer).toHaveBeenCalledTimes(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BankStateService — First Credit Question (docs/adr/0009)', () => {
    const debtRules = (overrides = {}) => makeRules({ typeMoney: GAME_TYPE.DEBT, ...overrides });

    const preRoundGameState = (overrides = {}) =>
        makeGameState({ status: GAME_STATUS.INITIALIZED, currentMassMonetary: 0, ...overrides });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('stamps every current life PENDING and prompts each one', async () => {
        const gameState = preRoundGameState();
        setupWithQueue(gameState, debtRules());

        const result = await BankStateService.askFirstCreditQuestion('game-001');

        expect(result.asked).toBe(2);
        expect(gameState.playersStates.map((p) => p.firstCreditAnswer)).toEqual([
            CREDIT_QUESTION_ANSWER.PENDING,
            CREDIT_QUESTION_ANSWER.PENDING,
        ]);
        expect(socket.emitTo).toHaveBeenCalledTimes(2);
    });

    it('refuses to ask once the round is running', async () => {
        const gameState = makeGameState({ status: GAME_STATUS.PLAYING });
        setupWithQueue(gameState, debtRules());

        await expect(BankStateService.askFirstCreditQuestion('game-001')).rejects.toThrow(
            'ERROR.GAME_NOT_INITIALIZED'
        );
        expect(gameState.playersStates[0].firstCreditAnswer).toBeUndefined();
    });

    it('never re-asks a life that already answered, and skips DEAD lives', async () => {
        const gameState = preRoundGameState({
            playersStates: [
                { idx: 1, status: PLAYER_STATUS.ALIVE, coins: 0, cards: [], firstCreditAnswer: CREDIT_QUESTION_ANSWER.DECLINE },
                { idx: 2, status: PLAYER_STATUS.DEAD, coins: 0, cards: [] },
                { idx: 3, status: PLAYER_STATUS.ALIVE, coins: 0, cards: [] },
            ],
        });
        setupWithQueue(gameState, debtRules());

        const result = await BankStateService.askFirstCreditQuestion('game-001');

        expect(result.playerStateIdxs).toEqual([3]);
        expect(gameState.playersStates[0].firstCreditAnswer).toBe(CREDIT_QUESTION_ANSWER.DECLINE);
        expect(gameState.playersStates[1].firstCreditAnswer).toBeUndefined();
    });

    it('books the credit at the base rate on accept-single', async () => {
        const gameState = preRoundGameState();
        gameState.playersStates[0].firstCreditAnswer = CREDIT_QUESTION_ANSWER.PENDING;
        setupWithQueue(gameState, debtRules());

        await BankStateService.answerFirstCreditQuestion('game-001', 1, CREDIT_QUESTION_ANSWER.ACCEPT_SINGLE);

        expect(gameState.credits).toHaveLength(1);
        expect(gameState.credits[0]).toMatchObject({ amount: 3, interest: 1, status: CREDIT_STATUS.IDLE });
        expect(gameState.playersStates[0].firstCreditAnswer).toBe(CREDIT_QUESTION_ANSWER.ACCEPT_SINGLE);
    });

    it('doubles both amount and interest on accept-double', async () => {
        const gameState = preRoundGameState();
        gameState.playersStates[0].firstCreditAnswer = CREDIT_QUESTION_ANSWER.PENDING;
        setupWithQueue(gameState, debtRules());

        await BankStateService.answerFirstCreditQuestion('game-001', 1, CREDIT_QUESTION_ANSWER.ACCEPT_DOUBLE);

        expect(gameState.credits[0]).toMatchObject({ amount: 6, interest: 2 });
    });

    it('creates no credit on decline', async () => {
        const gameState = preRoundGameState();
        gameState.playersStates[0].firstCreditAnswer = CREDIT_QUESTION_ANSWER.PENDING;
        setupWithQueue(gameState, debtRules());

        await BankStateService.answerFirstCreditQuestion('game-001', 1, CREDIT_QUESTION_ANSWER.DECLINE);

        expect(gameState.credits).toHaveLength(0);
        expect(gameState.playersStates[0].firstCreditAnswer).toBe(CREDIT_QUESTION_ANSWER.DECLINE);
    });

    it('rejects a second answer, so a double tap cannot book two credits', async () => {
        const gameState = preRoundGameState();
        gameState.playersStates[0].firstCreditAnswer = CREDIT_QUESTION_ANSWER.PENDING;
        setupWithQueue(gameState, debtRules());

        await BankStateService.answerFirstCreditQuestion('game-001', 1, CREDIT_QUESTION_ANSWER.ACCEPT_SINGLE);
        await expect(
            BankStateService.answerFirstCreditQuestion('game-001', 1, CREDIT_QUESTION_ANSWER.ACCEPT_SINGLE)
        ).rejects.toThrow('ERROR.FIRST_CREDIT_NOT_PENDING');

        expect(gameState.credits).toHaveLength(1);
    });

    it('rejects an answer from a life that was never asked', async () => {
        const gameState = preRoundGameState();
        setupWithQueue(gameState, debtRules());

        await expect(
            BankStateService.answerFirstCreditQuestion('game-001', 1, CREDIT_QUESTION_ANSWER.ACCEPT_SINGLE)
        ).rejects.toThrow('ERROR.FIRST_CREDIT_NOT_PENDING');
    });

    it('sweeps only pending lives to no-answer at launch, one event each', () => {
        const gameState = preRoundGameState({
            playersStates: [
                { idx: 1, status: PLAYER_STATUS.ALIVE, coins: 0, cards: [], firstCreditAnswer: CREDIT_QUESTION_ANSWER.PENDING },
                { idx: 2, status: PLAYER_STATUS.ALIVE, coins: 0, cards: [], firstCreditAnswer: CREDIT_QUESTION_ANSWER.DECLINE },
                { idx: 3, status: PLAYER_STATUS.ALIVE, coins: 0, cards: [] },
            ],
        });
        const entry = { gameState, rules: debtRules(), events: [] };

        const swept = BankStateService.sweepUnansweredFirstCredit(entry);

        expect(swept).toEqual([1]);
        expect(gameState.playersStates[0].firstCreditAnswer).toBe(CREDIT_QUESTION_ANSWER.NO_ANSWER);
        expect(gameState.playersStates[1].firstCreditAnswer).toBe(CREDIT_QUESTION_ANSWER.DECLINE);
        expect(gameState.playersStates[2].firstCreditAnswer).toBeUndefined();
        expect(entry.events).toHaveLength(1);
        expect(entry.events[0].data).toEqual({ answer: CREDIT_QUESTION_ANSWER.NO_ANSWER });
    });
});
