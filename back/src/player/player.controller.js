import GameModel, { constructor } from '../game/game.model.js';
import log from '../../config/log.js';
import _ from 'lodash';
import mongoose from "mongoose";
import socket from '../../config/socket.js';
import * as C from '../../../config/constantes.js';
import gameService from "../game/game.service.js";
import decksService from "../misc/decks.service.js";
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
			} else if (checks >= maxChecks) {
				clearInterval(intervalId);
				resolve('timeout');
			}
		}, 1000);
	});
}

const getById = async (req, res, next) => {
	const { idGame, idPlayer } = req.params;

	try {
		const player = await playerService.getPlayer(idGame, idPlayer, true);
		return res.status(200).json(player);
	} catch (e) {
		next({
			status: 404,
			message: "Player not found"
		});
	}
};
const join = async (req, res, next) => {
	const { idGame, name } = req.body;
	GameModel.findById(idGame).then(async game => {
		if (game.status === C.END_GAME) {
			return res.status(403).json({ message: "la partie est terminé mon poto, faut rentrer maintenant..." });
		} else if (game.status !== C.OPEN) {
			return res.status(403).json({ message: "la partie est déjà commencé... sorry mon poto" });
		} else if (game.players.length >= 25) {
			return res.status(403).json({ message: "25 joueurs max sorry..." });
		} else {
			const idPlayer = new mongoose.Types.ObjectId();
			let player = {
				_id: idPlayer,
				idx: game.players.length.toString().padStart(2, '0'),
				name: name,
				image: "",
				coins: 0,
				credits: [],
				cards: [],
				status: C.ALIVE,
				earringsProbability: 100,
				glassesProbability: 100,
				featuresProbability: 100
			};
			let joinEvent = constructor.event(C.NEW_PLAYER, idPlayer.toString(), C.MASTER, 0, [], Date.now());
			GameModel.findByIdAndUpdate({ _id: idGame },
				{ $push: { players: player, events: joinEvent } },
				{ new: true })
				.then(updatedGame => {
					const newPlayer = updatedGame.players.find(p => p._id == idPlayer.toString());
					socket.emitTo(idGame + C.MASTER, C.NEW_PLAYER, newPlayer);
					return res.status(200).json(player._id);
				}
				)
				.catch(error => {
					log.error(error);
					return res.status(404).json({ message: "Can't Join, game not found" });
				}
				);
		}
	}).catch(error => {
		log.error(error);
		return res.status(404).json({ message: "Game not found" });
	}
	);
};
const update = async (req, res, next) => {
	const player = req.body;
	const idGame = req.body.idGame;
	const idPlayer = player._id

	try {
		if (!idGame && !idPlayer) {
			throw new Error("Bad request");
		}

		// Step 1: Find the document containing the player
		const existingPlayer = await playerService.getPlayer(idGame, idPlayer);

		// Step 2: Check the player's status or any other property
		if (existingPlayer.status === C.DEAD) { // Adjust this check as needed
			throw new Error("Player is DEAD and cannot be updated");
		}
		const game = await GameModel.findOneAndUpdate(
			{ _id: idGame, 'players._id': idPlayer },
			{
				$set: {
					'players.$.name': player.name,
					'players.$.image': player.image,
					'players.$.eyes': player.eyes,
					'players.$.eyebrows': player.eyebrows,
					'players.$.earrings': player.earrings,
					'players.$.features': player.features,
					'players.$.hair': player.hair,
					'players.$.glasses': player.glasses,
					'players.$.mouth': player.mouth,
					'players.$.skinColor': player.skinColor,
					'players.$.hairColor': player.hairColor,
					'players.$.boardConf': player.boardConf,
					'players.$.boardColor': player.boardColor,
				}
			},
			{ new: true, returnOriginal: false });
		const updatedPlayer = game.players.find(p => p._id.toString() === idPlayer);
		socket.emitTo(idGame, C.UPDATED_PLAYER, updatedPlayer);
		return res.status(200).json({ "status": "updated" });
	} catch (e) {
		log.error(e);
		next({
			status: 400,
			message: e
		});
	}
};
const produce = async (req, res, next) => {
	const { idGame, idPlayer, cards } = req.body;

	// Check if the player is already in progress
	if (activeTransactions.has(idGame)) {
		const resultWaitingQueue = await waitForProductionToClear(activeTransactions, idGame);
		if (resultWaitingQueue === 'timeout') {
			return res.status(409).json({ message: 'Producing already in progress' });
		}
	}
	try {
		activeTransactions.add(idGame); // Mark the production as active for this game
		const game = await GameModel.findById(idGame);
		if (!game) {
			return res.status(404).json({ message: "Can't produce, game not found" });
		}

		const player = game.players.find(p => p._id.toString() === idPlayer);
		if (!player) {
			return res.status(404).json({ message: "Can't produce, Player not found" });
		}

		const idsToFilter = cards.map(c => c._id);
		if (!decksService.areCardIdsUnique(idsToFilter, game.amountCardsForProd)) {
			return res.status(400).json({ message: "Can't produce, cards are not unique" });
		}
		const cardsToExchange = player.cards.filter(card => idsToFilter.includes(card._id.toString()));

		if (cardsToExchange.length !== game.amountCardsForProd) {
			return res.status(400).json({ message: "Can't produce, not enough cards" });
		}

		const weight = cardsToExchange[0].weight;

		if (weight >= 3) {
			return res.status(400).json({ message: "Technological change not yet implemented" });
		}

		// Remove cards from player's hand
		await GameModel.updateOne(
			{ _id: idGame, 'players._id': idPlayer },
			{ $pull: { 'players.$.cards': { _id: { $in: cardsToExchange.map(c => c._id) } } } }
		);

		// Add cards back to the deck and shuffle
		const updatedGame = await GameModel.findByIdAndUpdate(
			idGame,
			{ $push: { [`decks.${weight}`]: { $each: cardsToExchange } } },
			{ new: true }
		);

		const shuffledDeck = _.shuffle(updatedGame.decks[weight]);
		const shuffledDeck2 = _.shuffle(updatedGame.decks[weight + 1]);

		const newCards = shuffledDeck.slice(0, game.amountCardsForProd);
		const newCardsIds = newCards.map(c => c._id);
		if (!decksService.areCardIdsUnique(newCardsIds, game.amountCardsForProd)) {
			return res.status(400).json({ message: "Can't produce, cards are not unique" });
		}
		const newCardSup = shuffledDeck2[0];
		const cardsDraw = [...newCards, newCardSup];

		const discardEvent = constructor.event(C.TRANSFORM_DISCARDS, idPlayer, C.MASTER, 0, cardsToExchange, Date.now());
		const newCardsEvent = constructor.event(C.TRANSFORM_NEWCARDS, C.MASTER, idPlayer, 0, cardsDraw, Date.now());

		// Remove drawn cards from decks, add events
		await GameModel.updateOne(
			{ _id: idGame },
			{
				$pull: {
					[`decks.${weight}`]: { _id: { $in: newCards.map(c => c._id) } },
					[`decks.${weight + 1}`]: { _id: newCardSup._id }
				},
				$push: {
					'events': { $each: [discardEvent, newCardsEvent] }
				}
			}
		);

		// Add new cards to player's hand
		await GameModel.updateOne(
			{ _id: idGame, 'players._id': idPlayer },
			{ $push: { 'players.$.cards': { $each: cardsDraw } } }
		);

		if (newCardSup.weight > 2) {
			await gameService.stopRound(idGame, updatedGame.round);
		}

		socket.emitTo(idGame + C.EVENT, C.EVENT, discardEvent);
		socket.emitTo(idGame + C.EVENT, C.EVENT, newCardsEvent);

		activeTransactions.delete(idGame);
		return res.status(200).json(cardsDraw);
	} catch (error) {
		activeTransactions.delete(idGame);
		log.error('Production error:'+ error);
		return next({
			status: 500,
			message: "Production cards error"
		});
	}
};
const transaction = async (req, res, next) => {
	const { idGame, idBuyer, idSeller, idCard } = req.body;
	// Check if the transaction is already in progress
	if (activeTransactions.has(idSeller)) {
		return res.status(409).json({ message: 'Transaction already in progress' });
	}
	activeTransactions.add(idSeller); // Mark the transaction as active

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
		if (buyer.status === C.DEAD || seller.status === C.DEAD) {
			return res.status(400).json({ message: "Transaction cannot involves a dead player, fool !" });
		}

		const card = seller.cards.find(c => c.id === idCard);
		if (!card) {
			return res.status(404).json({ message: "Transaction error, card not found" });
		}

		const cost = game.typeMoney === C.JUNE
			? Number((card.price * game.currentDU).toFixed(2))
			: card.price;
		if (buyer.coins < cost) {
			return res.status(400).json({ message: "Transaction error, Insufficient funds" });
		}

		const eventTransaction = constructor.event(C.TRANSACTION, idBuyer, idSeller, cost, [card], Date.now());

		const updatedGame = await GameModel.findByIdAndUpdate(
			{
				_id: idGame,
				players: {
					$and: [
						{ $elemMatch: { _id: idSeller, 'cards._id': idCard, status: { $ne: C.DEAD } } },
						{ $elemMatch: { _id: idBuyer, coins: { $gte: cost }, status: { $ne: C.DEAD } } }]
				}
			},
			{
				$pull: { 'players.$[seller].cards': { _id: idCard } },
				$inc: {
					'players.$[seller].coins': cost,
					'players.$[buyer].coins': -cost
				},
				$push: {
					'players.$[buyer].cards': card,
					events: eventTransaction
				}
			},
			{
				arrayFilters: [
					{ 'seller._id': idSeller },
					{ 'buyer._id': idBuyer }
				],
				new: true,
			}
		);

		if (!updatedGame) {
			return res.status(400).json({ message: "Transaction failed: conditions not met" });
		}

		buyer.coins = Number((buyer.coins - cost).toFixed(2));
		seller.coins = Number((seller.coins + cost).toFixed(2));

		socket.emitTo(idGame + C.EVENT, C.EVENT, eventTransaction);
		socket.emitTo(idSeller, C.TRANSACTION_DONE, { idCardSold: idCard, coins: seller.coins });

		return res.status(200).json({ buyedCard: card, coins: buyer.coins });
	} catch (error) {
		log.error('Transaction error:'+error);
		activeTransactions.delete(idSeller);
		return res.status(500).json({ message: 'Transaction error' });
	} finally {
		activeTransactions.delete(idSeller);
	}
};
const isReincarnated = async (req, res, next) => {
	const idGame = req.body.idGame;
	const from = req.body.fromId;
	if (!idGame && !from) {
		next({
			status: 400,
			message: "bad request"
		});
	} else {
		GameModel.findById(idGame)
			.then(game => {
				let players = game.players;
				let player = players.find(p => p.reincarnateFromId == from);
				if (player) {
					return res.status(200).json({ playerReIncarnated: player._id });
				} else {
					return res.status(200).json({ playerReIncarnated: null });
				}
			})
			.catch(error => {
				log.error(error);
				next({ status: 404, message: "game Not found" });
			}
			);
	}
};
const joinReincarnate = async (req, res, next) => {
	const { idGame, name, fromId } = req.body;
	try {
		const game = await GameModel.findById(idGame);
		if (!game) {
			log.error('JoinReincarnate error: game not found');
			return res.status(404).json({ message: "Reincarnate error, Game not found" });
		}
		const playerFromId = game.players.find(p => p._id.toString() === fromId);
		if (!playerFromId) {
			log.error('JoinReincarnate error: Player to reincarnate from, not found');
			return res.status(404).json({ message: "Player to reincarnate from, not found" });
		}
		let playerAlreadyReincarnated = game.players.find(p => p.reincarnateFromId === fromId);
		if (playerAlreadyReincarnated) {
			return res.status(200).json(playerAlreadyReincarnated._id);
		}

		const idPlayer = new mongoose.Types.ObjectId();
		const player = {
			_id: idPlayer,
			name,
			idx: game.players.length.toString().padStart(2, '0'),
			coins: 0,
			credits: [],
			cards: [],
			status: C.ALIVE,
			earringsProbability: 100,
			glassesProbability: 100,
			featuresProbability: 100,
			reincarnateFromId: fromId,
			image: playerFromId.image,
			eyes: playerFromId.eyes,
			eyebrows: playerFromId.eyebrows,
			earrings: playerFromId.earrings,
			features: playerFromId.features,
			hair: playerFromId.hair,
			glasses: playerFromId.glasses,
			mouth: playerFromId.mouth,
			skinColor: playerFromId.skinColor,
			hairColor: playerFromId.hairColor,
			boardConf: playerFromId.boardConf,
			boardColor: playerFromId.boardColor,
		};

		let birthEvent;
		const session = await GameModel.startSession();
		await session.withTransaction(async () => {
			const updatedGame = await GameModel.findOneAndUpdate({ _id: idGame }, { $push: { players: player } }, { new: true });
			const shuffledDeck = _.shuffle(updatedGame.decks[0]);
			// Draw new cards for the player
			const newCards = shuffledDeck.slice(0, game.distribInitCards);
			const newCardsIds = newCards.map(c => c._id);
			if (!decksService.areCardIdsUnique(newCardsIds, game.distribInitCards)) {
				log.error('JoinReincarnate error: duplicate new cards');
				return res.status(500).json({ message: "duplicate new cards for reincarnate" });
			}
			//create events
			birthEvent = constructor.event(C.BIRTH, C.MASTER, idPlayer, 0, newCards, Date.now());
			// remove cards from the deck
			// and Add new cards to player's hand & event
			await GameModel.updateOne(
				{ _id: idGame, 'players._id': idPlayer },
				{
					$pull: {
						[`decks.${0}`]: { _id: { $in: newCards.map(c => c._id) } },
					},
					$push: {
						'players.$.cards': { $each: newCards },
						'events': birthEvent,
					},
				}
			);
		});
		session.endSession();

		socket.emitTo(idGame + C.EVENT, C.EVENT, birthEvent);
		socket.emitTo(idGame + C.MASTER, C.NEW_PLAYER, player);
		socket.emitTo(idGame + C.BANK, C.NEW_PLAYER, player);
		return res.status(200).json(player._id);

	} catch (error) {
		log.error('JoinReincarnate error:'+ error);
		return res.status(500).json({ message: "Reincarnate failed" });
	}
};
const addFeedback = async (req, res, next) => {
	const body = req.body;
	const feedback = constructor.feedback(
		body.depressedHappy,
		body.individualCollective,
		body.aloneIntegrated,
		body.greedyGenerous,
		body.competitiveCooperative,
		body.anxiousConfident,
		body.agressiveAvenant,
		body.irritableTolerant,
		body.dependantAutonomous,
	)
	GameModel.findByIdAndUpdate(body.idGame, {
		$set: {
			'players.$[elem].survey': feedback,
		}
	}, {
		arrayFilters: [{ 'elem._id': body.idPlayer }],
		new: true
	}).then((updatedGame) => {
		socket.emitTo(body.idGame, C.NEW_FEEDBACK);
		return res.status(200).json({ "status": "feedback saved" });
	}).catch((error) => {
		log.error(error);
		return res.status(500).json({ message: "Feedback not saved" });
	});
};

export default {
	join,
	joinInGame: async (req, res, next) => {
		//maybe one day...
	},
	isReincarnated,
	joinReincarnate,
	update,
	getById,
	produce,
	transaction,
	addFeedback,
};
