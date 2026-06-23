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
import DecksHelper from '../helpers/decks.helper.js';

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

const _getBankIndicators = (gameState) => {
	return {
		bankIndicators: {
			currentMassMonetary: gameState.currentMassMonetary,
			bankInterestEarned: gameState.bankInterestEarned,
			bankMoneyLost: gameState.bankMoneyLost,
			bankMoneyDestroyed: gameState.bankMoneyDestroyed,
			bankGoodsEarned: gameState.bankGoodsEarned,
		},
	};
};

// Helper to instantiate a Timer object for a given credit
const _createCreditTimer = (gameStateId, credit) => {
	log.debug('[BankStateService] creating credit timer');
	return new Timer(
		credit.id,
		{ ...credit, gameStateId },
		credit.remainingTime,
		_creditTimeoutCallback,
		fiveSeconds,
		_creditHeartBeatCallback
	);
};

const _payInterest = async (playerState, credit, entry) => {
	log.debug('[BankStateService] paying interest for credit');
	const { gameState, rules, events } = entry;
	const interest = credit.interest;

	playerState.coins -= interest;
	gameState.currentMassMonetary -= interest;
	gameState.bankInterestEarned += interest;

	credit.extended++;
	credit.remainingTime = rules.durationCredit * minute;
	credit.status = CREDIT_STATUS.RUNNING;

	const event = EventHelper.createEvent(
		DB_EVENTS.CREDIT_EXTENDED,
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
		throw new Error('ERROR.CREDIT_NOT_FOUND');
	}
	if (!playerState) {
		throw new Error('ERROR.PLAYER_NOT_FOUND');
	}
	if (Number(credit.playerStateIdx) !== Number(playerState.idx)) {
		throw new Error('ERROR.OWNERSHIP_CREDIT');
	}
	if (credit.status === CREDIT_STATUS.DONE || credit.status === CREDIT_STATUS.CANCELED) {
		throw new Error('ERROR.CREDIT_ALREADY_DONE_OR_CANCELED');
	}
	return {
		canExtend: credit.interest <= playerState.coins,
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
	log.info(
		`[BankStateService] Prison ended for player ${timerInstance.data.playerStateIdx} in game ${timerInstance.data.gameStateId}`
	);
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
		`[BankStateService] Prison progress for player ${timerInstance.data.playerStateIdx} in game ${timerInstance.data.gameStateId}`
	);
	// TODO: Implement prison progress logic
};

// ─── Timer callbacks ───────────────────────────────────────────────────────────

const _creditTimeoutCallback = async (timerInstance) => {
	log.debug('[BankStateService] timeout credit callback ');
	const gameStateId = timerInstance.data.gameStateId;
	await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		const credit = _findCredit(gameState, timerInstance.data.id);
		if (credit) {
			const playerState = gameState.playersStates.find((ps) => ps.idx === credit.playerStateIdx);
			await creditTimerManager.stopAndRemoveTimer(timerInstance.id);

			const { canSettle, canExtend } = await _whatCanDoCredit(credit, playerState);
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
				socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.REQUEST, { credit });
				socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.REQUEST, {
					credit,
					coinsLK: playerState.coins,
				});
			} else if (canExtend) {
				await _payInterest(playerState, credit, entry);
				const timer = _createCreditTimer(gameStateId, credit);
				await creditTimerManager.startTimer(timer);
				socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.EXTENDED, {
					credit,
					coinsLK: playerState.coins,
				});
				socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.EXTENDED, { credit });
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
				socket.emitTo(ROOMS.gameStateEvents(gameStateId), IO.EVENT, event);
				socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.FAULT, { credit });
				socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.FAULT, { credit });
			}
		} else {
			throw new Error(`Credit not found for player ${playerStateIdx} in timerInstance data`);
		}
	});
};

