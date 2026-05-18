import _ from 'lodash';
import bankTimerManager from './../managers/BankTimerManager.js';
import socket from '#config/socket';
import log from '#config/log';
import DecksStateHelper from '../helpers/decks.state.helper.js';
import Timer from '../../misc/Timer.js';
import { differenceInMilliseconds } from 'date-fns';
import { CREDIT_STATUS, PLAYER_TYPE, ROOMS } from '@geco/shared';
import EventService from '../../event/event.service.js';
import { DB_EVENTS } from '@geco/shared';

const minute = 60 * 1000;
const fiveSeconds = 5 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────

const _findPlayer = (state, playerLifeIdx) => {
	const player = state.playersStates.find((p) => p.idx === playerLifeIdx);
	if (!player) throw new Error(`Player idx ${playerLifeIdx} not found`);
	return player;
};

const _findCredit = (state, creditIdx) => {
	const credit = state.credits.find((c) => idx === creditIdx);
	if (!credit) throw new Error(`Credit idx ${creditIdx} not found`);
	return credit;
};

const _findCreditsOfPlayer = (state, playerStateIdx) => {
	const credits = state.credits.filter((c) => c.playerStateIdx === playerStateIdx);
	return credits;
};

const _seizeCards = (cards, targetAmount) => {
	// Function to seize cards to match the target amount cardsValue
	// Sort the player's cards by price in descending order
	const sortedCards = _.sortBy(cards, 'price').reverse();

	let seizedCards = [];
	let remainingAmount = targetAmount;

	// Seize cards until the target amount is reached
	for (let card of sortedCards) {
		if (remainingAmount <= 0) {
			break;
		} // Stop if the target is met

		if (card.price <= remainingAmount) {
			seizedCards.push(card); // Add card to seized list
			remainingAmount -= card.price; // Reduce the target by card's price
		}
		0;
	}
	return seizedCards;
};

const _canDoCreditAction = (credit, playerState, action) => {
	if (!credit) {
		throw new Error("Can't find credit to check amount to pay");
	}
	if (!playerState) {
		throw new Error("Can't find player to check amount to pay");
	}
	if (credit.playerStateIdx !== playerState.idx) {
		throw new Error('Player is not the owner of this credit');
	}
	if (credit.status === CREDIT_STATUS.DONE) {
		throw new Error('Credit is already done');
	}
	if (action === CREDIT_STATUS.SETTLE) {
		return {
			canPay: credit.amount + credit.interest <= playerState.coins,
		};
	}
	if (action === CREDIT_STATUS.PAY_INTEREST) {
		return {
			canPay: credit.interest <= playerState.coins,
		};
	}
	if (action === CREDIT_STATUS.SEIZURE) {
		return {
			canPay: credit.status === CREDIT_STATUS.DEFAULT,
		};
	}
	throw new Error('Invalid credit action');
};

