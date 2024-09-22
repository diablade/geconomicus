import GameModel, {constructor} from "../game/game.model.js";
import _ from "lodash";
import * as C from "../../../config/constantes.js";
import bankTimerManager from "./BankTimerManager.js";
import {io} from "../../config/socket.js";
import log from "../../config/log.js";
import decksService from "../misc/decks.service.js";
import playerService from "../player/player.service.js";

const checkAbilityPayment = async (idGame, idPlayer, checkAmountToPay) => {
	try {
		const player = await playerService.getPlayer(idGame, idPlayer);
		if (!player) {
			throw new Error("Can't find player to check amount to pay");
		}
		return {player: player, canPay: player.coins >= checkAmountToPay && player.status !== C.DEAD};
	} catch (error) {
		log.error(error);
		throw error;
	}
}

// Function to seize cards to match the target amount cardsValue
const seizeCards = (cards, targetAmount) => {
	// Sort the player's cards by price in descending order
	const sortedCards = _.sortBy(cards, 'price').reverse();

	let seizedCards = [];
	let remainingAmount = targetAmount;

	// Seize cards until the target amount is reached
	for (let card of sortedCards) {
		if (remainingAmount <= 0) break; // Stop if the target is met

		if (card.price <= remainingAmount) {
			seizedCards.push(card); // Add card to seized list
			remainingAmount -= card.price; // Reduce the target by card's price
		}
	}
	return seizedCards;
};

const getRunningCreditsOfPlayer = async (idGame, idPlayer) => {
	try {
		const game = await GameModel.findById(idGame.toString());
		return _.filter(game.credits, credit => credit.idPlayer === idPlayer && credit.status !== C.CREDIT_DONE);
	} catch (error) {
		log.error(error);
		throw error;
	}
}

const seizureOnDead = async (idGame, idPlayer) => {
	try {
		let player = await playerService.getPlayer(idGame, idPlayer);
		let cardsValue = _.reduce(player.cards, (acc, c) => c.price + acc, 0);
		let credits = await getRunningCreditsOfPlayer(idGame, idPlayer);

		let totalPayedInterest = 0;
		let totalPayedAmount = 0;
		let totalValuesToSeize = 0;
		let totalNotPayed = 0; //rest that is not payed by coins or cards

		for (let credit of credits) {
			let payedInterest = 0;
			let payedAmount = 0;
			let seizureCardsValue = 0;

			// FIRST PAY INTEREST
			if ((player.coins - credit.interest) >= 0) {
				payedInterest = credit.interest;
				player.coins -= credit.interest;
				credit.interest = 0;
			} else {
				//seizure on cards
				if (cardsValue >= credit.interest) {
					cardsValue -= credit.interest;
					seizureCardsValue += credit.interest;
					credit.interest = 0;
				} else {
					seizureCardsValue += cardsValue;
					cardsValue = 0;
					credit.interest -= cardsValue;
				}
			}

			//SECOND PAY CREDIT AMOUNT
			if ((player.coins - credit.amount) >= 0) {
				player.coins -= credit.amount;
				payedAmount += credit.amount;
				credit.amount = 0;
			} else {
				//seizure on cards
				if (cardsValue >= credit.amount) {
					cardsValue -= credit.amount;
					seizureCardsValue += credit.amount;
					credit.amount = 0;
				} else {
					seizureCardsValue += cardsValue;
					credit.amount -= cardsValue;
					cardsValue = 0;
				}
			}

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
			totalPayedInterest += payedInterest;
			totalPayedAmount += payedAmount;
			totalValuesToSeize += seizureCardsValue;
			totalNotPayed += (credit.interest + credit.amount);
		}

		//convert value to cards
		let totalSeizedCards = seizeCards(player.cards, totalValuesToSeize);
		let totalSeizedCardsValue = _.reduce(totalSeizedCards, (acc, c) => c.price + acc, 0);
		let totalPayedInCoins = totalPayedInterest + totalPayedAmount;

		//PUT BACK seized CARDS IN THE DECKs
		await decksService.pushCardsInDecks(idGame, totalSeizedCards);
		// remove seized cards from player's hand
		// user update, bank update, and MMonetary update
		let event = constructor.event(C.SEIZED_DEAD, "master", idPlayer, totalPayedInCoins, totalSeizedCards, Date.now());
		GameModel.updateOne(
			{_id: idGame, 'players._id': idPlayer},
			{
				$inc: {
					'players.$.coins': -totalPayedInCoins,
					'bankInterestEarned': totalPayedInterest,
					'bankGoodsEarned': totalSeizedCardsValue,
					'bankMoneyLost': totalNotPayed,
					'currentMassMonetary': -totalPayedInCoins
				},
				$pull: {'players.$.cards': {_id: {$in: totalSeizedCards.map(c => c.id)}}},
				$push: {'events': event},
			},
		);
	} catch (err) {
		log.error(err);
		throw new Error("seizure on dead failed");
	}
}

const settleCredit = async (credit) => {
	try {
		const check = await checkAbilityPayment(credit.idGame, credit.idPlayer, (credit.amount + credit.interest));
		if (check.canPay) {
			await GameModel.findOneAndUpdate(
				{_id: credit.idGame, 'players._id': credit.idPlayer},
				{
					$inc: {
						'players.$.coins': -(credit.interest + credit.amount),
						'bankInterestEarned': credit.interest,
						'currentMassMonetary': -credit.amount
					},
				});

			let newEvent = constructor.event(C.SETTLE_CREDIT, credit.idPlayer, C.BANK, (credit.interest + credit.amount), [credit], Date.now());
			const updatedGame = await GameModel.findOneAndUpdate(
				{_id: credit.idGame, 'credits._id': credit._id},
				{
					$set: {'credits.$.status': C.CREDIT_DONE, 'credits.$.endDate': Date.now()},
					$push: {'events': newEvent},
				}, {new: true});

			let creditUpdated = _.find(updatedGame.credits, c => c._id.toString() === credit._id);
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
		throw err;
	}
}

export default {
	getRunningCreditsOfPlayer,
	checkAbilityPayment,
	seizureOnDead,
	settleCredit,
}
