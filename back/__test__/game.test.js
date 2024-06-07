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
					devMode: false,
					priceWeight1: 3,
					priceWeight2: 6,
					priceWeight3: 9,
					priceWeight4: 12,
					round: 0,
					roundMax: 1,
					roundMinutes: 40,

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
				roundMinutes: 1,
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
});
