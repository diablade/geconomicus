import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import playerService from './../../../src/legacy/player/player.service.js';
import GameModel from './../../../src/legacy/game/game.model.js';
import decksService from './../../../src/legacy/legacy.decks.service.js';
import { C } from "../../config/constantes.js";
import bankService from './../../../src/legacy/bank/bank.service.js';
import mongoose from "mongoose";

jest.mock('./../../../src/legacy/player/player.service.js');
jest.mock('./../../../src/legacy/bank/bank.service.js');
jest.mock('./../../../src/legacy/game/game.model.js');

describe('seizureOnDead', () => {
    const mockIdGame = new mongoose.Types.ObjectId();
    const mockIdPlayer = new mongoose.Types.ObjectId();
    const mockIdPlayer2 = new mongoose.Types.ObjectId();
    const mockIdPlayer3 = new mongoose.Types.ObjectId();
    const mockIdPlayer4 = new mongoose.Types.ObjectId();

    const credit1 = new mongoose.Types.ObjectId();
    const credit2 = new mongoose.Types.ObjectId();

    const card1 = new mongoose.Types.ObjectId();
    const card2 = new mongoose.Types.ObjectId();
    const card3 = new mongoose.Types.ObjectId();
    const card4 = new mongoose.Types.ObjectId();
    const cards = [
        {
            _id:    card1,
            weight: 1,
            price:  1
        }, {
            _id:    card2,
            weight: 2,
            price:  2
        }, {
            _id:    card3,
            weight: 1,
            price:  1
        }, {
            _id:    card4,
            weight: 2,
            price:  2
        }
    ];

    const mockPlayer = {
        _id:   mockIdPlayer,
        coins: 10,
        cards: cards
    };
    const mockPlayer2 = {
        _id:   mockIdPlayer2,
        coins: 5,
        cards: cards
    };
    const mockPlayer3 = {
        _id:   mockIdPlayer3,
        coins: 0,
        cards: cards
    };
    const mockPlayer4 = {
        _id:   mockIdPlayer4,
        coins: 0,
        cards: [
            {
                _id:    card1,
                weight: 1,
                price:  1
            }, {
                _id:    card2,
                weight: 2,
                price:  2
            },
        ]
    };
    const mockCredits = [
        {
            _id:      credit1,
            interest: 1,
            amount:   3,
            idGame:   mockIdGame,
            idPlayer: mockIdPlayer,
            status:   C.RUNNING_CREDIT
        }, {
            _id:      credit2,
            interest: 1,
            amount:   3,
            idGame:   mockIdGame,
            idPlayer: mockIdPlayer,
            status:   C.RUNNING_CREDIT
        }
    ];
    const mockCredits2 = [
        {
            _id:      credit1,
            interest: 1,
            amount:   3,
            idGame:   mockIdGame,
            idPlayer: mockIdPlayer2,
            status:   C.RUNNING_CREDIT
        }, {
            _id:      credit2,
            interest: 1,
            amount:   3,
            idGame:   mockIdGame,
            idPlayer: mockIdPlayer2,
            status:   C.RUNNING_CREDIT
        }
    ];
    const mockCredits3 = [
        {
            _id:      credit1,
            interest: 1,
            amount:   3,
            idGame:   mockIdGame,
            idPlayer: mockIdPlayer3,
            status:   C.RUNNING_CREDIT
        }, {
            _id:      credit2,
            interest: 1,
            amount:   3,
            idGame:   mockIdGame,
            idPlayer: mockIdPlayer3,
            status:   C.RUNNING_CREDIT
        }
    ];
    const mockCredits4 = [
        {
            _id:      credit1,
            interest: 1,
            amount:   3,
            idGame:   mockIdGame,
            idPlayer: mockIdPlayer4,
            status:   C.RUNNING_CREDIT
        }, {
            _id:      credit2,
            interest: 1,
            amount:   3,
            idGame:   mockIdGame,
            idPlayer: mockIdPlayer4,
            status:   C.RUNNING_CREDIT
        }
    ];
    const mockGame = {
        _id:                 mockIdGame,
        typeMoney:           C.DEBT,
        decks:               [],
        events:              [],
        credits:             [mockCredits, mockCredits2, mockCredits3, mockCredits4].flat(1),
        players:             [mockPlayer, mockPlayer2, mockPlayer3, mockPlayer4],
        bankInterestEarned:  0,
        bankGoodsEarned:     0,
        bankMoneyLost:       0,
        currentMassMonetary: 0
    };

    beforeEach(() => {
        // Set up the mocks for each test
        jest.clearAllMocks();
        GameModel.findById = jest.fn().mockResolvedValue(mockGame);
        playerService.getPlayer = jest.fn();
        bankService.getRunningCreditsOfPlayer = jest.fn();
        GameModel.updateOne = jest.fn();
        decksService.pushCardsInDecks = jest.fn();
    });

    it('should handle a player with sufficient coins to pay all debts', async () => {
        playerService.getPlayer.mockResolvedValue(mockPlayer);
        bankService.getRunningCreditsOfPlayer.mockResolvedValue(mockCredits);
        await bankService.seizureOnDead(mockIdGame, mockIdPlayer);

        // Assertions
        expect(GameModel.updateOne).toHaveBeenCalledTimes(3); // 2 for credits, 1 for player update
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(1, {
            _id:           mockIdGame,
            'credits._id': credit1
        }, {
            $set: {
                'credits.$.status':  C.CREDIT_DONE,
                'credits.$.endDate': expect.any(Number)
            }
        });
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(2, {
            _id:           mockIdGame,
            'credits._id': credit2
        }, {
            $set: {
                'credits.$.status':  C.CREDIT_DONE,
                'credits.$.endDate': expect.any(Number)
            }
        });
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(3, {
            _id:           mockIdGame,
            'players._id': mockIdPlayer
        }, {
            $inc:  {
                'players.$.coins':     -8, // Total interest and amount credit as possible
                'bankInterestEarned':  2,
                'bankGoodsEarned':     0,
                'bankMoneyLost':       0,
                'currentMassMonetary': -8
            },
            $pull: {'players.$.cards': {_id: {$in: []}}},
            $push: {
                'events': {
                    typeEvent: C.SEIZED_DEAD,
                    emitter:   mockIdPlayer,
                    receiver:  C.BANK,
                    amount:    8,
                    resources: [
                        {
                            'bankGoodsEarned': 0,
                            'bankMoneyLost':   0,
                            "amount":          6,
                            "cards":           [],
                            "interest":        2
                        }
                    ],
                    date:      expect.anything()
                }
            }
        });
        expect(decksService.pushCardsInDecks).toHaveBeenCalledTimes(1);
    });

    it('should handle a player with some coins but sufficient cards to pay the rest of debts', async () => {
        playerService.getPlayer.mockResolvedValue(mockPlayer2);
        bankService.getRunningCreditsOfPlayer.mockResolvedValue(mockCredits2);
        await bankService.seizureOnDead(mockIdGame, mockIdPlayer2);

        // Assertions
        expect(GameModel.updateOne).toHaveBeenCalledTimes(3); // 2 for credits, 1 for player update
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(1, {
            _id:           mockIdGame,
            'credits._id': credit1
        }, {
            $set: {
                'credits.$.status':  C.CREDIT_DONE,
                'credits.$.endDate': expect.any(Number)
            }
        });
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(2, {
            _id:           mockIdGame,
            'credits._id': credit2
        }, {
            $set: {
                'credits.$.status':  C.CREDIT_DONE,
                'credits.$.endDate': expect.any(Number)
            }
        });
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(3, {
            _id:           mockIdGame,
            'players._id': mockIdPlayer2
        }, {
            $inc:  {
                'players.$.coins':     -5, // Total interest and amount credit as possible
                'bankInterestEarned':  2,
                'bankGoodsEarned':     3,
                'bankMoneyLost':       0,
                'currentMassMonetary': -5
            },
            $pull: {'players.$.cards': {_id: {$in: [undefined, undefined, undefined]}}},
            $push: {
                'events': {
                    typeEvent: C.SEIZED_DEAD,
                    emitter:   mockIdPlayer2,
                    receiver:  C.BANK,
                    amount:    5,
                    resources: [
                        {
                            'bankGoodsEarned': 3,
                            'bankMoneyLost':   0,
                            "amount":          3,
                            "cards":           [
                                {
                                    _id:    card4,
                                    weight: 2,
                                    price:  2
                                }, {
                                    _id:    card3,
                                    weight: 1,
                                    price:  1
                                },
                            ],
                            "interest":        2
                        }
                    ],
                    date:      expect.anything()
                }
            }
        });
        expect(decksService.pushCardsInDecks).toHaveBeenCalledTimes(1);
        expect(decksService.pushCardsInDecks).toHaveBeenNthCalledWith(1, mockIdGame, [
            {
                _id:    card4,
                weight: 2,
                price:  2
            }, {
                _id:    card3,
                weight: 1,
                price:  1
            },
        ]);
    });

    it('should handle a player with no coins and sufficient cards to pay all debts', async () => {
        playerService.getPlayer.mockResolvedValue(mockPlayer3);
        bankService.getRunningCreditsOfPlayer.mockResolvedValue(mockCredits3);
        await bankService.seizureOnDead(mockIdGame, mockIdPlayer3);

        // Assertions
        expect(GameModel.updateOne).toHaveBeenCalledTimes(3); // 2 for credits, 1 for player update
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(1, {
            _id:           mockIdGame,
            'credits._id': credit1
        }, {
            $set: {
                'credits.$.status':  C.CREDIT_DONE,
                'credits.$.endDate': expect.any(Number)
            }
        });
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(2, {
            _id:           mockIdGame,
            'credits._id': credit2
        }, {
            $set: {
                'credits.$.status':  C.CREDIT_DONE,
                'credits.$.endDate': expect.any(Number)
            }
        });
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(3, {
            _id:           mockIdGame,
            'players._id': mockIdPlayer3
        }, {
            $inc:  {
                'players.$.coins':     -0, // Total interest and amount credit as possible
                'bankInterestEarned':  0,
                'bankGoodsEarned':     6,
                'bankMoneyLost':       2,
                'currentMassMonetary': -0
            },
            $pull: {'players.$.cards': {_id: {$in: [undefined, undefined, undefined, undefined]}}},
            $push: {
                'events': {
                    typeEvent: C.SEIZED_DEAD,
                    emitter:   mockIdPlayer3,
                    receiver:  C.BANK,
                    amount:    0,
                    resources: [
                        {
                            'bankGoodsEarned': 6,
                            'bankMoneyLost':   2,
                            "amount":          0,
                            "interest":        0,
                            "cards":           expect.arrayContaining(cards),
                        }
                    ],
                    date:      expect.anything()
                }
            }
        });
        expect(decksService.pushCardsInDecks).toHaveBeenCalledTimes(1);
        expect(decksService.pushCardsInDecks).toHaveBeenNthCalledWith(1, mockIdGame, expect.arrayContaining(cards));
    });

    it('should handle a player with no coins and insufficient cards to pay all debts', async () => {
        playerService.getPlayer.mockResolvedValue(mockPlayer4);
        bankService.getRunningCreditsOfPlayer.mockResolvedValue(mockCredits4);
        await bankService.seizureOnDead(mockIdGame, mockIdPlayer4);

        // Assertions
        expect(GameModel.updateOne).toHaveBeenCalledTimes(3); // 2 for credits, 1 for player update
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(1, {
            _id:           mockIdGame,
            'credits._id': credit1
        }, {
            $set: {
                'credits.$.status':  C.CREDIT_DONE,
                'credits.$.endDate': expect.any(Number)
            }
        });
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(2, {
            _id:           mockIdGame,
            'credits._id': credit2
        }, {
            $set: {
                'credits.$.status':  C.CREDIT_DONE,
                'credits.$.endDate': expect.any(Number)
            }
        });
        expect(GameModel.updateOne).toHaveBeenNthCalledWith(3, {
            _id:           mockIdGame,
            'players._id': mockIdPlayer4
        }, {
            $inc:  {
                'players.$.coins':     -0, // Total interest and amount credit as possible
                'bankInterestEarned':  0,
                'bankGoodsEarned':     3,
                'bankMoneyLost':       5,
                'currentMassMonetary': -0
            },
            $pull: {'players.$.cards': {_id: {$in: [undefined, undefined]}}},
            $push: {
                'events': {
                    typeEvent: C.SEIZED_DEAD,
                    emitter:   mockIdPlayer4,
                    receiver:  C.BANK,
                    amount:    0,
                    resources: [
                        {
                            'bankGoodsEarned': 3,
                            'bankMoneyLost':   5,
                            "amount":          0,
                            "cards":           expect.arrayContaining([
                                {
                                    _id:    card1,
                                    weight: 1,
                                    price:  1
                                }, {
                                    _id:    card2,
                                    weight: 2,
                                    price:  2
                                },
                            ]),
                            "interest":        0
                        }
                    ],
                    date:      expect.anything()
                }
            }
        });
        expect(decksService.pushCardsInDecks).toHaveBeenCalledTimes(1);
        expect(decksService.pushCardsInDecks).toHaveBeenNthCalledWith(1, mockIdGame, expect.arrayContaining([
            {
                _id:    card1,
                weight: 1,
                price:  1
            }, {
                _id:    card2,
                weight: 2,
                price:  2
            },
        ]));
    });

    it('should throw an error when the operation fails', async () => {
        playerService.getPlayer.mockRejectedValue(new Error('Database error'));

        await expect(bankService.seizureOnDead(mockIdGame, mockIdPlayer)).rejects.toThrow('Database error');
    });
});