const _timeoutCredit = async (timer) => {
	//     if (timer) {
	//         const credit = timer.data;
	//         await bankTimerManager.stopAndRemoveTimer(timer.id).then(async () => {
	//             getCreditOnActionPayment(credit.idGame, credit.idPlayer, credit._id.toString(), PAY_INTEREST)
	//                 .then(({
	//                            credit,
	//                            player,
	//                            canPay
	//                        }) => {
	//                     if (credit && canPay) {
	//                         let newEvent = constructor.event(REQUEST_CREDIT, MASTER, credit.idPlayer, credit.amount, [credit], Date.now());
	//                         GameModel.findOneAndUpdate({
	//                             _id:           credit.idGame,
	//                             "credits._id": credit._id
	//                         }, {
	//                             $set:  {"credits.$.status": REQUEST_CREDIT},
	//                             $push: {events: newEvent},
	//                         })
	//                             .then((result) => {
	//                                 credit.status = REQUEST_CREDIT;
	//                                 socket.emitTo(credit.idGame + EVENT, EVENT, newEvent);
	//                                 socket.emitAckTo(credit.idPlayer, TIMEOUT_CREDIT, {credit});
	//                                 socket.emitTo(credit.idGame + BANK, TIMEOUT_CREDIT, credit);
	//                             })
	//                             .catch((error) => {
	//                                 log.error(error);
	//                             });
	//                     }
	//                     else {
	//                         let newEvent = constructor.event(DEFAULT_CREDIT, MASTER, credit.idPlayer, credit.amount, [credit], Date.now());
	//                         GameModel.findOneAndUpdate({
	//                             _id:           credit.idGame,
	//                             "credits._id": credit._id
	//                         }, {
	//                             $set:  {"credits.$.status": DEFAULT_CREDIT},
	//                             $push: {events: newEvent},
	//                         })
	//                             .then((update) => {
	//                                 credit.status = DEFAULT_CREDIT;
	//                                 socket.emitTo(credit.idGame + EVENT, EVENT, newEvent);
	//                                 socket.emitTo(credit.idGame + BANK, DEFAULT_CREDIT, credit);
	//                                 if (credit && player.status !== DEAD) {
	//                                     socket.emitAckTo(credit.idPlayer, DEFAULT_CREDIT, {credit});
	//                                 }
	//                             })
	//                             .catch((error) => {
	//                                 log.error(error);
	//                             });
	//                     }
	//                 });
	//         });
	//     }
};
const _getOut = async (idGame, idPlayer) => {
	//     try {
	//         let game = await GameModel.findById(idGame);
	//         const shuffledDeck = _.shuffle(game.decks[0]);
	//         // Draw new cards for the player
	//         const newCards = shuffledDeck.slice(0, 4); //same weight
	//         // draw newCards in bdd
	//         await GameModel.updateOne({_id: idGame}, {
	//             $pull: {
	//                 [`decks.${0}`]: {_id: {$in: newCards.map((c) => _id)}},
	//             },
	//         });
	//         // and Add new cards to player's hand and event
	//         let newEvent = constructor.event(PRISON_ENDED, MASTER, idPlayer, 0, newCards, Date.now());
	//         await GameModel.updateOne({
	//             _id:           idGame,
	//             "players._id": idPlayer
	//         }, {
	//             $set:  {"players.$.status": ALIVE},
	//             $push: {
	//                 "players.$.cards": {$each: newCards},
	//                 events:            newEvent,
	//             },
	//         });
	//         socket.emitTo(idGame + EVENT, EVENT, newEvent);
	//         socket.emitAckTo(idPlayer, PRISON_ENDED, {cards: newCards});
	//         socket.emitTo(idGame + BANK, PRISON_ENDED, {
	//             idPlayer: idPlayer,
	//             cards:    newCards,
	//         });
	//     }
	//     catch (err) {
	//         log.error(err);
	//     }
};

const lockDownPlayer = async (idPlayer, idGame, prisonTime) => {
	//     let event = constructor.event(PRISON, BANK, idPlayer, prisonTime, [], Date.now());
	//     const updatedGame = await GameModel.findOneAndUpdate({
	//         _id:           idGame,
	//         "players._id": idPlayer
	//     }, {
	//         $set:  {"players.$.status": PRISON},
	//         $push: {events: event},
	//     }, {new: true});
	//     let prisoner = updatedGame.players.find(p => p._id.toString() === idPlayer);
	//     addPrisonTimer(idPlayer, prisonTime, {
	//         idPlayer: idPlayer,
	//         idGame:   idGame,
	//     });
	//     return {
	//         prisoner,
	//         event
	//     };
};

// ─── Timer callbacks ───────────────────────────────────────────────────────────

const _creditTimeoutCallback = async (timerInstance) => {
	const gameStateId = timerInstance.data.gameStateId;
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		(timer) => {
			timeoutCredit(timer);
		};
	});
};

