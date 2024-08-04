import GameModel, {constructor} from "../game/game.model.js";
import _ from "lodash";
import * as C from "../../../config/constantes.js";
import bankTimerManager from "./BankTimerManager.js";
import {io} from "../../config/socket.js";
import log from "../../config/log.js";
import decksService from "../misc/decks.service.js";

async function checkAbilityPayment(idGame, idPlayer, checkAmountToPay) {
	try {
		const game = await GameModel.findById(idGame);
		//TODO OPTIMISE RETURN game to be only player
		const player = _.find(game.players, {id: idPlayer});
		if (!player) {
			throw new Error("Can't find player to check amount to pay");
		}
		return {player: player, canPay: player.coins >= checkAmountToPay && player.status !== C.DEAD};
	} catch (error) {
		log.error('Get game error', error);
		throw error;
	}
}

export default {
	getCreditsOfPlayer: async (idGame, idPlayer) => {
		const game = await GameModel.findById(idGame);
		// const game = await GameService.getGame(idGame);
		if (game) {
			return _.filter(game.credits, {idPlayer: idPlayer});
		} else {
			return [];
		}
	},
	checkAbilityPayment: async (idGame, idPlayer, checkAmountToPay) => {
		await checkAbilityPayment(idGame,idPlayer,checkAmountToPay);
	},
	seizureOnDead: async (credit)=> {
		try {
			const check = await checkAbilityPayment(credit.idGame, credit.idPlayer, (credit.amount + credit.interest));
			let debt = credit.amount + credit.interest;
			let values = check.player.coins + _.reduce(check.player.cards, (acc, c) => c.price + acc, 0);
			let canPayInterest = (values - debt) >=0;
			// remove coins , update MMonetary and bank
			const game = await GameModel.findOneAndUpdate(
				{_id: credit.idGame, 'players._id': credit.idPlayer},
				{
					$set: {'players.$.coins': 0},
					$inc: {
						'bankInterestEarned': canPayInterest ? credit.interest: 0,
						'currentMassMonetary': -check.player.coins
					},
				}, {new: true});
			//PUT BACK ALL CARDS IN THE DECKs
			await decksService.pushCardsInDecks(credit.idGame, check.player.cards);
			// update status credit
			await GameModel.updateOne(
				{_id: credit.idGame, 'credits._id': credit._id},
				{
					$set: {
						'credits.$.status': C.CREDIT_DONE,
						'credits.$.endDate': Date.now(),
					},
				}
			);
			credit.status = C.CREDIT_DONE;
			credit.endDate = Date.now();
		} catch (err) {
			log.error(err);
			return undefined;
		}
	},
	settleCredit: async (credit) => {
		try {
			const check = await this.checkAbilityPayment(credit.idGame, credit.idPlayer, (credit.amount + credit.interest));
			if (check.canPay) {
				const game = await GameModel.findOneAndUpdate(
					{_id: credit.idGame, 'players._id': credit.idPlayer},
					{
						$inc: {
							'players.$.coins': -(credit.interest + credit.amount),
							'bankInterestEarned': credit.interest,
							'currentMassMonetary': -credit.amount
						},
					}, {new: true});

				let newEvent = constructor.event(C.SETTLE_CREDIT, credit.idPlayer, C.BANK, (credit.interest + credit.amount), [credit], Date.now());
				const updatedGame = await GameModel.findOneAndUpdate(
					{_id: credit.idGame, 'credits._id': credit._id},
					{
						$set: {'credits.$.status': C.CREDIT_DONE, 'credits.$.endDate': Date.now()},
						$push: {'events': newEvent},
					}, {new: true});

				let creditUpdated = _.find(updatedGame.credits, c => c._id === credit._id);
				await bankTimerManager.stopAndRemoveTimer(credit._id);
				io().to(credit.idGame + C.EVENT).emit(C.EVENT, newEvent);
				io().to(credit.idPlayer).emit(C.CREDIT_DONE, creditUpdated);
				io().to(credit.idGame + C.BANK).emit(C.CREDIT_DONE, creditUpdated);
				return creditUpdated;
			} else {
				return undefined;
			}
		} catch (err) {
			log.error(err);
			return undefined;
		}
	}
}