const _creditHeartBeatCallback = async (timerInstance) => {
	log.debug('[BankStateService] heartbeat credit callback ');
	const remainingMs = timerInstance.getRemainingMs();
	log.debug('[BankStateService] remainingTime: ' + remainingMs);
	socket.emitTo(ROOMS.gameStateBank(timerInstance.data.gameStateId), IO.CREDIT.PROGRESS, {
		id: timerInstance.id,
		remainingTime: remainingMs,
	});
	socket.emitTo(
		ROOMS.playerState(timerInstance.data.gameStateId, timerInstance.data.playerStateIdx),
		IO.CREDIT.PROGRESS,
		{
			id: timerInstance.id,
			remainingTime: remainingMs,
		}
	);
};

// ─── Public API ──────────────────────────────────────────────────────────────

const BankStateService = {};

BankStateService.createCredit = async (gameStateId, playerStateIdx, amount, interest) => {
	log.info(
		`[BankStateService] creating credit for p:${playerStateIdx} in g:${gameStateId} / c:${amount}, i:${interest}`
	);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		const playerState = _findPlayer(gameState, playerStateIdx);
		if (!playerState) {
			throw new Error('Player not found');
		}
		if (playerState.status !== PLAYER_STATUS.ALIVE) {
			throw new Error('Player is not alive or in prison');
		}

		const startNow = gameState.status === GAME_STATUS.PLAYING;

		gameState.creditIndexSeq++;
		const timerId = `credit-${gameStateId}-${playerStateIdx}-${gameState.creditIndexSeq}`;
		const now = new Date();
		const credit = {
			id: timerId,
			amount,
			interest,
			playerStateIdx,
			status: startNow ? CREDIT_STATUS.RUNNING : CREDIT_STATUS.IDLE,
			extended: 0,
			createdAt: now,
			startedAt: startNow ? now : null,
			endAt: null,
			remainingTime: rules.durationCredit * minute,
		};

		// update gameState
		gameState.credits.push(credit);
		gameState.currentMassMonetary += amount;
		playerState.coins += amount;

		if (startNow) {
			const timer = _createCreditTimer(gameStateId, credit);
			creditTimerManager.startTimer(timer);
		}

		events.push(
			EventHelper.createEvent(
				DB_EVENTS.CREDIT_NEW,
				entry.sessionId,
				entry.gameStateId,
				PLAYER_TYPE.BANK,
				playerStateIdx,
				credit
			)
		);

		// socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.NEW, { credit, ..._getBankIndicators(gameState) });
		socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.NEW, {
			credit,
			coinsLK: playerState.coins,
		});

		return {
			credit,
			..._getBankIndicators(gameState),
		};
	});
};

BankStateService.createCreditForAll = async (gameStateId) => {
	log.debug(`[BankStateService] Creating credit for all in game state ${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;
		const playerStates = gameState.playerStates;
		const credits = [];
		for (const playerState of playerStates) {
			if (playerState.status !== PLAYER_STATUS.ALIVE) {
				continue;
			}
			const credit = await BankStateService.createCredit(
				gameStateId,
				playerState.idx,
				rules.creditAmount,
				rules.creditInterest
			);
			credits.push(credit);
		}
		return {
			credits,
			..._getBankIndicators(gameState),
		};
	});
};

BankStateService.freeMoney = async (gameStateId, playerStateIdx, amount) => {
	log.debug(`[BankStateService] Freeing money for player ${playerStateIdx} in game state ${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events } = entry;
		const playerState = _findPlayer(gameState, playerStateIdx);
		if (!playerState || playerState.status !== PLAYER_STATUS.ALIVE) {
			throw new Error('Player state not found or not alive');
		}
		playerState.coins += amount;
		gameState.currentMassMonetary += amount;

		events.push(
			EventHelper.createEvent(
				DB_EVENTS.FREE_MONEY,
				entry.sessionId,
				entry.gameStateId,
				PLAYER_TYPE.BANK,
				playerStateIdx,
				{ coinsLK: playerState.coins, currentMassMonetary: gameState.currentMassMonetary, amount }
			)
		);
		socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.CREDIT.FREE_MONEY, {
			coinsLK: playerState.coins,
			amount,
		});

		return { amount, playerStateIdx, ..._getBankIndicators(gameState) };
	});
};