const _creditHeartBeatCallback = async (timerInstance) => {
	let remainingTime = differenceInMilliseconds(timerInstance.endTime, new Date());
	let totalTime = differenceInMilliseconds(timerInstance.endTime, timerInstance.startTime);

	const elapsed = Date.now() - timerInstance.startTime;
	const remainingMs = timerInstance.duration - elapsed;
	const remainingSeconds = Math.ceil(remainingMs / 1000);
	const remainingMinutes = Math.ceil(remainingSeconds / 60);
	const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
	socket.emitTo(ROOMS.gameState(timerInstance.data.gameStateId), PROGRESS_CREDIT, {
		id: timerInstance.id,
		progress,
	});
	socket.emitTo(
		ROOMS.playerState(
			timerInstance.data.gameStateId,
			timerInstance.data.avatarIdx,
			timerInstance.data.playerStateIdx
		),
		PROGRESS_CREDIT,
		{
			id: timerInstance.id,
			progress,
		}
	);
};

const _prisonEndCallback = async (timerInstance) => {
	log.info(`Prison ended for player ${timerInstance.data.playerStateIdx} in game ${timerInstance.data.gameStateId}`);
	// TODO: Implement prison end logic
	// const getOut = async (idGame, idPlayer) => {
	//     try {
	//         let game = await GameModel.findById(idGame);
	//         const shuffledDeck = _.shuffle(game.decks[0]);
	//         // Draw new cards for the player
	//         const newCards = shuffledDeck.slice(0, 4); //same weight
	//         // draw newCards in bdd
	//         await GameModel.updateOne({_id: idGame}, {
	//             $pull: {
	//                 [`decks.${0}`]: {_id: {$in: newCards.map((c) => _id)}},
	//             },
	//         });
	//         // and Add new cards to player's hand and event
	//         let newEvent = constructor.event(PRISON_ENDED, MASTER, idPlayer, 0, newCards, Date.now());
	//         await GameModel.updateOne({
	//             _id:           idGame,
	//             "players._id": idPlayer
	//         }, {
	//             $set:  {"players.$.status": ALIVE},
	//             $push: {
	//                 "players.$.cards": {$each: newCards},
	//                 events:            newEvent,
	//             },
	//         });
	//         socket.emitTo(idGame + EVENT, EVENT, newEvent);
	//         socket.emitAckTo(idPlayer, PRISON_ENDED, {cards: newCards});
	//         socket.emitTo(idGame + BANK, PRISON_ENDED, {
	//             idPlayer: idPlayer,
	//             cards:    newCards,
	//         });
	//     }
	//     catch (err) {
	//         log.error(err);
	//     }
	// }
};

const _prisonProgressCallback = async (timerInstance) => {
	log.info(
		`Prison progress for player ${timerInstance.data.playerStateIdx} in game ${timerInstance.data.gameStateId}`
	);
	// TODO: Implement prison progress logic
};

// ─── Public API ──────────────────────────────────────────────────────────────

const BankStateService = {};

/**
 * Create a credit for a player.
 * Adds coins (amount) to player, pushes credit into state.credits,
 * updates currentMassMonetary, starts a debt timer.
 */
