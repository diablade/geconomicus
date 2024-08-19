import GameModel, {constructor} from "../game/game.model.js";
import * as C from "../../../config/constantes.js";
import log from "../../config/log.js";
import _ from "lodash";
import decksService from "../misc/decks.service.js";
import {io} from "../../config/socket.js";
import bankService from "../bank/bank.service.js";
import bankTimerManager from "../bank/BankTimerManager.js";

export default {
	async killPlayer(idGame, idPlayer) {
		const game = await GameModel.findById(idGame);
		let player = _.find(game.players, {id: idPlayer});

		if (game.typeMoney === C.DEBT) {
				const credits = await bankService.getCreditsOfPlayer(idGame, idPlayer);
				for (let credit of credits) {
					await bankTimerManager.stopAndRemoveTimer(credit._id.toString());
					await bankService.seizureOnDead(credit)
				}
		}

		// Remove cards from player's hand & status dead & event
		await decksService.pushCardsInDecks(idGame, player.cards);
		let event = constructor.event(C.DEAD, "master", idPlayer, player.coins, player.cards, Date.now());
		GameModel.updateOne(
			{_id: idGame, 'players._id': idPlayer},
			{
				$pull: {'players.$.cards': {_id: {$in: player.cards.map(c => c.id)}}},
				$set: {'players.$.status': C.DEAD},
				$push: {'events': event},
			},
		).catch(err => {
			log.error('kill player error', err);
		});
		io().to(idPlayer).emit(C.DEAD);
		io().to(idGame + C.EVENT).emit(C.EVENT, event);
		io().to(idGame + C.BANK).emit(C.DEAD, event);
		io().to(idGame + C.MASTER).emit(C.DEAD, event);
	}
}
