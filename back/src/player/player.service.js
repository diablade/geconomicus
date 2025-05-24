import GameModel, { constructor } from "../game/game.model.js";
import * as C from "../../../config/constantes.js";
import log from "../../config/log.js";
import decksService from "../misc/decks.service.js";
import socket from "../../config/socket.js";
import bankService from "../bank/bank.service.js";
import bankTimerManager from "../bank/BankTimerManager.js";

const killPlayer = async (idGame, idPlayer) => {
	try {
		const game = await GameModel.findById(idGame);
		if (game.typeMoney === C.DEBT) {
			//stop timer of player's credits
			await bankTimerManager.stopAllPlayerDebtsTimer(idGame, idPlayer);
			//start seizure for any debt
			let event = await bankService.seizureOnDead(idGame, idPlayer);
			socket.emitTo(idGame + C.EVENT, C.EVENT, event);
			socket.emitTo(idGame + C.BANK, C.SEIZED_DEAD, event);
		}
		// get updated player
		let player = await getPlayer(idGame, idPlayer);
		// push the rest of cards in decks
		await decksService.pushCardsInDecks(idGame, player.cards);

		// create event & give status dead
		let event = constructor.event(C.DEAD, "master", idPlayer, player.coins, player.cards, Date.now());
		await GameModel.updateOne(
			{ _id: idGame, 'players._id': idPlayer },
			{
				$set: { 'players.$.status': C.DEAD },
				$push: { 'events': event },
			},
		);
		socket.emitTo(idPlayer, C.DEAD);
		socket.emitTo(idGame + C.EVENT, C.EVENT, event);
		socket.emitTo(idGame + C.BANK, C.DEAD, event);
		socket.emitTo(idGame + C.MASTER, C.DEAD, event);
	} catch (e) {
		log.error('kill player error:' + e);
		throw new Error("kill player failed");
	}
}
const getPlayer = async (idGame, idPlayer, statusGames = false) => {
	try {
		if (!idPlayer || !idGame) {
			throw new Error("Bad request: missing game ID or player ID");
		}

		const game = await GameModel.findById(idGame);
		if (!game) {
			throw new Error("Game not found");
		}

		const player = game.players.find(p => p.id === idPlayer);
		if (!player) {
			throw new Error("Player not found");
		}
		if (statusGames) {
			return ({
				player: player,
				statusGame: game.status,
				typeMoney: game.typeMoney,
				currentDU: game.currentDU,
				timerCredit: game.timerCredit,
				amountCardsForProd: game.amountCardsForProd
			});
		} else {
			return player;
		}
	} catch (error) {
		log.error("GetPlayer: " + error);
		throw error;
	}
}

async function join(game, name) {
	if (game.status === C.END_GAME) {
		throw new Error("Game is finished");
	} else if (game.status !== C.OPEN) {
		throw new Error("Game is already started");
	} else if (game.players.length >= 25) {
		throw new Error("25 players max");
	} else {
		const idPlayer = new mongoose.Types.ObjectId();
		let player = {
			_id: idPlayer,
			idx: game.players.length + 1,
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
		let updatedGame = await GameModel.findByIdAndUpdate(
			{ _id: game._id },
			{ $push: { players: player, events: joinEvent } },
			{ new: true })
		if (updatedGame) {
			const newPlayer = updatedGame.players.find(p => p._id == idPlayer.toString());
			socket.emitTo(game._id + C.MASTER, C.NEW_PLAYER, newPlayer);
			return player._id;
		}
		else {
			throw new Error("Join game error: game not found");
		}
	}
}

export default {
	killPlayer,
	getPlayer,
	join
}