BankStateService.createCredit = async (gameStateId, playerStateIdx, amount, interest, startNow) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		const playerState = _findPlayer(gameState, playerStateIdx);

		gameState.creditIndexSeq++;
		const id = `credit-${gameStateId}-${playerStateIdx}-${gameState.creditIndexSeq}`;
		const credit = {
			idx: gameState.creditIndexSeq,
			amount,
			interest,
			playerStateIdx,
			status: startNow ? CREDIT_STATUS.RUNNING : CREDIT_STATUS.PAUSED,
			extended: 0,
			createdAt: new Date(),
			startedAt: startNow ? new Date() : null,
			endAt: startNow ? new Date(Date.now() + rules.creditDuration * 60 * 1000) : null,
			timerLeft: rules.creditDuration * 60 * 1000,
		};
		events.push(EventService.createEventObject(DB_EVENTS.CREDIT_CREATED, entry.sessionId, entry.gameStateId, PLAYER_TYPE.BANK, playerStateIdx, credit));

		bankTimerManager.addTimer(
			new Timer(
				id,
				rules.timerCredit * minute,
				fiveSeconds,
                null,
				credit,
				this._creditHeartBeatCallback,
                null,
				this._creditTimeoutCallback
			),
			startNow
		);

		return {
			playerState,
			gameState: {
				typeMoney: gameState.typeMoney,
				status: gameState.status,
				currentDU: gameState.currentDU || 0,
				currentMassMonetary: gameState.currentMassMonetary || 0,
			},
			rules,
			credits,
			defaultCredit,
		};
	});
};

BankStateService.startCreditsOfGame = async (idGame) => {
	//     GameModel.updateMany({
	//         _id:              idGame,
	//         "credits.status": PAUSED_CREDIT
	//     }, {
	//         $set: {"credits.$[].status": RUNNING_CREDIT},
	//     }, {new: true})
	//         .then((updatedGame) => {
	//             bankTimerManager.startAllIdGameDebtTimer(idGame);
	//             socket.emitTo(idGame + BANK, CREDITS_STARTED);
	//         })
	//         .catch((error) => {
	//             log.error(error);
	//         });
};

