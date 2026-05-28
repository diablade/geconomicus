import _ from 'lodash';
import GameStateManager from '../managers/GameStateManager.js';
import creditTimerManager from '../managers/CreditTimerManager.js';
import prisonTimerManager from '../managers/PrisonTimerManager.js';
import socket from '#config/socket';
import log from '#config/log';
import Timer from '../../misc/Timer.js';
import { differenceInMilliseconds } from 'date-fns';
import { CREDIT_STATUS, GAME_STATUS, PLAYER_TYPE, PLAYER_STATUS, ROOMS, IO, DB_EVENTS } from '@geco/shared';
import EventHelper from '../helpers/event.helper.js';

const minute = 60 * 1000;
const fiveSeconds = 5 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────

const _findPlayer = (state, playerLifeIdx) => {
	const player = state.playersStates.find((p) => p.idx === playerLifeIdx);
	if (!player) throw new Error(`Player idx ${playerLifeIdx} not found`);
	return player;
};

const _findCredit = (gameState, creditId) => {
	const credit = gameState.credits.find((c) => c.id === creditId);
	if (!credit) throw new Error(`Credit idx ${creditId} not found`);
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

// Helper to instantiate a Timer object for a given credit
const _createCreditTimer = (gameStateId, credit, rules) => {
	return new Timer(
		credit.id,
		{ ...credit, gameStateId },
		rules.timerCredit * minute,
		_creditTimeoutCallback,
		fiveSeconds,
		_creditHeartBeatCallback
	);
};

const _payInterest = async (playerState, credit, entry) => {
	const { gameState, rules, events } = entry;
	const interest = credit.interest;
	playerState.coins -= interest;
	credit.extended++;
	credit.endAt = Date.now() + rules.timerCredit * minute;
	credit.timerLeft = rules.timerCredit * minute;
	credit.status = CREDIT_STATUS.RUNNING;

	const event = EventHelper.createEvent(
		DB_EVENTS.CREDIT_PAYED_INTEREST,
		gameState.sessionId,
		gameState.id,
		PLAYER_TYPE.BANK,
		playerState.idx,
		credit
	);
	events.push(event);
};

const _whatCanDoCredit = (credit, playerState) => {
	if (!credit) {
		throw new Error("Can't find credit to check amount to pay");
	}
	if (!playerState) {
		throw new Error("Can't find player to check amount to pay");
	}
	if (credit.playerStateIdx !== playerState.idx) {
		throw new Error('Player is not the owner of this credit');
	}
	if (credit.status === CREDIT_STATUS.DONE || credit.status === CREDIT_STATUS.CANCELED) {
		throw new Error('Credit is already done or canceled');
	}
	return {
		canPayInterest: credit.interest <= playerState.coins,
		canSettle: credit.amount + credit.interest <= playerState.coins,
	};
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

// ─── Timer callbacks ───────────────────────────────────────────────────────────

const _creditTimeoutCallback = async (timerInstance) => {
	const gameStateId = timerInstance.data.gameStateId;
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		const credit = _findCredit(gameState, timerInstance.data.id);
		if (credit) {
			await creditTimerManager.stopAndRemoveTimer(timerInstance.id);
			const playerState = gameState.playersStates.find((ps) => ps.idx === credit.playerStateIdx);
			if (!playerState) {
				throw new Error(`Player state not found for credit ${credit.id}`);
			}
			const { canSettle, canPayInterest } = await _whatCanDoCredit(credit, playerState);

			if (canSettle) {
				// requesting settle credit or pay interest
				const event = EventHelper.createEvent(
					DB_EVENTS.CREDIT_REQUEST,
					gameState.sessionId,
					gameStateId,
					PLAYER_TYPE.BANK,
					playerState.idx,
					credit
				);
				events.push(event);
				credit.status = CREDIT_STATUS.REQUESTING;
				socket.emitTo(ROOMS.gameState(gameStateId), event);
				socket.emitAckTo(
					ROOMS.playerState(gameStateId, playerState.avatarIdx, playerState.idx),
					IO.CREDIT.REQUEST,
					{ credit }
				);
				socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.REQUEST, credit);
			} else if (canPayInterest) {
				// paying interest
				await _payInterest(playerState, credit, entry);
				// restart timer
				const timer = _createCreditTimer(gameState.id, credit, rules);
				await creditTimerManager.startTimer(timer);
				socket.emitAckTo(
					ROOMS.playerState(gameStateId, playerState.avatarIdx, playerState.idx),
					IO.CREDIT.PAYED_INTEREST,
					credit
				);
				socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.PAYED_INTEREST, credit);
			} else {
				// bankrup payment
				const event = EventHelper.createEvent(
					DB_EVENTS.CREDIT_FAULT,
					gameState.sessionId,
					gameStateId,
					PLAYER_TYPE.BANK,
					playerState.idx,
					credit
				);
				events.push(event);
				credit.status = CREDIT_STATUS.FAULT;
				socket.emitTo(ROOMS.gameState(gameStateId), event);
				socket.emitAckTo(
					ROOMS.playerState(gameStateId, playerState.avatarIdx, playerState.idx),
					IO.CREDIT.FAULT,
					{ credit }
				);
				socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.FAULT, credit);
			}
		} else {
			throw new Error(`Credit not found for player ${playerStateIdx} in timerInstance data`);
		}
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

