import request from 'supertest';
import app from '../../src/app';
import db from '#configTest/database';
import { C } from "#constantes";
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals';
import socket from "#config/socket";

const agent = request.agent(app);
let ioServer = socket.initIo(agent);
import _ from 'lodash';

jest.mock('#config/socket');

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
                name:     "test-name",
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
            expect(res.body).toEqual({
                __v:                       0,
                name:                      "test-name",
                location:                  "ici",
                animator:                  "animator",
                _id:                       idGame,
                status:                    C.OPEN,
                typeMoney:                 "june",
                theme:                     "THEME.CLASSIC",
                shortId:                   expect.any(String),
                events:                    [
                    {
                        "_id":       expect.any(String),
                        "amount":    0,
                        "date":      expect.any(String),
                        "emitter":   "master",
                        "receiver":  "master",
                        "resources": [],
                        "typeEvent": "create-game",
                    }
                ],
                decks:                     [],
                players:                   [],
                amountCardsForProd:        4,
                currentMassMonetary:       0,
                generatedIdenticalLetters: 4,
                distribInitCards:          4,
                generateLettersAuto:       true,
                generateLettersInDeck:     0,

                surveyEnabled:  true,
                devMode:        false,
                autoDeath:      true,
                deathPassTimer: 4,
                priceWeight1:   3,
                priceWeight2:   6,
                priceWeight3:   9,
                priceWeight4:   12,
                round:          0,
                roundMax:       1,
                roundMinutes:   25,

                //option june
                currentDU:        0,
                tauxCroissance:   10,
                inequalityStart:  false,
                startAmountCoins: 5,
                pctPoor:          10,
                pctRich:          10,

                //option debt
                credits:               [],
                defaultCreditAmount:   3,
                defaultInterestAmount: 1,
                bankInterestEarned:    0,
                bankGoodsEarned:       0,
                bankMoneyLost:         0,
                timerCredit:           5,
                timerPrison:           5,
                manualBank:            true,
                seizureType:           "decote",
                seizureCosts:          2,
                seizureDecote:         33,

                modified: modified,
                created:  created,
            });
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
                name:            "test-name2",
                typeMoney:       "june",
                idGame:          idGame,
                surveyEnabled:   false,
                inequalityStart: true,
                roundMinutes:    1,
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
    describe('POST /game/start', () => {
        test("START game", async () => {
            const resStart = await agent.put("/game/start").send({
                idGame:    idGame,
                typeMoney: C.JUNE
            });
            expect(resStart.statusCode).toEqual(200);
            expect(resStart.body).toBeTruthy();
        });
        test("START round", async () => {
            const res = await agent.post("/game/start-round").send({
                idGame: idGame,
                round:  0
            });
            expect(res.statusCode).toEqual(200);
            expect(res.body.status).toEqual(C.START_ROUND);
        });
        test("STOP round", async () => {
            const res = await agent.post("/game/stop-round").send({
                idGame: idGame,
                round:  0
            });
            expect(res.statusCode).toEqual(200);
            expect(res.body.status).toEqual(C.STOP_ROUND);
        });
        test("END GAME", async () => {
            const res = await agent.post("/game/end").send({idGame: idGame});
            expect(res.statusCode).toEqual(200);
            expect(res.body.status).toEqual(C.END_GAME);
        });
    });
});
