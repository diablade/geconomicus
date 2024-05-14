import GameModel, {constructor} from "../game/game.model.js";
import * as C from "../../../config/constantes.js";
import mongoose from "mongoose";
import {io} from "../../config/socket.js";
import log from "../../config/log.js";
import _ from "lodash";
import Timer from "../misc/Timer.js";
import bankTimerManager from "./BankTimerManager.js";
import {differenceInMilliseconds} from "date-fns";
import BankTimerManager from "./BankTimerManager.js";

const minute = 60 * 1000;
const fiveSeconds = 5 * 1000;

function addDebtTimer(id, startTickNow, duration, data) {
	bankTimerManager.addTimer(new Timer(id, duration * minute, fiveSeconds, data,
		(timer) => {
			let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
			let totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);

			const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
			io().to(timer.data.idGame + C.BANK).emit(C.PROGRESS_CREDIT, {id, progress});
			io().to(timer.data.idPlayer).emit(C.PROGRESS_CREDIT, {id, progress});
		},
		(timer) => {
			timeoutCredit(timer);
		}), startTickNow);
}

function addPrisonTimer(id, duration, data) {
	bankTimerManager.addTimer(new Timer(id, duration * minute, fiveSeconds, data,
		(timer) => {
			let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
			let totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);

			const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
			io().to(timer.data.idGame + C.BANK).emit(C.PROGRESS_PRISON, {id, progress, remainingTime});
			io().to(timer.data.idPlayer).emit(C.PROGRESS_PRISON, {id, progress, remainingTime});
		},
		(timer) => {
			timeoutPrison(timer);
		}), true);
}

async function checkAbilityPayment(idGame, idPlayer, checkAmountToPay) {
	try {
		const game = await GameModel.findById(idGame);
		//TODO OPTIMISE RETURN game to be only player
		const player = _.find(game.players, {id: idPlayer});
		if (!player) {
			throw new Error("Can't find player to check amount to pay");
		}
		return player.coins >= checkAmountToPay;
	} catch (error) {
		log.error('Get game error', error);
		throw error;
	}
}

function checkSolvability(idGame, idPlayer, amountToCheck) {
	//get game credits
	//get player coins and ressources
	// check capabilty with amount and ressources
}

function timeoutCredit(timer) {
	if (timer) {
		const credit = timer.data;
		bankTimerManager.stopAndRemoveTimer(timer.id).then(async () => {
				const canPay = await checkAbilityPayment(credit.idGame, credit.idPlayer, credit.interest);
				if (canPay) {
					let newEvent = constructor.event(C.REQUEST_CREDIT, C.MASTER, credit.idPlayer, credit.amount, [credit], Date.now());
					GameModel.findOneAndUpdate(
						{_id: credit.idGame, 'credits._id': credit._id},
						{
							$set: {'credits.$.status': C.REQUEST_CREDIT},
							$push: {'events': newEvent},
						},
					).then(result => {
						credit.status = C.REQUEST_CREDIT;
						io().to(credit.idGame + C.EVENT).emit(C.EVENT, newEvent);
						io().to(credit.idPlayer).emit(C.TIMEOUT_CREDIT, credit);
						io().to(credit.idGame + C.BANK).emit(C.TIMEOUT_CREDIT, credit);
					}).catch((error) => {
						log.error(error);
					});
				} else {
					let newEvent = constructor.event(C.DEFAULT_CREDIT, C.MASTER, credit.idPlayer, credit.amount, [credit], Date.now());
					GameModel.findOneAndUpdate(
						{_id: credit.idGame, 'credits._id': credit._id},
						{
							$set: {'credits.$.status': C.DEFAULT_CREDIT},
							$push: {'events': newEvent},
						}
					).then(update => {
						credit.status = C.DEFAULT_CREDIT;
						io().to(credit.idGame + C.EVENT).emit(C.EVENT, newEvent);
						io().to(credit.idPlayer).emit(C.DEFAULT_CREDIT, credit);
						io().to(credit.idGame + C.BANK).emit(C.DEFAULT_CREDIT, credit);
					}).catch((error) => {
						log.error(error);
					});
				}
			}
		);
	}
}

async function timeoutPrison(timer) {
	if (timer) {
		const data = timer.data;
		await bankTimerManager.stopAndRemoveTimer(timer.id);
		await getOut(data.idGame,data.idPlayer);
	}
}
async function getOut(idGame,idPlayer) {
	try {
		let game = await GameModel.findById(idGame);
		const shuffledDeck = _.shuffle(game.decks[0]);
		// Draw new cards for the player
		const newCards = shuffledDeck.slice(0, 4);//same weight
		// draw newCards in bdd
		await GameModel.updateOne(
			{_id: idGame},
			{
				$pull: {
					[`decks.${0}`]: {_id: {$in: newCards.map(c => c._id)}},
				}
			}
		);
		// and Add new cards to player's hand and event
		let newEvent = constructor.event(C.PRISON_ENDED, C.MASTER, idPlayer, 0, [newCards], Date.now());
		await GameModel.updateOne(
			{_id: idGame, 'players._id': idPlayer},
			{
				$set: {'players.$.status': C.ALIVE},
				$push: {
					'players.$.cards': {$each: newCards},
					'events': newEvent
				},
			}
		);
		io().to(idGame + C.EVENT).emit(C.EVENT, newEvent);
		io().to(idPlayer).emit(C.PRISON_ENDED, {cards: newCards});
		io().to(idGame + C.BANK).emit(C.PRISON_ENDED, {idPlayer: idPlayer, cards: newCards});
	} catch (error) {
		log.error(error);
	}
}