BankStateService.seizureOnDead = async (gameState, rules, player) => {
	let cardsValue = _.reduce(player.cards, (acc, c) => price + acc, 0);
	await bankTimerManager.stopPlayerDebtsTimer(gameState._id, player.idx);
	let credits = _findCreditsOfPlayer(gameState, player.idx);

	let totalPayedInterest = 0;
	let totalPayedAmount = 0;
	let totalValuesToSeize = 0;
	let totalNotPayed = 0; //rest that is not payed by coins or cards

	for (let credit of credits) {
		let payedInterest = 0;
		let payedAmount = 0;
		let seizureCardsValue = 0;

		// FIRST PAY INTEREST
		if (player.coins - credit.interest >= 0) {
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
		if (player.coins - credit.amount >= 0) {
			player.coins -= credit.amount;
			payedAmount += credit.amount;
			credit.amount = 0;
		} else {
			// seize the rest coins
			credit.amount -= player.coins;
			payedAmount += player.coins;
			player.coins = 0;
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

		totalPayedInterest += payedInterest;
		totalPayedAmount += payedAmount;
		totalValuesToSeize += seizureCardsValue;
		totalNotPayed += credit.interest + credit.amount;

		credit.status = CREDIT_STATUS.DONE;
	}

	//convert value to cards
	let totalSeizedCards = _seizeCards(player.cards, totalValuesToSeize);
	let totalSeizedCardsValue = _.reduce(totalSeizedCards, (acc, card) => card.price + acc, 0);
	let totalCoinSeized = totalPayedInterest + totalPayedAmount;

	gameState.bankMoneyLost += totalNotPayed;
	gameState.bankGoodsEarned += totalSeizedCardsValue;
	gameState.bankInterestEarned += totalPayedInterest;
	gameState.currentMassMonetary -= totalCoinSeized;

	//PUT BACK seized CARDS IN THE DECKs
	await DecksStateHelper.pushCardsInDecks(gameState, totalSeizedCards);
	// remove seized cards from player's hand
	player.cards = player.cards.filter((card) => !totalSeizedCards.some((c) => c._id.equals(card._id)));

	EventService.postNow(DB_EVENTS.CREDIT_SEIZED_DEAD, sessionId, gameState._id, PLAYER_TYPE.MASTER, PLAYER_TYPE.BANK, {
		totalCoinSeized,
		interest: totalPayedInterest,
		amount: totalPayedAmount,
		cards: totalSeizedCards,
		bankMoneyLost: totalNotPayed,
		bankGoodsEarned: totalSeizedCardsValue,
	});
	return gameState;
};

BankStateService.seizure = async (gameStateId, creditIdx, playerStateIdx, seizure) => {
	// let { credit, canPay } = await getCreditOnActionPayment(idGame, idPlayer, idCredit, SEIZURE);
	// if (!canPay) {
	// 	throw new Error('wrong credit');
	// }
	// let newEvent = constructor.event(SEIZURE, idPlayer, BANK, seizure.coins, seizure.cards, Date.now());
	// let interestSeized = seizure.interest >= seizure.coins ? seizure.interest : 0;
	// let cardsValue = seizure.cards.reduce((acc, c) => price + acc, 0);
	// // remove card and coins of player
	// await GameModel.updateOne(
	// 	{
	// 		_id: idGame,
	// 		'players._id': idPlayer,
	// 	},
	// 	{
	// 		$pull: {
	// 			'players.$.cards': {
	// 				_id: { $in: seizure.cards.map((c) => _id) },
	// 			},
	// 		},
	// 		$inc: { 'players.$.coins': -seizure.coins },
	// 		$push: { events: newEvent },
	// 	}
	// );
	// //PUT BACK CARDS IN THE DECKs
	// await decksService.pushCardsInDecks(idGame, seizure.cards);
	// // remove coins MMonetary and update status credit
	// await GameModel.updateOne(
	// 	{
	// 		_id: idGame,
	// 		'credits._id': idCredit,
	// 	},
	// 	{
	// 		$inc: {
	// 			currentMassMonetary: -seizure.coins,
	// 			bankInterestEarned: +interestSeized,
	// 			bankGoodsEarned: cardsValue,
	// 		},
	// 		$set: {
	// 			'credits.$.status': CREDIT_DONE,
	// 			'credits.$.endDate': Date.now(),
	// 		},
	// 	}
	// );
	// credit.status = CREDIT_DONE;
	// credit.endDate = Date.now();
	// socket.emitTo(ROOMS.gameStateMaster(gameStateId), EVENT, newEvent);
	// // PRISON OU PAS ...
	// const addPrisonTimer = (id, duration, data) => {
	//     bankTimerManager.addTimer(new Timer(id, duration * minute, fiveSeconds, data, (timer) => {
	//         let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
	//         let totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);
	//         const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
	//         socket.emitTo(timer.data.idGame + BANK, PROGRESS_PRISON, {
	//             id,
	//             progress,
	//             remainingTime,
	//         });
	//         socket.emitTo(timer.data.idPlayer, PROGRESS_PRISON, {
	//             id,
	//             progress,
	//             remainingTime,
	//         });
	//     }, (timer) => {
	//         timeoutPrison(timer);
	//     }), true);
	// }
	// if (seizure.prisonTime && seizure.prisonTime > 0) {
	// 	const result = await lockDownPlayer(idPlayer, idGame, seizure.prisonTime);
	// 	socket.emitTo(ROOMS.gameStateBank(gameStateId), EVENT, result.event);
	// 	socket.emitAckTo(ROOMS.playerState(gameStateId, avatarIdx, playerStateIdx), SEIZURE, {
	// 		credit: credit,
	// 		seizure: seizure,
	// 		prisoner: result.prisoner,
	// 	});
	// 	return {
	// 		credit: credit,
	// 		seizure: seizure,
	// 		prisoner: result.prisoner,
	// 	};
	// } else {
	// 	socket.emitAckTo(ROOMS.playerState(gameStateId, avatarIdx, playerStateIdx), SEIZURE, {
	// 		credit: credit,
	// 		seizure: seizure,
	// 		prisoner: undefined,
	// 	});
	// 	return {
	// 		credit: credit,
	// 		seizure: seizure,
	// 		prisoner: undefined,
	// 	};
	// }
};

BankStateService.settleCredit = async (gameStateId, creditIdx, playerStateIdx) => {
	// try {
	// const {
	//     credit,
	//     canPay
	// } = await getCreditOnActionPayment(idGame, idPlayer, idCredit, SETTLE_CREDIT);
	// if (canPay) {
	//     let newEvent = constructor.event(SETTLE_CREDIT, credit.idPlayer, BANK, (credit.interest + credit.amount), [credit], Date.now());
	//     const updatedGame = await GameModel.findOneAndUpdate({
	//         _id:           credit.idGame,
	//         'players._id': idPlayer,
	//         'credits._id': credit._id.toString(),
	//     }, {
	//         $inc:  {
	//             'players.$.coins':     -(credit.interest + credit.amount),
	//             'bankInterestEarned':  credit.interest,
	//             'currentMassMonetary': -(credit.interest + credit.amount)
	//         },
	//         $set:  {
	//             'credits.$[c].status':  CREDIT_DONE,
	//             'credits.$[c].endDate': Date.now()
	//         },
	//         $push: {'events': newEvent},
	//     }, {
	//         new:          true,
	//         arrayFilters: [{'_id': credit._id.toString()}]
	//     });
	//     let creditUpdated = updatedGame.credits.find(c => _id.toString() === credit._id.toString());
	//     await bankTimerManager.stopAndRemoveTimer(credit._id.toString());
	//     socket.emitTo(idGame + EVENT, EVENT, newEvent);
	//     socket.emitAckTo(idPlayer, CREDIT_DONE, {credit:creditUpdated});
	//     socket.emitTo(idGame + BANK, CREDIT_DONE, {credit:creditUpdated});
	//     return creditUpdated;
	// }
	// else {
	//     return undefined;
	// }
	// }
	// catch (err) {
	// log.error(err);
	// throw err;
	// }
};

BankStateService.payInterest = async (gameStateId, creditIdx, playerStateIdx) => {
	// const {
	//     credit,
	//     canPay
	// } = await getCreditOnActionPayment(idGame, idPlayer, idCredit, PAY_INTEREST);
	// if (!canPay) {
	//     throw new Error("Not enough coins to pay interest.");
	// }
	// const newEvent = constructor.event(PAYED_INTEREST, idPlayer, BANK, credit.interest, [credit], Date.now());
	// const updatedGameAfterCoins = await GameModel.findOneAndUpdate({
	//     _id:           idGame,
	//     "players._id": idPlayer
	// }, {
	//     $inc:  {
	//         "players.$.coins":   -credit.interest,
	//         currentMassMonetary: -credit.interest,
	//         bankInterestEarned:  credit.interest,
	//     },
	//     $push: {events: newEvent},
	// }, {new: true});
	// if (!updatedGameAfterCoins) {
	//     throw new Error("Player not found or insufficient coins.");
	// }
	// const updatedGameAfterCredit = await GameModel.findOneAndUpdate({
	//     _id:           idGame,
	//     "credits._id": credit._id
	// }, {
	//     $set: {"credits.$.status": RUNNING_CREDIT},
	//     $inc: {"credits.$.extended": 1},
	// }, {new: true});
	// if (!updatedGameAfterCredit) {
	//     throw new Error("Credit not found for update.");
	// }
	// const creditUpdated = updatedGameAfterCredit.credits.find(c => _id.toString() === credit._id.toString());
	// if (!creditUpdated) {
	//     throw new Error("Updated credit not found after update.");
	// }
	// addDebtTimer(credit._id.toString(), true, updatedGameAfterCredit.timerCredit, creditUpdated);
	// socket.emitTo(idGame + EVENT, EVENT, newEvent);
	// socket.emitTo(idGame + BANK, PAYED_INTEREST, creditUpdated);
	// return creditUpdated;
};

BankStateService.prisonBreak = async (gameStateId, playerStateIdx) => {
    await bankTimerManager.stopAllIdGameDebtTimer(gameStateId);
    return false;
};

export default BankStateService;
