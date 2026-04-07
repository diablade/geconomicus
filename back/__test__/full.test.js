
import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SESSION_STARTED } from '#constantes';

/* ================= MOCK SOCKET (ESM SAFE) ================= */
const mockEmitTo = jest.fn();
const mockGetIo = jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
}));

jest.unstable_mockModule('#config/socket', () => ({
    default: {
        initIo: jest.fn(),
        getIo: mockGetIo,
        emitTo: mockEmitTo  // Use the same mock reference
    }
}));

/* ================= IMPORTS AFTER MOCK ================= */
const { default: app } = await import('../src/app.js');

import request from 'supertest';
import db from '#configTest/database';

import mongoose from 'mongoose';

/* ================= SETUP ================= */
const agent = request.agent(app);

let sessionId = new mongoose.Types.ObjectId().toString();
let gameStateId1 = new mongoose.Types.ObjectId().toString();
let gameStateId2 = new mongoose.Types.ObjectId().toString();
let avatarId1 = 0
let avatarId2 = 1;
let idGame;
let currentGame;
let currentDU = 0.5;
let numberOfPlayers = 10;

let players = [];
let playersIdx = [];

let createPlayers = async (nb) => {
    for (let i = 1; i <= nb; i++) {
        const res = await agent.post("/avatar/join").send({
            sessionId: sessionId,
            name: "player_" + i
        });
        expect(res.status).toBe(200);
        expect(res.body.avatarIdx).toBeTruthy();
        playersIdx.push(res.body.avatarIdx);
    }
}

/* ================= HOOKS ================= */
beforeAll(async () => {
    await db.connect();
});
afterAll(async () => {
    await db.clear();
    await db.close();
    // Clear all instances and calls to constructor and all methods:
    jest.clearAllMocks();
});

describe("FULL SESSION GAME simulation", () => {
    describe("SESSION CREATE", () => {
        test("should create session successfully", async () => {
            const res = await agent.post("/session/create").send({
                name: "test-full-simu",
                animator: "fulltest-session-animator",
                location: "fulltest-session-location",
                theme: "fulltest-session-theme",
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();
            sessionId = res.body._id;
        });
    });
    test("ADD PLAYERS", async () => {
        await createPlayers(numberOfPlayers);
    });
    test("START SESSION", async () => {
        const resStart = await agent.post("/session/start").send({
            sessionId: sessionId
        });
        expect(resStart.status).toBe(200);
        expect(resStart.body).toBeTruthy();
        expect(mockEmitTo).toHaveBeenCalledWith(sessionId, expect.stringContaining(SESSION_STARTED), expect.objectContaining({
            gamesRules: expect.arrayContaining(resStart.body.gamesRules)
        }));
    });
    test("CHECK SESSION with 2 rules and " + numberOfPlayers + " players", async () => {
        const res = await agent.get("/session/" + sessionId).send();
        expect(res.status).toBe(200);
        expect(res.body).toBeTruthy();
        expect(res.body.gamesRules.length).toBe(2);
        expect(res.body.players.length).toBe(numberOfPlayers);
    });
});