BankStateService.cancelCredit = async (gameStateId, creditId) => {
	log.debug(`[BankStateService] Canceling credit ${creditId} in game state ${gameStateId}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events } = entry;

		const credit = gameState.credits.find((c) => c.id === creditId);
		if (!credit) {
			throw new Error('Credit not found');
		}
		log.debug(`[BankStateService] Canceling credit ${creditId} for player ${credit.playerStateIdx}`);
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
			EventHelper.createEvent(
				DB_EVENTS.CREDIT_CANCELED,
				entry.sessionId,
				entry.gameStateId,
				PLAYER_TYPE.BANK,
				credit.playerStateIdx,
				credit
			)
		);

		socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.CANCELED, {
			credit,
			coinsLK: playerState.coins,
		});
		socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.CANCELED, {
			credit,
			..._getBankIndicators(gameState),
		});

		return {
			credit,
			..._getBankIndicators(gameState),
		};
	});
};

BankStateService.startAllTimersCreditGame = async (gameStateId, credits) => {
	log.debug(`[BankStateService] Starting all credit timers for game ${gameStateId}`);
	for (const credit of credits) {
		if (credit.status !== CREDIT_STATUS.IDLE) continue;
		const timer = _createCreditTimer(gameStateId, credit);
		await creditTimerManager.startTimer(timer);
		credit.status = CREDIT_STATUS.RUNNING;
		credit.remainingTime = timer.getRemainingMs();
		socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.STARTED, { id: credit.id });
		socket.emitTo(ROOMS.playerState(gameStateId, credit.playerStateIdx), IO.CREDIT.STARTED, { id: credit.id });
	}
};

BankStateService.pauseAllTimersCreditGame = async (gameStateId, credits) => {
	log.debug(`[BankStateService] Pausing all credit timers for game state ${gameStateId}`);
	for (const credit of credits) {
		if (credit.status !== CREDIT_STATUS.RUNNING) continue;
		const remaining = creditTimerManager.stopAndGetRemaining(credit.id);
		if (remaining !== null) {
			credit.remainingTime = remaining;
			credit.status = CREDIT_STATUS.PAUSED;
			log.debug(
				`[BankStateService] Paused credit ${credit.id} for player ${credit.playerStateIdx}, remainingTime: ${credit.remainingTime}`
			);
		}
	}
};

BankStateService.resumeAllTimersCreditGame = async (gameStateId, credits) => {
	log.debug(`[BankStateService] Resuming all credit timers for game ${gameStateId}`);
	for (const credit of credits) {
		if (credit.status !== CREDIT_STATUS.PAUSED && credit.status !== CREDIT_STATUS.IDLE) continue;
		// On recrée depuis le credit (remainingTime est la source de vérité)
		const timer = _createCreditTimer(gameStateId, credit);
		await creditTimerManager.startTimer(timer);
		credit.status = CREDIT_STATUS.RUNNING;
		log.debug(`[CreditTimerManager] Resumed timer for credit ${credit.id}, remaining: ${credit.remainingTime}ms`);
	}
};

BankStateService.stopAllTimersCreditGame = async (gameStateId) => {
	log.debug(`[BankStateService] Stopping all credit timers for game state ${gameStateId}`);
	await creditTimerManager.removeGameTimers(gameStateId);
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
	gameState.bankMoneyDestroyed += totalPayedAmount;
	gameState.bankGoodsEarned += totalSeizedCardsValue;
	gameState.bankInterestEarned += totalPayedInterest;
	gameState.currentMassMonetary -= totalCoinSeized;

	//PUT BACK seized CARDS IN THE DECKs
	await DecksHelper.pushCardsInDecks(gameState, totalSeizedCards);
	// remove seized cards from player's hand
	player.cards = player.cards.filter((card) => !totalSeizedCards.some((c) => c._id.equals(card._id)));

	const event = EventHelper.createEvent(
		DB_EVENTS.CREDIT_SEIZED_DEAD,
		gameState.sessionId,
		gameState._id,
		PLAYER_TYPE.MASTER,
		PLAYER_TYPE.BANK,
		{
			totalCoinSeized,
			interest: totalPayedInterest,
			amount: totalPayedAmount,
			cards: totalSeizedCards,
			bankMoneyLost: totalNotPayed,
			bankMoneyDestroyed: totalPayedAmount,
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
	// 	socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), SEIZURE, {
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
	// 	socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), SEIZURE, {
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

BankStateService.settleCredit = async (gameStateId, creditId, playerStateIdx) => {
	log.debug(`[BankStateService] Settling credit:${creditId} in game:${gameStateId} for player:${playerStateIdx}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events } = entry;

		const credit = gameState.credits.find((c) => c.id === creditId);
		const playerState = _findPlayer(gameState, credit.playerStateIdx);

		const { canSettle } = _whatCanDoCredit(credit, playerState);
		if (!canSettle) {
			throw new Error('ERROR.NOT_ENOUGH_COINS');
		}

		gameState.currentMassMonetary -= credit.amount + credit.interest;
		gameState.bankInterestEarned += credit.interest;
		gameState.bankMoneyDestroyed += credit.amount;
		playerState.coins -= credit.amount + credit.interest;

		credit.status = CREDIT_STATUS.DONE;
		credit.endAt = new Date();
		credit.remainingTime = 0;
		creditTimerManager.stopAndRemoveTimer(credit.id);

		events.push(
			EventHelper.createEvent(
				DB_EVENTS.CREDIT_SETTLED,
				entry.sessionId,
				entry.gameStateId,
				credit.playerStateIdx,
				PLAYER_TYPE.BANK,
				credit
			)
		);

		socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.CREDIT.DONE, {
			credit,
			coinsLK: playerState.coins,
		});
		socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.DONE, {
			credit,
			..._getBankIndicators(gameState),
		});

		return {
			credit,
			coinsLK: playerState.coins,
		};
	});
};

