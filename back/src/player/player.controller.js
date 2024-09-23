import GameModel, {constructor} from '../game/game.model.js';
import log from '../../config/log.js';
import _ from 'lodash';
import mongoose from "mongoose";
import {io} from '../../config/socket.js';
import * as C from '../../../config/constantes.js';
import gameService from "../game/game.service.js";
import decksService from "../misc/decks.service.js";
import playerService from "./player.service.js";

const getById = async (req, res, next) => {
	const {idGame, idPlayer} = req.params;

	try {
		const player = await playerService.getPlayer(idGame, idPlayer,true);
		res.status(200).json(player);
	} catch (e) {
		next({
			status: 400,
			message: e.message
		});
	}
};
const join = async (req, res, next) => {
	const id = req.body.idGame;
	const name = req.body.name;
	if (!id && !name) {
		next({
			status: 400,
			message: "bad request"
		});
	} else {
		GameModel.findById(id).then(async game => {
			if (game.status === C.END_GAME) {
				next({status: 400, message: "la partie est terminé mon poto, faut rentrer maintenant..."})
			} else if (game.status !== C.OPEN) {
				next({status: 400, message: "la partie est déjà commencé... sorry mon poto"})
			} else if (game.players.length >= 25) {
				next({status: 400, message: "25 joueurs max sorry..."});
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
				GameModel.findByIdAndUpdate({_id: id},
					{$push: {players: player, events: joinEvent}},
					{new: true})
					.then(updatedGame => {
							const newPlayer = _.find(updatedGame.players, p => p._id == idPlayer.toString());
							io().to(id + C.MASTER).emit(C.NEW_PLAYER, newPlayer);
							res.status(200).json(player._id);
						}
					)
					.catch(error => {
							log.error(error);
							next({status: 404, message: "can't add player, game Not found"});
						}
					);
			}
		}).catch(error => {
				log.error(error);
				next({status: 404, message: "Game Not found"});
			}
		);
	}
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
			{_id: idGame, 'players._id': idPlayer},
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
			{new: true, returnOriginal: false});
		const updatedPlayer = _.find(game.players, p => p._id === idPlayer);
		io().to(idGame).emit(C.UPDATED_PLAYER, updatedPlayer);
		res.status(200).json({"status": "updated"});
	} catch (e) {
		log.error(e);
		next({
			status: 400,
			message: e
		});
	}
};
const produce = async (req, res, next) => {
	const {idGame, idPlayer, cards} = req.body;

	if (!idGame || !idPlayer || !cards || cards.length < 3 ||
		cards[0].weight !== cards[1].weight || cards[0].letter !== cards[1].letter) {
		return next({
			status: 400,
			message: "Bad request: invalid input"
		});
	}
	try {

		const game = await GameModel.findById(idGame);
		if (!game) {
			throw new Error("Game not found");
		}


		const player = _.find(game.players, {id: idPlayer});
		if (!player) {
			throw new Error("Player not found");
		}

		const idsToFilter = cards.map(c => c._id);
		if (!decksService.areCardIdsUnique(idsToFilter, game.amountCardsForProd)) {
			throw new Error("Incorrect cards for production");
		}
		const cardsToExchange = _.filter(player.cards, card => _.includes(idsToFilter, card._id.toString()));

		if (cardsToExchange.length !== game.amountCardsForProd) {
			throw new Error("Incorrect number of cards for production");
		}

		const weight = cardsToExchange[0].weight;

		if (weight >= 3) {
			throw new Error("Technological change not yet implemented");
		}

		const session = await GameModel.startSession();
		try {
			await session.withTransaction(async () => {
				// Remove cards from player's hand
				await GameModel.updateOne(
					{_id: idGame, 'players._id': idPlayer},
					{$pull: {'players.$.cards': {_id: {$in: cardsToExchange.map(c => c._id)}}}}
				);

				// Add cards back to the deck and shuffle
				const updatedGame = await GameModel.findByIdAndUpdate(
					idGame,
					{$push: {[`decks.${weight}`]: {$each: cardsToExchange}}},
					{new: true}
				);

				const shuffledDeck = _.shuffle(updatedGame.decks[weight]);
				const shuffledDeck2 = _.shuffle(updatedGame.decks[weight + 1]);

				const newCards = shuffledDeck.slice(0, game.amountCardsForProd);
				const newCardsIds = newCards.map(c => c._id);
				if (!decksService.areCardIdsUnique(newCardsIds, game.amountCardsForProd)) {
					throw new Error("Incorrect new cards for production");
				}
				const newCardSup = shuffledDeck2[0];
				const cardsDraw = [...newCards, newCardSup];

				const discardEvent = constructor.event(C.TRANSFORM_DISCARDS, idPlayer, C.MASTER, 0, cardsToExchange, Date.now());
				const newCardsEvent = constructor.event(C.TRANSFORM_NEWCARDS, C.MASTER, idPlayer, 0, cardsDraw, Date.now());

				// Remove drawn cards from decks, add events
				await GameModel.updateOne(
					{_id: idGame},
					{
						$pull: {
							[`decks.${weight}`]: {_id: {$in: newCards.map(c => c._id)}},
							[`decks.${weight + 1}`]: {_id: newCardSup._id}
						},
						$push: {
							'events': {$each: [discardEvent, newCardsEvent]}
						}
					}
				);

				// Add new cards to player's hand
				await GameModel.updateOne(
					{_id: idGame, 'players._id': idPlayer},
					{$push: {'players.$.cards': {$each: cardsDraw}}}
				);

				if (newCardSup.weight > 2) {
					await gameService.stopRound(idGame, updatedGame.round);
				}

				io().to(idGame + C.EVENT).emit(C.EVENT, discardEvent);
				io().to(idGame + C.EVENT).emit(C.EVENT, newCardsEvent);

				res.status(200).json(cardsDraw);
			});
		} finally {
			session.endSession();
		}
	} catch (error) {
		log.error('Production error:', error);
		next({
			status: 400,
			message: "Production cards error"
		});
	}
};
const transaction = async (req, res, next) => {
	const {idGame, idBuyer, idSeller, idCard} = req.body;
	if (!idGame || !idBuyer || !idSeller || !idCard) {
		return next({
			status: 400,
			message: "Bad request: missing required fields"
		});
	}

	try {
		const game = await GameModel.findById(idGame);
		if (!game) {
			throw new Error("Game not found");
		}

		const buyer = _.find(game.players, {id: idBuyer});
		const seller = _.find(game.players, {id: idSeller});
		if (!buyer || !seller) {
			throw new Error("Buyer or seller not found");
		}

		const card = _.find(seller.cards, {id: idCard});
		if (!card) {
			throw new Error("Card not found");
		}

		if (buyer.status === C.DEAD || seller.status === C.DEAD) {
			throw new Error("Transaction involves a dead player");
		}

		const cost = game.typeMoney === C.JUNE
			? _.round(_.multiply(card.price, game.currentDU), 2)
			: card.price;
		if (buyer.coins < cost) {
			throw new Error("Insufficient funds");
		}

		const newEvent = constructor.event(C.TRANSACTION, idBuyer, idSeller, cost, [card], Date.now());

		const session = await GameModel.startSession();
		await session.withTransaction(async () => {
			await GameModel.updateOne(
				{_id: idGame, 'players._id': idSeller},
				{
					$pull: {'players.$.cards': {_id: idCard}},
					$inc: {'players.$.coins': cost}
				}
			);

			await GameModel.updateOne(
				{_id: idGame, 'players._id': idBuyer},
				{
					$push: {'players.$.cards': card},
					$inc: {'players.$.coins': -cost}
				}
			);

			await GameModel.updateOne(
				{_id: idGame},
				{$push: {'events': newEvent}}
			);
		});
		session.endSession();

		buyer.coins = _.round(buyer.coins - cost, 2);
		seller.coins = _.round(seller.coins + cost, 2);

		io().to(idGame + C.EVENT).emit(C.EVENT, newEvent);
		io().to(idSeller).emit(C.TRANSACTION_DONE, {idCardSold: idCard, coins: seller.coins});

		res.status(200).json({buyedCard: card, coins: buyer.coins});
	} catch (error) {
		console.error('Transaction error:', error);
		next({
			status: 400,
			message: error.message || "Transaction error"
		});
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
				let player = _.find(players, p => p.reincarnateFromId == from);
				if (player) {
					res.status(200).json({playerReIncarnated: player._id});
				} else {
					res.status(200).json({playerReIncarnated: null});
				}
			})
			.catch(error => {
					log.error(error);
					next({status: 404, message: "game Not found"});
				}
			);
	}
};
const joinReincarnate = async (req, res, next) => {
	const {idGame, name, fromId} = req.body;

	if (!idGame || !name || !fromId) {
		return next({
			status: 400,
			message: "Bad request: missing game ID or player name"
		});
	}
	try {
		const game = await GameModel.findById(idGame);
		if (!game) {
			throw new Error("Game not found");
		}
		const playerFromId = _.find(game.players, p => p._id.toString() === fromId);
		if (!playerFromId) {
			throw new Error("PlayerReincarnated from not found");
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
			const updatedGame = await GameModel.findOneAndUpdate({_id: idGame}, {$push: {players: player}}, {new: true});
			const shuffledDeck = _.shuffle(updatedGame.decks[0]);
			// Draw new cards for the player
			const newCards = shuffledDeck.slice(0, game.amountCardsForProd);
			const newCardsIds = newCards.map(c => c._id);
			if (!decksService.areCardIdsUnique(newCardsIds, game.amountCardsForProd)) {
				throw new Error("duplicate new cards for reincarnate");
			}
			// remove cards from the deck
			await GameModel.updateOne(
				{_id: idGame},
				{
					$pull: {
						[`decks.${0}`]: {_id: {$in: newCards.map(c => c._id)}},
					},
				}
			);
			//create events
			birthEvent = constructor.event(C.BIRTH, C.MASTER, idPlayer, 0, newCards, Date.now());
			// and Add new cards to player's hand & event
			await GameModel.updateOne(
				{_id: idGame, 'players._id': idPlayer},
				{
					$push: {
						'players.$.cards': {$each: newCards},
						'events': birthEvent,
					}
				}
			);
		});
		session.endSession();

		io().to(idGame + C.EVENT).emit(C.EVENT, birthEvent);
		io().to(idGame + C.MASTER).emit(C.NEW_PLAYER, player);
		io().to(idGame + C.BANK).emit(C.NEW_PLAYER, player);
		res.status(200).json(player._id);

	} catch (error) {
		log.error('JoinReincarnate error:', error);
		next({
			status: 404,
			message: "Reincarnate failed"
		});
	}
};
const addFeedback = async (req, res, next) => {
	const idGame = req.body.idGame;
	const idPlayer = req.body.idPlayer;
	const body = req.body;
	if (!idGame && !idPlayer) {
		next({
			status: 400,
			message: "bad request"
		});
	} else {
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
		GameModel.findByIdAndUpdate(idGame, {
			$set: {
				'players.$[elem].survey': feedback,
			}
		}, {
			arrayFilters: [{'elem._id': idPlayer}],
			new: true
		}).then((updatedGame) => {
			io().to(idGame).emit(C.NEW_FEEDBACK);
			res.status(200).json({"status": "feedback saved"});
		}).catch((error) => {
			log.error(error);
			next({
				status: 404,
				message: "Not found"
			});
		});
	}
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