export default {
	createCredit: async (req, res, next) => {
		const idGame = req.body.idGame;
		const idPlayer = req.body.idPlayer;
		const interest = req.body.interest;
		const amount = req.body.amount;
		if (!idPlayer || !idGame || interest < 0 || amount < 0) {
			next({
				status: 400,
				message: "bad request"
			});
		} else {
			GameModel.findOneAndUpdate(
				{_id: idGame, 'players._id': idPlayer},
				{
					$inc: {'players.$.coins': amount}
				}, {new: true}
			).then(updatedGame => {
				const startNow = updatedGame.status == C.PLAYING
				let id = new mongoose.Types.ObjectId();
				const credit = constructor.credit(
					id,
					amount,
					interest,
					idGame,
					idPlayer,
					startNow ? "running" : "paused",
					Date.now(),
					startNow ? Date.now() : null,
					null
				)
				let newEvent = constructor.event(C.NEW_CREDIT, C.MASTER, idPlayer, amount, [credit], Date.now());
				GameModel.findByIdAndUpdate(idGame, {
					$push: {'credits': credit, 'events': newEvent,},
					$inc: {'currentMassMonetary': amount}
				}, {
					new: true
				}).then((newUpdatedGame) => {
					addDebtTimer(id.toString(), startNow, newUpdatedGame.timerCredit, credit);
					io().to(idGame + C.EVENT).emit(C.EVENT, newEvent);
					io().to(idPlayer).emit(C.NEW_CREDIT, credit);
					res.status(200).json(credit);
				}).catch((error) => {
					log.error(error);
					next({
						status: 404,
						message: "Not found"
					});
				});
			}).catch((error) => {
				log.error(error);
				next({
					status: 404,
					message: "Not found"
				});
			});
		}
	},
	getCreditsByIdPlayer: async (req, res, next) => {
		const idGame = req.params.idGame;
		const idPlayer = req.params.idPlayer;
		if (!idGame && !idPlayer) {
			next({
				status: 400,
				message: "bad request"
			});
		} else {
			GameModel.findById(idGame)
				.then(game => {
					if (game) {
						let credits = _.filter(game.credits, {idPlayer: idPlayer});
						res.status(200).json(credits);
					} else {
						next({
							status: 404,
							message: "Not found"
						});
					}
				})
				.catch(error => {
					log.error('get game error', error);
					next({
						status: 404,
						message: "not found"
					});
				});
		}
	},
	settleCredit: async (req, res, next) => {
		const credit = req.body.credit;
		if (!credit) {
			next({
				status: 400,
				message: "bad request"
			});
		} else {
			try {
				const canPay = await checkAbilityPayment(credit.idGame, credit.idPlayer, (credit.amount + credit.interest));
				if (canPay) {
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

					let creditUpdated = _.find(updatedGame.credits, c => c._id == credit._id);
					await bankTimerManager.stopAndRemoveTimer(credit._id);
					io().to(credit.idGame + C.EVENT).emit(C.EVENT, newEvent);
					io().to(credit.idPlayer).emit(C.CREDIT_DONE, creditUpdated);
					io().to(credit.idGame + C.BANK).emit(C.CREDIT_DONE, creditUpdated);
					res.status(200).json(creditUpdated);
				} else {
					next({
						status: 404,
						message: "Fond insuffisant!"
					});
				}
			} catch (err) {
				log.error(err);
				next({
					status: 400,
					message: "error game"
				});
			}
		}
	},
	payInterest: async (req, res, next) => {
		const credit = req.body.credit;
		if (!credit) {
			next({
				status: 400,
				message: "bad request"
			});
		} else {
			let newEvent = constructor.event(C.PAYED_INTEREST, credit.idPlayer, C.BANK, credit.interest, [credit], Date.now());
			GameModel.findOneAndUpdate(
				{_id: credit.idGame, 'players._id': credit.idPlayer},
				{
					$inc: {
						"players.$.coins": -credit.interest,
						'currentMassMonetary': -credit.interest,
						'bankInterestEarned': credit.interest
					},
					$push: {'events': newEvent}
				}, {new: true}
			).then(updatedGame => {
				if (updatedGame) {
					GameModel.findOneAndUpdate(
						{_id: credit.idGame, 'credits._id': credit._id},
						{
							$set: {'credits.$.status': C.RUNNING_CREDIT},
							$inc: {'credits.$.extended': 1},
						}, {new: true}
					).then(updatedGame => {
							if (updatedGame) {
								const creditUpdated = _.find(updatedGame.credits, c => c._id == credit._id);
								addDebtTimer(credit._id, true, updatedGame.timerCredit, creditUpdated);
								io().to(credit.idGame + C.EVENT).emit(C.EVENT, newEvent);
								io().to(credit.idGame).emit(C.PAYED_INTEREST, creditUpdated);
								res.status(200).json(creditUpdated);
							}
						}
					).catch((error) => {
						log.error(error);
						next({
							status: 404,
							message: "coins updated but credit not found ??"
						});
					});
				} else {
					log.error('Not enough coins to remove or player not found.');
				}
			}).catch((error) => {
				log.error(error);
				next({
					status: 404,
					message: "Not found"
				});
			});
		}
	},
	seizure: async (req, res, next) => {
		const credit = req.body.credit;
		const seizure = req.body.seizure;
		if (!credit && !seizure) {
			next({status: 400, message: "bad request"});
		} else {
			try {
				let newEvent = constructor.event(C.SEIZURE, credit.idPlayer, C.BANK, seizure.coins, seizure.cards, Date.now());
				// remove card and coins of player
				await GameModel.updateOne(
					{_id: credit.idGame, 'players._id': credit.idPlayer},
					{
						$pull: {'players.$.cards': {_id: {$in: seizure.cards.map(c => c._id)}}},
						$inc: {'players.$.coins': -seizure.coins},
						$push: {'events': newEvent},
					}
				);

				const groupedCards = _.groupBy(_.sortBy(seizure.cards, 'weight'), 'weight');
				//PUT BACK CARDS IN THE DECKs
				await GameModel.updateOne(
					{_id: credit.idGame},
					{
						$push: {
							[`decks.${0}`]: {$each: groupedCards[0] ? groupedCards[0] : []},
							[`decks.${1}`]: {$each: groupedCards[1] ? groupedCards[1] : []},
							[`decks.${2}`]: {$each: groupedCards[2] ? groupedCards[2] : []},
							[`decks.${3}`]: {$each: groupedCards[3] ? groupedCards[3] : []},
						},
					}
				);
				// remove coins MMonetary and update status credit
				await GameModel.updateOne(
					{_id: credit.idGame, 'credits._id': credit._id},
					{
						$inc: {'currentMassMonetary': -seizure.coins},
						$set: {
							'credits.$.status': C.CREDIT_DONE,
							'credits.$.endDate': Date.now(),
						},
					}
				);
				credit.status = C.CREDIT_DONE;
				credit.endDate = Date.now();
				io().to(credit.idGame + C.EVENT).emit(C.EVENT, newEvent);
				// PRISON OU PAS ...
				if (seizure.prisonTime && seizure.prisonTime > 0) {
					let newEvent2 = constructor.event(C.PRISON, C.BANK, credit.idPlayer, seizure.prisonTime, [], Date.now());
					GameModel.findOneAndUpdate(
						{_id: credit.idGame, 'players._id': credit.idPlayer},
						{
							$set: {'players.$.status': C.PRISON},
							$push: {'events': newEvent2},
						}, {new: true}
					).then(updatedGame => {
						let prisoner = _.find(updatedGame.players, p => p._id == credit.idPlayer);
						addPrisonTimer(credit.idPlayer, seizure.prisonTime, {
							idPlayer: credit.idPlayer,
							idGame: credit.idGame
						})
						io().to(credit.idGame + C.EVENT).emit(C.EVENT, newEvent2);
						io().to(credit.idPlayer).emit(C.SEIZURE, {
							credit: credit,
							seizure: seizure,
							prisoner: prisoner
						});
						res.status(200).json({credit: credit, prisoner: prisoner, seizure: seizure});
					});
				} else {
					io().to(credit.idPlayer).emit(C.SEIZURE, {credit: credit, seizure: seizure});
					res.status(200).json({credit: credit, seizure: seizure});
				}
			} catch (e) {
				log.error(e);
				next({status: 500, message: e});
			}
		}
	},
	resetIdGameDebtTimers(idGame) {
		bankTimerManager.stopAndRemoveAllIdGameDebtTimer(idGame);
	},
	startCreditsByIdGame(idGame) {
		GameModel.updateMany(
			{_id: idGame, 'credits.status': C.PAUSED_CREDIT},
			{
				$set: {'credits.$[].status': C.RUNNING_CREDIT},
			}, {new: true}
		).then(updatedGame => {
			bankTimerManager.startAllIdGameDebtTimer(idGame);
			io().to(idGame).emit(C.CREDITS_STARTED);
		}).catch((error) => {
			log.error(error);
		});
	},
	iveGotToBreakFree: async (req, res, next) => {
		const idGame = req.body.idGame;
		const idPlayerToFree = req.body.idPlayerToFree;
		if (!idPlayerToFree && !idGame) {
			next({status: 400, message: "bad request"});
		} else {
			try {
				let timer = await BankTimerManager.getTimer(idPlayerToFree);
				if (timer) {
					timeoutPrison(timer);
				} else {
					getOut(idGame,idPlayerToFree);
				}
				res.status(200).json({});
			} catch (e) {
				log.error(e);
				next({status: 500, message: e});
			}
		}
	}
}
