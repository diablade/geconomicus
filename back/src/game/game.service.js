import GameModel, {constructor} from "../game/game.model.js";
import _ from "lodash";
import gameTimerManager from "./GameTimerManager.js";
import * as C from "../../../config/constantes.js";
import bankTimerManager from "../bank/BankTimerManager.js";
import socket from "../../config/socket.js";
import log from "../../config/log.js";
import Timer from "../misc/Timer.js";
import {differenceInMilliseconds} from "date-fns";
import BankController from "../bank/bank.controller.js";
import playerService from "../player/player.service.js";
import decksService from "../misc/decks.service.js";

const minute = 60 * 1000;

async function generateDU(game) {
	const nbPlayer = _.partition(game.players, p => p.status === C.ALIVE).length;
	const moyenne = game.currentMassMonetary / nbPlayer;
	const du = moyenne * game.tauxCroissance / 100;
	const duRounded = _.round(du, 2);
	return duRounded;
}

async function distribDU(idGame) {
	GameModel.findById(idGame)
		.then(async (game) => {
			var newEvents = [];
			const du = await generateDU(game);
			var newMassMoney = game.currentMassMonetary;
			for await (let player of game.players) {
				if (player.status === C.ALIVE) {
					player.coins += du;
					newMassMoney += du;
					socket.emitTo(player.id, C.DISTRIB_DU, { du: du });
					let newEvent = constructor.event(C.DISTRIB_DU, C.MASTER, player.id, du, [], Date.now());
					socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
					newEvents.push(newEvent);
				} else if (player.status === C.DEAD) {
					//TO PRODUCE POINTS IN GRAPH (to see dead account devaluate)
					let newEvent = constructor.event(C.REMIND_DEAD, C.MASTER, player.id, player.coins, [], Date.now());
					socket.emitTo(idGame + C.EVENT, C.EVENT, newEvent);
					newEvents.push(newEvent);
				}
			}
			GameModel.findByIdAndUpdate(idGame,
				{
					$inc: { "players.$[elem].coins": du },
					$push: { events: { $each: newEvents } },
					$set: { currentMassMonetary: newMassMoney, currentDU: du }
				},
				{
					arrayFilters: [{ "elem.status": C.ALIVE }],
					new: true
				})
				.then(updatedGame => {

				})
				.catch(err => {
					log.error('update game error', err);
				})
		})
		.catch(err => {
			log.error('get game error', err);
		})
}

async function stopRound(idGame, gameRound) {
	gameTimerManager.stopAndRemoveTimer(idGame);
	gameTimerManager.stopAndRemoveTimer(idGame + "death");

	let stopRoundEvent = constructor.event(C.STOP_ROUND, C.MASTER, "", gameRound, [], Date.now());
	GameModel.updateOne({ _id: idGame }, {
		$set: {
			status: C.STOP_ROUND,
			modified: Date.now(),
		},
		$push: { events: stopRoundEvent }
	}).then(res => {
		bankTimerManager.stopAndRemoveAllIdGameDebtTimer(idGame);
		socket.emitTo(idGame, C.STOP_ROUND);
		socket.emitTo(idGame + C.EVENT, C.EVENT, stopRoundEvent);
	});
}

async function startRoundTimers(idGame, game, playersIdToKill) {
	const totalTimeRound = game.roundMinutes * minute;
	const intervalDeath = totalTimeRound/playersIdToKill.length;
	let timer = new Timer(idGame, totalTimeRound, minute, { round: game.round, typeMoney: game.typeMoney },
		async (timer) => {
			if (timer.data.typeMoney === C.JUNE) {
				await distribDU(timer.id);
			}
			let remainingTime = differenceInMilliseconds(timer.endTime, new Date());
			let remainingMinutes = Math.round(remainingTime / 60000); // Convert milliseconds to minutes
			socket.emitTo(timer.id, C.TIMER_LEFT, remainingMinutes);
		},
		async (timer) => {
			if (timer.data.typeMoney === C.JUNE) {
				await distribDU(timer.id);
			}
			stopRound(timer.id, timer.data.round);
		});
	timer.start();

	let timerDeath = new Timer(idGame + "death", totalTimeRound, intervalDeath,
		{
			idGame,
			autoDeath: game.autoDeath,
			playersIdToKill
		},
		async (timer) => {
			if (timer.data.autoDeath) {
				if (timer.data.playersIdToKill[0]) {
					let idPlayer = timer.data.playersIdToKill.splice(0, 1)[0];
					await playerService.killPlayer(timer.data.idGame, idPlayer);
				} else {
					//no more players in array...
				}
			}
			socket.emitTo(timer.data.idGame + C.MASTER, C.DEATH_IS_COMING, {});
		},
		(timer) => {
			log.info("EEEENNNND GAME", idGame);
		});
	timerDeath.start();

	await gameTimerManager.addTimer(timer);
	await gameTimerManager.addTimer(timerDeath);
	if (game.typeMoney === C.DEBT) {
		//Start credits
		BankController.startCreditsByIdGame(idGame);
	}
}

