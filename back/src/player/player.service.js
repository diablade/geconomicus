import GameModel, {constructor} from "../game/game.model.js";
import * as C from "../../../config/constantes.js";
import log from "../../config/log.js";
import _ from "lodash";
import decksService from "../misc/decks.service.js";
import {io} from "../../config/socket.js";
import bankService from "../bank/bank.service.js";
import bankTimerManager from "../bank/BankTimerManager.js";

const killPlayer = async (idGame, idPlayer) => {
	try {
		const game = await GameModel.findById(idGame);
		if (game.typeMoney === C.DEBT) {
			//stop timer of player's credits
			await bankTimerManager.stopAllPlayerDebtsTimer(idGame, idPlayer);
			//start seizure for any debt
			await bankService.seizureOnDead(idGame, idPlayer);
		}
		// get updated player
		let player = await getPlayer(idGame, idPlayer);
		// push the rest of cards in decks
		await decksService.pushCardsInDecks(idGame, player.cards);

		// remove all cards from player's hand , give status dead & create event
		let event = constructor.event(C.DEAD, "master", idPlayer, player.coins, player.cards, Date.now());
		GameModel.updateOne(
			{_id: idGame, 'players._id': idPlayer},
			{
				$pull: {'players.$.cards': {_id: {$in: player.cards.map(c => c.id)}}},
				$set: {'players.$.status': C.DEAD},
				$push: {'events': event},
			},
		);
		io().to(idPlayer).emit(C.DEAD);
		io().to(idGame + C.EVENT).emit(C.EVENT, event);
		io().to(idGame + C.BANK).emit(C.DEAD, event);
		io().to(idGame + C.MASTER).emit(C.DEAD, event);
	} catch (e) {
		log.error('kill player error:', e);
		throw new Error("kill player failed");
	}
}
const getPlayer = async (idGame, idPlayer) => {
	try {
		if (!idPlayer || !idGame) {
			throw new Error("Bad request: missing game ID or player ID");
		}

		const game = await GameModel.findById(idGame);
		if (!game) {
			throw new Error("Game not found");
		}

		const player = _.find(game.players, {id: idPlayer});
		if (!player) {
			throw new Error("Player not found");
		}
		return ({
			player: player,
			statusGame: game.status,
			typeMoney: game.typeMoney,
			currentDU: game.currentDU,
			amountCardsForProd: game.amountCardsForProd
		});
	} catch (error) {
		log.error("GetPlayer: " + error);
		throw error;
	}
}

export default {
	killPlayer,
	getPlayer,
}
