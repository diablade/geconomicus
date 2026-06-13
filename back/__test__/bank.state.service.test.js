import { jest } from '@jest/globals';
import { CREDIT_STATUS } from '@geco/shared';

// Mocking dependencies with ESM safe mockModule
await jest.unstable_mockModule('../src/gameState/managers/CreditTimerManager.js', () => ({
    default: {
        startTimer: jest.fn(),
        pauseGameTimers: jest.fn(),
        resumeTimer: jest.fn(),
        removeGameTimers: jest.fn(),
        getTimer: jest.fn()
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

// Import modules AFTER mocking
const { default: BankStateService } = await import('../src/gameState/services/bank.state.service.js');
const { default: creditTimerManager } = await import('../src/gameState/managers/CreditTimerManager.js');
const { default: socket } = await import('#config/socket');

describe('BankStateService - Timers Management', () => {
    let mockCredits;
    let mockRules;
    const gameStateId = 'test-game-id';

    beforeEach(() => {
        jest.clearAllMocks();

        mockCredits = [
            { id: 'credit1', status: CREDIT_STATUS.IDLE, playerStateIdx: 1, remainingTime: 60000 },
            { id: 'credit2', status: CREDIT_STATUS.RUNNING, playerStateIdx: 2, remainingTime: 30000 },
            { id: 'credit3', status: CREDIT_STATUS.PAUSED, playerStateIdx: 3, remainingTime: 15000 }
        ];

        mockRules = {
            durationCredit: 10 // duration in minutes
        };

        // Default mock for getTimer
        creditTimerManager.getTimer.mockImplementation((id) => {
            return {
                id,
                status: 'running',
                getRemainingMs: () => 10000
            };
        });
    });

    describe('startAllTimersCreditGame', () => {
        it('should start timers only for credits with IDLE status', async () => {
            await BankStateService.startAllTimersCreditGame(gameStateId, mockCredits, mockRules);

            // Only credit1 is IDLE, so it should be started
            expect(creditTimerManager.startTimer).toHaveBeenCalledTimes(1);

            // Verify that status and remainingTime were updated correctly
            expect(mockCredits[0].status).toBe(CREDIT_STATUS.RUNNING);

            // Check that socket events were emitted
            expect(socket.emitTo).toHaveBeenCalled();

            // credit2 and credit3 should remain unchanged
            expect(mockCredits[1].status).toBe(CREDIT_STATUS.RUNNING);
            expect(mockCredits[2].status).toBe(CREDIT_STATUS.PAUSED);
        });
    });

    describe('pauseAllTimersCreditGame', () => {
        it('should pause all RUNNING credits and call pauseGameTimers', async () => {
            await BankStateService.pauseAllTimersCreditGame(gameStateId, mockCredits);

            // credit2 is RUNNING, so getTimer should be called for it to fetch remainingTime
            expect(creditTimerManager.getTimer).toHaveBeenCalledWith('credit2');

            // Status should be changed to PAUSED
            expect(mockCredits[1].status).toBe(CREDIT_STATUS.PAUSED);
            // remainingTime should be updated based on getTimer().getRemainingMs() (mocked to 30000)
            expect(mockCredits[1].remainingTime).toBe(10000);

            // credit1 and credit3 should remain unchanged
            expect(mockCredits[0].status).toBe(CREDIT_STATUS.IDLE);
            expect(mockCredits[2].status).toBe(CREDIT_STATUS.PAUSED); // it was already paused

            // Verify manager is told to pause all game timers
            expect(creditTimerManager.pauseGameTimers).toHaveBeenCalledWith(gameStateId);
            expect(creditTimerManager.pauseGameTimers).toHaveBeenCalledTimes(1);
        });
    });

    describe('stopAllTimersCreditGame', () => {
        it('should call removeGameTimers on the manager to stop and remove all timers', async () => {
            await BankStateService.stopAllTimersCreditGame(gameStateId);

            // Verify manager is told to remove all timers for this game
            expect(creditTimerManager.removeGameTimers).toHaveBeenCalledWith(gameStateId);
            expect(creditTimerManager.removeGameTimers).toHaveBeenCalledTimes(1);
        });
    });

    describe('resumeAllTimersCreditGame', () => {
        it('should resume paused timers and start idle timers if they exist in the manager', async () => {
            await BankStateService.resumeAllTimersCreditGame(gameStateId, mockCredits, mockRules);

            // credit1 is IDLE, credit3 is PAUSED
            // Because getTimer returns a dummy timer for both in our mock,
            // the service should simply call resumeTimer on the existing timers.
            expect(creditTimerManager.resumeTimer).toHaveBeenCalledTimes(2);
            expect(creditTimerManager.startTimer).not.toHaveBeenCalled();
        });

        it('should create and start a new timer if it does not exist in the manager', async () => {
            // Mock getTimer to return undefined (e.g. server restarted or timer lost)
            creditTimerManager.getTimer.mockReturnValue(undefined);

            await BankStateService.resumeAllTimersCreditGame(gameStateId, mockCredits, mockRules);

            // Since getTimer returned undefined, it should create and start new timers for credit1 and credit3
            expect(creditTimerManager.resumeTimer).not.toHaveBeenCalled();
            expect(creditTimerManager.startTimer).toHaveBeenCalledTimes(2);
        });
    });
});
