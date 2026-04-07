import GameModel, { constructor } from '../game/game.model.js';
import log from '#config/log';
import _ from 'lodash';
import mongoose from "mongoose";
import socket from '#config/socket';
import { DEAD, EVENT, JUNE, TRANSACTION, TRANSACTION_DONE } from '#constantes';
import gameService from "../game/game.service.js";
import decksService from "../misc/legacy.decks.service.js";
import playerService from "./player.service.js";
import activeTransactions from './../misc/activeTransactions.js';

function waitForProductionToClear(activeTransactions, idGame, maxChecks = 5) {
    return new Promise((resolve, reject) => {
        let checks = 0;
        const intervalId = setInterval(() => {
            checks++;
            log.info("wait for prod " + checks + "...on game:", idGame);
            if (!activeTransactions.has(idGame)) {
                clearInterval(intervalId);
                resolve('cleared');
            }
            else if (checks >= maxChecks) {
                clearInterval(intervalId);
                resolve('timeout');
            }
        }, 1000);
    });
}

const PlayerLifeController = {};

PlayerLifeController.getById = async (req, res, next) => {
    const {
        idGame,
        idPlayer
    } = req.params;

    try {
        const player = await playerService.getPlayer(idGame, idPlayer, true);
        return res.status(200).json(player);
    }
    catch (err) {
        log.error(err);
        next({
            status: 404,
            message: "Player not found"
        });
    }
};
PlayerLifeController.produce = async (req, res, next) => {
    const {
        idGame,
        idPlayer,
        cards
    } = req.body;

    // Check if the player is already in progress
    if (activeTransactions.has(idGame) || activeTransactions.has(idPlayer)) {
        const resultWaitingQueue = await waitForProductionToClear(activeTransactions, idGame);
        if (resultWaitingQueue === 'timeout') {
            return res.status(409).json({ message: 'Producing already in progress' });
        }
    }
    try {
        activeTransactions.add(idGame); // Mark the production as active for this game
        activeTransactions.add(idPlayer); // Mark the production as active for this game
        const cardsDraw = await playerService.produceCardLevelUp(idGame, idPlayer, cards);
        activeTransactions.delete(idGame);
        activeTransactions.delete(idPlayer);
        return res.status(200).json(cardsDraw);
    }
    catch (err) {
        activeTransactions.delete(idGame);
        activeTransactions.delete(idPlayer);
        log.error('Production error:', err);
        return next({
            status: 400,
            message: err.message || err || "Production error"
        });
    }
};
PlayerLifeController.transaction = async (req, res, next) => {
    const {
        idGame,
        idBuyer,
        idSeller,
        idCard
    } = req.body;

    // Check if the transaction is already in progress
    if (activeTransactions.has(idBuyer) || activeTransactions.has(idSeller)) {
        return res.status(409).json({ message: 'Transaction already in progress' });
    }
    activeTransactions.add(idBuyer); // Mark the transaction as active
    activeTransactions.add(idSeller); // for both seller and buyer

    try {
        const game = await GameModel.findById(idGame);
        if (!game) {
            return res.status(404).json({ message: 'Transaction error, game not found' });
        }

        const buyer = game.players.find(p => p.id === idBuyer);
        const seller = game.players.find(p => p.id === idSeller);
        if (!buyer || !seller) {
            return res.status(404).json({ message: "Transaction error, Buyer or seller not found" });
        }
        if (buyer.status === DEAD || seller.status === DEAD) {
            return res.status(400).json({ message: "Transaction cannot involves a dead player, fool !" });
        }

        const card = seller.cards.find(c => id === idCard);
        if (!card) {
            return res.status(404).json({ message: "Transaction error, card not found" });
        }

        const cost = game.typeMoney === JUNE ? Number((card.price * game.currentDU).toFixed(2)) : card.price;
        if (buyer.coins < cost) {
            return res.status(400).json({ message: "Transaction error, Insufficient funds" });
        }

        const eventTransaction = constructor.event(TRANSACTION, idBuyer, idSeller, cost, [card], Date.now());

        const updatedGame = await GameModel.findByIdAndUpdate({
            _id: idGame,
            players: {
                $and: [
                    {
                        $elemMatch: {
                            _id: idSeller,
                            'cards._id': idCard,
                            status: { $ne: DEAD }
                        }
                    }, {
                        $elemMatch: {
                            _id: idBuyer,
                            coins: { $gte: cost },
                            status: { $ne: DEAD }
                        }
                    }
                ]
            }
        }, {
            $pull: { 'players.$[seller].cards': { _id: idCard } },
            $inc: {
                'players.$[seller].coins': cost,
                'players.$[buyer].coins': -cost
            },
            $push: {
                'players.$[buyer].cards': card,
                events: eventTransaction
            }
        }, {
            arrayFilters: [
                { 'seller._id': idSeller }, { 'buyer._id': idBuyer }
            ],
            new: true,
        });

        if (!updatedGame) {
            return res.status(400).json({ message: "Transaction failed: conditions not met" });
        }

        buyer.coins = Number((buyer.coins - cost).toFixed(2));
        seller.coins = Number((seller.coins + cost).toFixed(2));

        socket.emitTo(idGame + EVENT, EVENT, eventTransaction);
        socket.emitAckTo(idSeller, TRANSACTION_DONE, {
            idCardSold: idCard,
            coins: seller.coins,
            cost: cost.toFixed(2)
        });

        return res.status(200).json({
            buyedCard: card,
            coins: buyer.coins
        });
    }
    catch (err) {
        log.error('Transaction error:', err);
        return res.status(500).json({ message: 'Transaction error' });
    }
    finally {
        activeTransactions.delete(idBuyer);
        activeTransactions.delete(idSeller);
    }
};

export default PlayerController;