// ─── Public API ──────────────────────────────────────────────────────────────

const BankStateService = {};

/**
 * Create a credit for a player.
 * Adds coins (amount) to player, pushes credit into state.credits,
 * updates currentMassMonetary, starts a debt timer.
 */
BankStateService.createCredit = async (gameStateId, playerStateIdx, amount, interest) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		const playerState = _findPlayer(gameState, playerStateIdx);
		if (!playerState) {
			throw new Error('Player not found');
		}
		if (playerState.status !== PLAYER_STATUS.ALIVE) {
			throw new Error('Player is not alive or in prison');
		}

		const startNow = gameState.status === GAME_STATUS.RUNNING;

		gameState.creditIndexSeq++;
		const timerId = `credit-${gameStateId}-${playerStateIdx}-${gameState.creditIndexSeq}`;
		const credit = {
			id: timerId,
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

		// update gameState
		gameState.credits.push(credit);
		gameState.currentMassMonetary += amount;
		playerState.coins += amount;

		if (startNow) {
			const timer = _createCreditTimer(gameStateId, credit, rules, true);
			creditTimerManager.startTimer(timer);
		}

		events.push(
			EventHelper.createEvent(
				DB_EVENTS.CREDIT_CREATED,
				entry.sessionId,
				entry.gameStateId,
				PLAYER_TYPE.BANK,
				playerStateIdx,
				credit,
				Date().now()
			)
		);

		socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.NEW, { credit });
		socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.avatarIdx, playerStateIdx), IO.CREDIT.NEW, {
			credit,
		});

		return {
			currentMassMonetary: gameState.currentMassMonetary || 0,
			credit,
		};
	});
};

BankStateService.cancelCredit = async (gameStateId, creditId) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events } = entry;

		const credit = gameState.credits.find((c) => c.id === creditId);
		if (!credit) {
			throw new Error('Credit not found');
		}
		const playerState = _findPlayer(gameState, credit.playerStateIdx);
		if (!playerState) {
			throw new Error('Player state not found');
		}
		if (playerState.coins < credit.amount) {
			throw new Error('Not enough coins');
		}

		gameState.currentMassMonetary -= credit.amount;
		playerState.coins -= credit.amount;
		credit.status = CREDIT_STATUS.CANCELED;
		credit.endAt = new Date();
		creditTimerManager.stopAndRemoveTimer(credit.id);

		events.push(
			EventHelper.createEventObject(
				DB_EVENTS.CREDIT_CANCELED,
				entry.sessionId,
				entry.gameStateId,
				PLAYER_TYPE.BANK,
				credit.playerStateIdx,
				credit
			)
		);

		socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.avatarIdx, playerState.idx), IO.CREDIT.CANCELED, {
			credit,
		});
		socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.CANCELED, { credit });

		return {
			credit,
		};
	});
};

BankStateService.startCreditsTimersOfGame = async (gameStateId, credits = [], rules) => {
	for (const credit of credits) {
		if (credit.status === CREDIT_STATUS.IDLE || credit.status === CREDIT_STATUS.PAUSED) {
			const timer = _createCreditTimer(gameStateId, credit, rules);
			creditTimerManager.startTimer(timer);
		}
	}
};

BankStateService.seizureOnDead = async (gameState, events, player) => {
	let cardsValue = _.reduce(player.cards, (acc, card) => card.price + acc, 0);
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
	await DecksHelper.pushCardsInDecks(gameState, totalSeizedCards);
	// remove seized cards from player's hand
	player.cards = player.cards.filter((card) => !totalSeizedCards.some((c) => c._id.equals(card._id)));

	const event = EventHelper.createEvent(
		DB_EVENTS.CREDIT_SEIZED_DEAD,
		sessionId,
		gameState._id,
		PLAYER_TYPE.MASTER,
		PLAYER_TYPE.BANK,
		{
			totalCoinSeized,
			interest: totalPayedInterest,
			amount: totalPayedAmount,
			cards: totalSeizedCards,
			bankMoneyLost: totalNotPayed,
			bankGoodsEarned: totalSeizedCardsValue,
		}
	);
	events.push(event);
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
	const result = await prisonTimerManager.releasePlayer(gameStateId, playerStateIdx);
	return result;
};

export default BankStateService;
