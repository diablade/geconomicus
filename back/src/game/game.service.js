import GameModel, {constructor} from "../game/game.model.js";
import _ from "lodash";
import gameTimerManager from "./GameTimerManager.js";
import * as C from "../../../config/constantes.js";
import bankTimerManager from "../bank/BankTimerManager.js";
import {io} from "../../config/socket.js";
import log from "../../config/log.js";

export default {
	async stopRound(idGame, gameRound) {
		gameTimerManager.stopAndRemoveTimer(idGame);
		gameTimerManager.stopAndRemoveTimer(idGame+"death");
		let stopRoundEvent = constructor.event(C.STOP_ROUND, C.MASTER, "", gameRound, [], Date.now());
		GameModel.updateOne({_id: idGame}, {
			$set: {
				status: C.STOP_ROUND,
				modified: Date.now(),
			},
			$push: {events: stopRoundEvent}
		})
			.then(res => {
				bankTimerManager.stopAndRemoveAllIdGameDebtTimer(idGame);
				io().to(idGame).emit(C.STOP_ROUND);
				io().to(idGame + C.EVENT).emit(C.EVENT, stopRoundEvent);
			})
			.catch(err => {
				log.error('stop round game error', err);
			})
	}
}
