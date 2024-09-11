import request from 'supertest';
import app from '../src/app';
import db from '../__test__/config/database';
import * as C from "../../config/constantes.js";
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals';
import socket from "../config/socket.js";

const agent = request.agent(app);
let ioServer = socket.initIo(agent);
import _ from 'lodash';
import playerService from "../src/player/player.service.js";

jest.mock('../config/socket.js');

let idGame;
let currentGame;
let currentDU = 0.5;
let numberOfPlayers = 10;

let players = [];
let playersId = [];

let getPlayerCardsUpdate = async (idPlayer) => {
	const res = await agent.get("/player/" + idGame + "/" + idPlayer).send();
	expect(res.statusCode).toEqual(200);
	expect(res.body.player).toBeTruthy();
	players = _.map(players, p => {
		return p.name === res.body.player.name ? res.body.player : p
	});
	currentDU = res.body.currentDU;
}

let transaction = async (idBuyer, idSeller, idCard) => {
	const res = await agent.post("/player/transaction").send(
		{
			idGame: idGame,
			idBuyer: idBuyer,
			idSeller: idSeller,
			idCard: idCard
		});
	expect(res.statusCode).toEqual(200);
	await getPlayerCardsUpdate(idBuyer);
	await getPlayerCardsUpdate(idSeller);
}

let produce = async (idPlayer, cards) => {
	const res = await agent.post("/player/produce").send(
		{
			idGame: idGame,
			idPlayer: idPlayer,
			cards: cards
		});
	expect(res.statusCode).toEqual(200);
	expect(res.body.length).toEqual(5);
	let newCards = _.countBy(res.body, c => c.weight === cards[0].weight);
	let produceCard = _.countBy(res.body, c => c.weight === cards[0].weight + 1);
	expect(newCards.true).toEqual(4);
	expect(produceCard.true).toEqual(1);
	await getPlayerCardsUpdate(idPlayer);
}

let searchAndTryBuyCard = async (card, currentPlayer) => {
	// Attempt to trade cards with other players
	for await (const player of players) {
		if (currentPlayer._id !== player._id) {
			const cardToBuy = _.find(player.cards, c => c.letter === card.letter && c.weight === card.weight);
			if (cardToBuy && currentPlayer.coins >= (cardToBuy.price * currentDU)) {
				await transaction(currentPlayer._id, player._id, cardToBuy._id);
				return true;
			} else {
				return false;
			}
		}
	}
	return false;
}

let playerDoPlay = async (currentPlayer) => {
	// Group the cards by type (weight-letter)
	const groupedCards = _.groupBy(currentPlayer.cards, card => `${card.weight}-${card.letter}`);
	const square = Object.values(groupedCards).find(group => group.length === 4);
	if (square) {
		await produce(currentPlayer._id, square);
		return;
	}
	// Convert the grouped cards object into an array of groups
	const cardGroups = Object.values(groupedCards);
	// Sort the array of groups by the weight of the cards in descending order
	cardGroups.sort((a, b) => b[0].weight - a[0].weight);
	for await (let cardGroup of cardGroups) {
		const succeed = await searchAndTryBuyCard(cardGroup[0], currentPlayer);
		if (succeed) {
			return;
		}
	}
}

let play = async (round) => {
	for (let i = 1; i <= round; i++) {
		console.log("ROUND : ", i);
		for (let player of players) {
			if (player.status === C.ALIVE) {
				console.log("player" + player.name + " current playing ");
				await playerDoPlay(player);
			} else {
				console.log("player " + player.status)
			}
		}
	}
}

let createPlayers = async (nb) => {
	for (let i = 1; i <= nb; i++) {
		const res = await agent.post("/player/join").send({idGame: idGame, name: "player" + i});
		expect(res.statusCode).toEqual(200);
		expect(res.body).toBeTruthy();
		playersId.push(res.body);
	}
}
let updatePlayersHand = async () => {
	for (let id of playersId) {
		const resp = await agent.get("/player/" + idGame + "/" + id).send();
		expect(resp.body.player.cards.length === 4).toBeTruthy();
		players.push(resp.body.player);
		currentDU = resp.body.currentDU;
	}
}