async function initGameDebt(game) {
	let decks = await decksService.generateDecks(game);

	for await (let player of game.players) {
		// pull cards from the deck and distribute to the player
		const cards = _.pullAt(decks[0], game.distribInitCards === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
		player.cards = cards;
		player.status = C.ALIVE;
		player.coins = 0;

		socket.emitTo(player.id, C.START_GAME, {
			cards: cards, coins: 0,
			typeMoney: C.DEBT,
			statusGame: C.START_GAME,
			amountCardsForProd: game.amountCardsForProd,
			timerCredit: game.timerCredit,
			timerPrison: game.timerPrison
		});
		let newEvent = constructor.event(C.INIT_DISTRIB, C.MASTER, player.id, player.coins, cards, Date.now());
		socket.emitTo(game._id.toString() + C.EVENT, C.EVENT, newEvent);
		game.events.push(newEvent);
	}
	game.decks = decks;
	return game;
}

async function generateInequality(nbPlayer, pctRich, pctPoor) {
	//10% de riche = 2x le median
	//10% de pauvre = 1/2 le median
	//80% classe moyenne = la moyenne
	const classHaute = Math.floor(nbPlayer * (pctRich / 100));
	const classBasse = Math.floor(nbPlayer * (pctPoor / 100));
	const classMoyenne = nbPlayer - classHaute - classBasse;

	return [classBasse, classMoyenne, classHaute];
}

async function initGameJune(game) {
	let decks = await decksService.generateDecks(game);

	const classes = game.inequalityStart ? await generateInequality(game.players.length, game.pctRich, game.pctPoor) : [];

	for await (let player of game.players) {
		// pull 4 cards from the deck and distribute to the player
		const cards = _.pullAt(decks[0], game.amountCardsForProd === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
		player.cards = cards;
		player.status = C.ALIVE;

		if (game.inequalityStart) {
			if (classes[0] >= 1) {
				//classe basses
				player.coins = Math.floor(game.startAmountCoins / 2);
				classes[0]--;
			} else if (classes[2] >= 1) {
				// classe haute
				player.coins = Math.floor(game.startAmountCoins * 2);
				classes[2]--;
			} else {
				//classe moyenne
				player.coins = game.startAmountCoins;
			}
		} else {
			player.coins = game.startAmountCoins;
		}
		game.currentMassMonetary += player.coins;

		socket.emitAckTo(player.id, C.START_GAME, {
			cards: cards,
			coins: player.coins,
			typeMoney: C.JUNE,
			statusGame: C.START_GAME,
			amountCardsForProd: game.amountCardsForProd,
		});
		let newEvent = constructor.event(C.INIT_DISTRIB, C.MASTER, player.id, player.coins, cards, Date.now());
		socket.emitTo(game._id.toString() + C.EVENT, C.EVENT, newEvent);
		game.events.push(newEvent);
	}
	game.currentDU = await generateDU(game);
	socket.emitTo(game._id.toString(), C.FIRST_DU, { du: game.currentDU });

	let firstDUevent = constructor.event(C.FIRST_DU, C.MASTER, C.MASTER, game.currentDU, [], Date.now());
	game.events.push(firstDUevent);
	game.decks = decks;
	return game;
}

export default {
	stopRound: stopRound,
	async startRound(idGame, round, next) {
		let startEvent = constructor.event(C.START_ROUND, C.MASTER, "", round, [], Date.now());
		await GameModel.findByIdAndUpdate(idGame, {
			$set: {
				status: C.PLAYING,
				modified: Date.now(),
			},
			$push: { events: startEvent }
		}, { new: true })
			.then(updatedGame => {
				let idPlayers = _.shuffle(updatedGame.players.map(p => p._id.toString()));
				startRoundTimers(updatedGame._id.toString(), updatedGame, idPlayers);
				socket.emitTo(idGame, C.START_ROUND);
				socket.emitTo(idGame + C.EVENT, C.EVENT, startEvent);
			})
			.catch(err => {
				log.error('Start round game error', err);
				next({
					status: 404,
					message: "Start round game error"
				});
			})
	},
	async initGame(game) {
		if (game.typeMoney === "june") {
			return await initGameJune(game);
		} else if (game.typeMoney === "debt") {
			return await initGameDebt(game);
		}
	}
}
