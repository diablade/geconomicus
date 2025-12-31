import request from 'supertest';
import app from '../../src/app';
import db from '../../__test__/config/database';
import { C } from "../../../config/constantes.mjs";
import socket from '../../__test__/config/socket.js';
import {jest} from "@jest/globals";

const agent = request.agent(app);
let ioServer = socket.initIo(agent);

jest.mock('../config/socket.js');

let idGame;
let idPlayer;
let currentGame;

let updatedPlayer = {
    idGame:     "",
    name:       "player-name-updated",
    image:      "",
    eyes:       0,
    eyebrows:   1,
    earrings:   2,
    features:   3,
    hair:       4,
    glasses:    5,
    mouth:      6,
    skinColor:  "#1234",
    hairColor:  "#1234",
    boardConf:  "custom",
    boardColor: "#1234",
};

beforeAll(async () => {
    await db.connect();
    const res = await agent.post("/game/create").send({
        name:     "test-player-controller",
        animator: "player-controller",
        location: "player-controller",
    });
    expect(res.body).toBeTruthy();
    expect(res.body._id).toBeTruthy();
    currentGame = res.body;
    idGame = res.body._id;
});

// afterEach(async () => await db.clear());
afterAll(async () => {
    // ioServer.close();
    await db.clear();
    await db.close();
});

// it('should receive messages', (done) => {
//     ioServer.on('connection', socket => {
//         socket.emit(idGame, C.MASTER);
//     });
// });

describe("PLAYER controller tests", () => {
    describe("PLAYER JOIN", () => {
        test("should join create player successfully", async () => {
            ioServer.on(C.NEW_PLAYER, (message) => {
                expect(message).toBeTruthy()
                expect(message.name).toBe('player-one');
                done();
            });
            const bod = {
                idGame: idGame,
                name:   "player-one"
            };
            const res = await agent.post("/player/join").send(bod);
            expect(res.body).toBeTruthy();
            expect(res.statusCode).toEqual(200);
            idPlayer = res.body;
        });
    });
    describe('GET PLAYER by id', () => {
        test("should get player by id", async () => {
            const res = await agent.get("/player/" + idGame + "/" + idPlayer).send();
            expect(res.statusCode).toEqual(200);
            expect(res.body).toBeTruthy();
            expect(res.body.player).toBeTruthy();
            expect(res.body.game.status).toBe(C.OPEN);
            expect(res.body.game.typeMoney).toBe(C.JUNE);
            expect(res.body.game.currentDU).toBe(0);
            expect(res.body.game.amountCardsForProd).toBe(4);
        });
    });
    describe('UPDATE PLAYER OPTIONS', () => {
        test("should update player successfully", async () => {
            ioServer.on(C.UPDATED_PLAYER, (message) => {
                expect(message).toBeTruthy()
                expect(message.name).toBe(updatedPlayer.name);
                done();
            });

            let updatePlayer = {
                ...updatedPlayer,
                idGame: idGame,
                _id:    idPlayer
            };
            const res = await agent.post("/player/update").send(updatePlayer);
            expect(res.statusCode).toEqual(200);
            expect(res.body).toStrictEqual({
                status: "updated",
            });
        });
        test("should get player by id", async () => {
            const res = await agent.get("/player/" + idGame + "/" + idPlayer).send();
            expect(res.statusCode).toEqual(200);
            expect(res.body).toBeTruthy();
            expect(res.body.player).toBeTruthy();
            expect(res.body.player.name).toEqual(updatedPlayer.name);
            expect(res.body.player.image).toEqual(updatedPlayer.image);
            expect(res.body.player.eyes).toEqual(updatedPlayer.eyes);
            expect(res.body.player.eyebrows).toEqual(updatedPlayer.eyebrows);
            expect(res.body.player.earrings).toEqual(updatedPlayer.earrings);
            expect(res.body.player.features).toEqual(updatedPlayer.features);
            expect(res.body.player.hair).toEqual(updatedPlayer.hair);
            expect(res.body.player.glasses).toEqual(updatedPlayer.glasses);
            expect(res.body.player.mouth).toEqual(updatedPlayer.mouth);
            expect(res.body.player.skinColor).toEqual(updatedPlayer.skinColor);
            expect(res.body.player.hairColor).toEqual(updatedPlayer.hairColor);
            expect(res.body.player.boardConf).toEqual(updatedPlayer.boardConf);
            expect(res.body.player.boardColor).toEqual(updatedPlayer.boardColor);
            expect(res.body.game.status).toBeTruthy();
            expect(res.body.game.typeMoney).toBeTruthy();
            expect(res.body.game.currentDU).toEqual(0);
            expect(res.body.game.amountCardsForProd).toEqual(4);
        });
    });
});
