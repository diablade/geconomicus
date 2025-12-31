import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import payInterest from '../../../src/legacy/bank/bank.service';
import getCreditOnActionPayment from '../../../src/legacy/bank/bank.service';
import GameModel from '../../../src/legacy/game/game.model';
import socket from '../../../config/socket';
import BankTimerManager from '../../../src/legacy/bank/BankTimerManager.js';
import { C } from '../../../../config/constantes.mjs';

describe('payInterest', () => {
    const mockCredit = {
        _id:      'credit123',
        interest: 50,
    };

    const mockCreditUpdated = {
        _id:      'credit123',
        interest: 50,
        status:   C.RUNNING_CREDIT,
        extended: 1,
    };

    const mockGame = {
        credits:     [mockCreditUpdated],
        timerCredit: 60,
    };

    beforeEach(() => {
        jest.clearAllMocks();

        getCreditOnActionPayment.mockResolvedValue({
            credit: mockCredit,
            canPay: true,
        });

        GameModel.findOneAndUpdate
            .mockResolvedValueOnce(mockGame) // first update: coins & event
            .mockResolvedValueOnce(mockGame); // second update: credit status

        constructor.event.mockReturnValue({type: 'mockedEvent'});

        socket.emitTo.mockImplementation(() => {
        });
        BankTimerManager.addTimer.mockImplementation(() => {
        });
    });

    it('should successfully pay interest and return updated credit', async () => {
        const result = await payInterest('credit123', 'game456', 'player789');
        expect(result).toEqual(mockCreditUpdated);
        expect(getCreditOnActionPayment).toHaveBeenCalled();
        expect(GameModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
        expect(socket.emitTo).toHaveBeenCalled();
        expect(BankTimerManager.addTimer).toHaveBeenCalledWith('credit123', true, mockGame.timerCredit, mockCreditUpdated);
    });

    it('should throw an error if coins are insufficient', async () => {
        getCreditOnActionPayment.mockResolvedValue({
            credit: mockCredit,
            canPay: false
        });

        await expect(payInterest('credit123', 'game456', 'player789')).rejects.toThrow('Not enough coins to pay interest.');
    });
});
