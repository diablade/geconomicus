import request from 'supertest';
import app from '../src/app';
import db from '../__test__/config/database';
import * as C from "../../config/constantes.js";
import { jest } from '@jest/globals';
import socket from "../config/socket.js";
const agent = request.agent(app);
let ioServer = socket.initIo(agent);

jest.mock('../config/socket.js');


let idGame;
let currentGame;
let player1;
let player2;
let player3;
let player4;

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


describe("GAME controller test", () => {
	describe("POST /game/create", () => {
		test("create game successfully", async () => {
			const res = await agent.post("/game/create").send({
				name: "test-name",
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
					name: "test-name",
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
	});
	describe('GET /game/id', () => {
		test(" get game by id", async () => {
			const res = await agent.get("/game/" + idGame).send();
			expect(res.statusCode).toEqual(200);
			expect(res.body).toBeTruthy();
			expect(res.body._id).toBe(idGame);
			expect(res.body).toEqual(currentGame);
		});
	});
	describe('POST /game/update', () => {
		test("update game successfully", async () => {
			const res = await agent.put("/game/update").send({
				name: "test-name2",
				typeMoney: "june",
				idGame: idGame,
				surveyEnabled: false,
				inequalityStart: true,
				roundMinutes:1,
			});
			expect(res.statusCode).toEqual(200);
			expect(res.body).toStrictEqual({
				status: "updated",
			});
		});
		test(" get game by id", async () => {
			const res = await agent.get("/game/" + idGame).send();
			expect(res.statusCode).toEqual(200);
			expect(res.body).toBeTruthy();
			expect(res.body._id).toBe(idGame);
			expect(res.body.name).toBe("test-name2");
			expect(res.body.typeMoney).toBe("june");
			expect(res.body.surveyEnabled).toBeFalsy();
			expect(res.body.inequalityStart).toBeTruthy();
		});
	});
	describe("GAME FULL SIMULATION", () => {
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
		test("CHECK players cards distributed", async () => {
			const resp1 = await agent.get("/player/" + idGame + "/" + player1).send();
			expect(resp1.body.player.cards).toBeTruthy();
			player1 = resp1.body.player;
			const resp2 = await agent.get("/player/" + idGame + "/" + player2).send();
			expect(resp2.body.player.cards).toBeTruthy();
			player2 = resp2.body.player;
			const resp3 = await agent.get("/player/" + idGame + "/" + player3).send();
			expect(resp3.body.player.cards).toBeTruthy();
			player3 = resp3.body.player;
			const resp4 = await agent.get("/player/" + idGame + "/" + player4).send();
			expect(resp4.body.player.cards).toBeTruthy();
			player4 = resp4.body.player;
		});
		test("START round", async () => {
			const resStartR = await agent.post("/game/start-round").send({idGame: idGame, round: 0});
			expect(resStartR.body).toBeTruthy();
			expect(resStartR.body.status).toEqual(C.START_ROUND);
			expect(resStartR.statusCode).toEqual(200);
		});
	});
});
