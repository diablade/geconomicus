import request from 'supertest';
import * as C from "../../config/constantes.js";
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals';
import GameModel from "../../src/game/game.model.js";
import decksService from "../../src/misc/decks.service.js";
import bankService from "../../src/bank/bank.service.js";

// Mock dependencies
jest.mock('../../src/game/game.model.js');
jest.mock('../../src/misc/decks.service.js');

describe('seizureOnDead function', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const mockCredit = {
		_id: 'creditId',
		idGame: 'gameId',
		idPlayer: 'playerId',
		amount: 3,
		interest: 1,
	};

	const mockCheckAbilityPayment = jest.fn();

	test('should handle player with enough coins to pay full debt', async () => {
		const mockPlayer = {
			_id: 'playerId',
			coins: 10,
			cards: [{ price: 50 }, { price: 30 }],
		};

		mockCheckAbilityPayment.mockResolvedValue({ player: mockPlayer });

		GameModel.findOneAndUpdate.mockResolvedValue({ /* mocked game data */ });
		GameModel.updateOne.mockResolvedValue({ /* mocked update result */ });

		await bankService.seizureOnDead(mockCredit);

		expect(GameModel.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: 'gameId', 'players._id': 'playerId' },
			{
				$set: { 'players.$.coins': 0 },
				$inc: {
					'bankInterestEarned': 10,
					'bankGoodsEarned': 100,
					'currentMassMonetary': -150,
				},
			},
			{ new: true }
		);

		expect(decksService.pushCardsInDecks).toHaveBeenCalledWith('gameId', mockPlayer.cards);

		expect(GameModel.updateOne).toHaveBeenCalledWith(
			{ _id: 'gameId', 'credits._id': 'creditId' },
			{
				$set: {
					'credits.$.status': C.CREDIT_DONE,
					'credits.$.endDate': expect.any(Date),
				},
			}
		);
	});

	test('should handle player with enough coins to pay only interest', async () => {
		const mockPlayer = {
			_id: 'playerId',
			coins: 20,
			cards: [{ price: 50 }, { price: 30 }],
		};

		mockCheckAbilityPayment.mockResolvedValue({ player: mockPlayer });

		await bankService.seizureOnDead(mockCredit);

		expect(GameModel.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: 'gameId', 'players._id': 'playerId' },
			{
				$set: { 'players.$.coins': 0 },
				$inc: {
					'bankInterestEarned': 10,
					'bankGoodsEarned': 10,
					'currentMassMonetary': -20,
				},
			},
			{ new: true }
		);
	});

	test('should handle player with not enough coins to pay interest', async () => {
		const mockPlayer = {
			_id: 'playerId',
			coins: 5,
			cards: [{ price: 50 }, { price: 30 }],
		};

		mockCheckAbilityPayment.mockResolvedValue({ player: mockPlayer });

		await bankService.seizureOnDead(mockCredit);

		expect(GameModel.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: 'gameId', 'players._id': 'playerId' },
			{
				$set: { 'players.$.coins': 0 },
				$inc: {
					'bankInterestEarned': 5,
					'bankGoodsEarned': 0,
					'currentMassMonetary': -5,
				},
			},
			{ new: true }
		);
	});

	test('should handle errors gracefully', async () => {
		mockCheckAbilityPayment.mockRejectedValue(new Error('Test error'));

		const result = await bankService.seizureOnDead(mockCredit);

		expect(result).toBeUndefined();
	});
});
