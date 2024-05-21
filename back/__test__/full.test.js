import request from 'supertest';
import app from '../src/app';
import db from '../__test__/config/database';
import * as C from "../../config/constantes.js";
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals';
import socket from "../config/socket.js";

const agent = request.agent(app);
let ioServer = socket.initIo(agent);
import _ from 'lodash';

jest.mock('../config/socket.js');

let idGame;
let currentGame;
let player1;
let player2;
let player3;
let player4;

let getBestCardsInHand = async (player) => {
	// Check if the player has 4 cards of the same letter and weight
	const groupedCards = _.groupBy(player.cards, card => `${card.weight}-${card.letter}`);
	// return Object.values(groupedCards).some(group => group.length === 4);
	const square = Object.values(groupedCards).find(group => group.length === 4);
	if (square) {
		return square;
	}
	const triangle = Object.values(groupedCards).find(group => group.length === 3);
	if (triangle) {
		return triangle;
	}
	const duo = Object.values(groupedCards).find(group => group.length === 2);
	if (duo) {
		return duo;
	} else {
		return null;
	}

}

let transaction = async () => {
	const res = await agent.post("/player/transaction").send(
		{
			idGame: idGame,
			idBuyer: idBuyer,
			idSeller: idSeller,
			idCard: idCard
		});
}

let produce = async (idPlayer, cards) => {
	const res = await agent.post("/player/produce").send(
		{
			idGame: idGame,
			idPlayer: idPlayer,
			cards: cards
		});
}

let searchToBuyCards = async () => {
	// Attempt to trade cards with other players
	for (const otherPlayer of players) {
		if (player.id !== otherPlayer.id) {
			// Example trade logic: player tries to buy a card from another player
			const cardToBuy = otherPlayer.cards[0];  // For simplicity, try to buy the first card
			if (player.coins >= cardToBuy.price) {
				transaction(player, otherPlayer, cardToBuy);
			}
		}
	}
}

let playerDoPlay = (player) => {
	let cards = getBestCardsInHand();
	if (cards.length === 4) {
		produce(player._id, squareCards);
	} else if (cards.length === 3) {

	}
	//check if square do produce
	//check if 3cards same , then check if other players have the missing card , and buy it
	//check if 2cards same , then check if other players have the missing card , and buy it
	//check if one player has a card to sell similar has one of the player's hand
}

let play = async (round) => {
	let players = [player1, player2, player3, player4];
	for (let i = 1; i <= round; i++) {
		for (let player in players) {
			await playerDoPlay(player);
		}
	}
}

beforeAll(async () => await db.connect());
// afterEach(async () => await db.clear());
beforeEach(() => {
	// Clear all instances and calls to constructor and all methods:
	// io.mockClear();
});
afterAll(async () => {
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
		expect(res.body).toBeTruthy();
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
				events: [],
				decks: [],
				players: [],
				amountCardsForProd: 4,
				currentMassMonetary: 0,
				generatedIdenticalCards: 4,
				distribInitCards: 4,
				generateLettersAuto: true,
				generateLettersInDeck: 0,

				surveyEnabled: true,
				priceWeight1: 3,
				priceWeight2: 6,
				priceWeight3: 9,
				priceWeight4: 12,
				round: 0,
				roundMax: 1,
				roundMinutes: 40,

				//option june
				currentDU: 0,
				tauxCroissance: 10,
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
			roundMinutes: 1,
		});
		expect(res.statusCode).toEqual(200);
		expect(res.body).toStrictEqual({
			status: "updated",
		});
	});
	test("ADD PLAYERS", async () => {
		const res1 = await agent.post("/player/join").send({idGame: idGame, name: "player1"});
		expect(res1.body).toBeTruthy();
		expect(res1.statusCode).toEqual(200);
		player1 = res1.body;
		const res2 = await agent.post("/player/join").send({idGame: idGame, name: "player2"});
		expect(res2.body).toBeTruthy();
		expect(res2.statusCode).toEqual(200);
		player2 = res2.body;
		const res3 = await agent.post("/player/join").send({idGame: idGame, name: "player3"});
		expect(res3.body).toBeTruthy();
		expect(res3.statusCode).toEqual(200);
		player3 = res3.body;
		const res4 = await agent.post("/player/join").send({idGame: idGame, name: "player4"});
		expect(res4.body).toBeTruthy();
		expect(res4.statusCode).toEqual(200);
		player4 = res4.body;
	});
	test("START game", async () => {
		const resStart = await agent.put("/game/start").send({idGame: idGame, typeMoney: C.JUNE});
		expect(resStart.body).toBeTruthy();
		expect(resStart.statusCode).toEqual(200);
	});
	test("CHECK cards distributed to players", async () => {
		const resp1 = await agent.get("/player/" + idGame + "/" + player1).send();
		expect(resp1.body.player.cards.length === 4).toBeTruthy();
		player1 = resp1.body.player;
		const resp2 = await agent.get("/player/" + idGame + "/" + player2).send();
		expect(resp2.body.player.cards.length === 4).toBeTruthy();
		player2 = resp2.body.player;
		const resp3 = await agent.get("/player/" + idGame + "/" + player3).send();
		expect(resp3.body.player.cards.length === 4).toBeTruthy();
		player3 = resp3.body.player;
		const resp4 = await agent.get("/player/" + idGame + "/" + player4).send();
		expect(resp4.body.player.cards.length === 4).toBeTruthy();
		player4 = resp4.body.player;
	});
	test("CHECK decks cards in game", async () => {
		const res = await agent.get("/game/" + idGame).send();
		expect(res.statusCode).toEqual(200);
		expect(res.body.decks).toBeTruthy();
		expect(res.body.decks[0].length).toEqual(4);
		expect(res.body.decks[1].length).toEqual(20);
		expect(res.body.decks[2].length).toEqual(20);
		expect(res.body.decks[3].length).toEqual(20);
	});
	test("START round", async () => {
		const res = await agent.post("/game/start-round").send({idGame: idGame, round: 0});
		expect(res.statusCode).toEqual(200);
		expect(res.body.status).toEqual(C.START_ROUND);
	});
	test("PLAY 10 rounds and STOP", async () => {
		// await play(10);
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