BankStateService.extendCredit = async (gameStateId, creditId, playerStateIdx) => {
	log.debug(`[BankStateService] Extending credit:${creditId} in game:${gameStateId} for player:${playerStateIdx}`);
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, events, rules } = entry;

		const credit = gameState.credits.find((c) => c.id === creditId);
		const playerState = _findPlayer(gameState, credit.playerStateIdx);

		const { canExtend } = _whatCanDoCredit(credit, playerState);
		if (!canExtend) {
			throw new Error('ERROR.NOT_ENOUGH_COINS');
		}

		await _payInterest(playerState, credit, entry);
		creditTimerManager.stopAndRemoveTimer(credit.id);
		if (gameState.status === GAME_STATUS.PLAYING) {
			const timer = _createCreditTimer(gameStateId, credit);
			creditTimerManager.startTimer(timer);
		}

		events.push(
			EventHelper.createEvent(
				DB_EVENTS.CREDIT_EXTENDED,
				entry.sessionId,
				entry.gameStateId,
				playerStateIdx,
				PLAYER_TYPE.BANK,
				credit
			)
		);

		socket.emitTo(ROOMS.gameStateBank(gameStateId), IO.CREDIT.EXTENDED, {
			credit,
			..._getBankIndicators(gameState),
		});

		return {
			credit,
			coinsLK: playerState.coins,
		};
	});
};

BankStateService.prisonBreak = async (gameStateId, playerStateIdx) => {
	const result = await prisonTimerManager.releasePlayer(gameStateId, playerStateIdx);
	return result;
};

export default BankStateService;