beforeAll(async () => await db.connect());
// afterEach(async () => await db.clear());
beforeEach(() => {
	// Clear all instances and calls to constructor and all methods:
	// io.mockClear();
});
afterAll(async () => {
	const res = await agent.get("/game/" + idGame).send();
	expect(res.statusCode).toEqual(200);
	expect(res.body).toBeTruthy();
	console.log("ALL GAME RESULT:");
	for (let player of res.body.players) {
		console.log("player cards", player.name, player.cards);
		// console.log("event:", event.typeEvent, event.emitter, event.receiver, event.amount);
	}
	await db.clear();
	await db.close();
});

describe("FULL GAME simulation", () => {
	test("CREATE game", async () => {
		const res = await agent.post("/game/create").send({
			name: "test-full-simu",
			animator: "animator",
			location: "ici",
		});
		expect(res.statusCode).toEqual(200);
		expect(res.body._id).toBeTruthy();
		idGame = res.body._id;
		const modified = res.body.modified;
		const created = res.body.created;
		currentGame = res.body;
		//CHECK DEFAULT VALUES
		expect(res.body).toEqual(
			{
				__v: 0,
				name: "test-full-simu",
				location: "ici",
				animator: "animator",
				_id: idGame,
				status: C.OPEN,
				typeMoney: "june",
				events: [{
					"_id": expect.any(String),
					"amount": 0,
					"date": expect.any(String),
					"emitter": "master",
					"receiver": "master",
					"resources": [],
					"typeEvent": "create-game",
				}],
				decks: [],
				players: [],
				amountCardsForProd: 4,
				currentMassMonetary: 0,
				generatedIdenticalCards: 4,
				distribInitCards: 4,
				generateLettersAuto: true,
				generateLettersInDeck: 0,

				surveyEnabled: true,
				autoDeath: true,
				deathPassTimer: 4,
				devMode: false,
				priceWeight1: 3,
				priceWeight2: 6,
				priceWeight3: 9,
				priceWeight4: 12,
				round: 0,
				roundMax: 1,
				roundMinutes: 25,

				//option june
				currentDU: 0,
				tauxCroissance: 5,
				inequalityStart: false,
				startAmountCoins: 5,
				pctPoor: 10,
				pctRich: 10,

				//option debt
				credits: [],
				defaultCreditAmount: 3,
				defaultInterestAmount: 1,
				bankInterestEarned: 0,
				bankGoodsEarned: 0,
				timerCredit: 5,
				timerPrison: 5,
				manualBank: true,
				seizureType: "decote",
				seizureCosts: 2,
				seizureDecote: 33,

				modified: modified,
				created: created,
			}
		);
	});
	test("UPDATE game", async () => {
		const res = await agent.put("/game/update").send({
			typeMoney: "june",
			idGame: idGame,
			surveyEnabled: false,
			autoDeath: false,
			roundMinutes: 1,
		});
		expect(res.statusCode).toEqual(200);
		expect(res.body).toStrictEqual({
			status: "updated",
		});
	});
	test("ADD PLAYERS", async () => {
		await createPlayers(numberOfPlayers);
	});
	test("START game", async () => {
		const resStart = await agent.put("/game/start").send({idGame: idGame, typeMoney: C.JUNE});
		expect(resStart.statusCode).toEqual(200);
		expect(resStart.body).toBeTruthy();
	});
	test("CHECK cards distributed to players", async () => {
		await updatePlayersHand();
	});
	test("CHECK decks cards in game", async () => {
		const res = await agent.get("/game/" + idGame).send();
		expect(res.statusCode).toEqual(200);
		expect(res.body.decks).toBeTruthy();
		expect(res.body.decks[0].length).toEqual(4);
		expect(res.body.decks[1].length).toEqual(44);
		expect(res.body.decks[2].length).toEqual(44);
		expect(res.body.decks[3].length).toEqual(44);
	});
	test("START round", async () => {
		const res = await agent.post("/game/start-round").send({idGame: idGame, round: 0});
		expect(res.statusCode).toEqual(200);
		expect(res.body.status).toEqual(C.START_ROUND);
	});
	test("PLAY 10 rounds and STOP", async () => {
		await play(2);
		// await playerService.killPlayer()
		// await play(5);
		const res = await agent.post("/game/stop-round").send({idGame: idGame, round: 0});
		expect(res.statusCode).toEqual(200);
		expect(res.body.status).toEqual(C.STOP_ROUND);
	});
	test("END GAME", async () => {
		const res = await agent.post("/game/end").send({idGame: idGame});
		expect(res.statusCode).toEqual(200);
		expect(res.body.status).toEqual(C.END_GAME);
	});
});
