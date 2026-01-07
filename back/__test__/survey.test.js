import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { C } from "#constantes";

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
import { nanoId4 } from '../src/misc/misc.tool.js';

/* ================= SETUP ================= */
let sessionId = new mongoose.Types.ObjectId().toString();
let gameStateId1 = new mongoose.Types.ObjectId().toString();
let gameStateId2 = new mongoose.Types.ObjectId().toString();
let avatarId1 = nanoId4();
let avatarId2 = nanoId4();

const agent = request.agent(app);

/* ================= HOOKS ================= */
beforeAll(async () => {
    await db.connect();
});

beforeEach(() => {
    mockEmitTo.mockClear();
});

afterAll(async () => {
    await db.clear();
    await db.close();
    jest.clearAllMocks();
    agent.app?.close?.();
});

/* ================= TESTS ================= */
describe("SURVEY controller tests", () => {
    describe("SURVEY ADD FEEDBACKs", () => {
        test("should add feedback successfully on gameStateId1 avatar1", async () => {
            const res = await agent.post("/survey/feedback").send({
                sessionId,
                gameStateId: gameStateId1,
                avatarId: avatarId1,
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();

            // socket emit called
            expect(mockEmitTo).toHaveBeenCalledTimes(1);
            expect(mockEmitTo).toHaveBeenCalledWith(gameStateId1, expect.stringContaining(C.NEW_FEEDBACK), expect.objectContaining({
                avatarId: avatarId1,
                depressedHappy: 0,
            }));
        });

        test("should add feedback successfully on gameStateId1 avatar2", async () => {
            const res = await agent.post("/survey/feedback").send({
                sessionId,
                gameStateId: gameStateId1,
                avatarId: avatarId2,
                depressedHappy: 1,
                individualCollective: 1,
                insatisfiedAccomplished: 1,
                greedyGenerous: 1,
                competitiveCooperative: 1,
                anxiousConfident: 1,
                agressiveAvenant: 1,
                irritableTolerant: 1,
                dependantAutonomous: 1
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();

            // socket emit called
            expect(mockEmitTo).toHaveBeenCalledTimes(1);
            expect(mockEmitTo).toHaveBeenCalledWith(gameStateId1, expect.stringContaining(C.NEW_FEEDBACK), expect.objectContaining({
                avatarId: avatarId2,
                depressedHappy: 1,
            }));
        });

        test("should add feedback successfully on gameStateId2 avatar1", async () => {
            const res = await agent.post("/survey/feedback").send({
                sessionId,
                gameStateId: gameStateId2,
                avatarId: avatarId1,
                depressedHappy: 2,
                individualCollective: 2,
                insatisfiedAccomplished: 2,
                greedyGenerous: 2,
                competitiveCooperative: 2,
                anxiousConfident: 2,
                agressiveAvenant: 2,
                irritableTolerant: 2,
                dependantAutonomous: 2
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();

            // socket emit called
            expect(mockEmitTo).toHaveBeenCalledTimes(1);
            expect(mockEmitTo).toHaveBeenCalledWith(gameStateId2, expect.stringContaining(C.NEW_FEEDBACK), expect.objectContaining({
                avatarId: avatarId1,
                depressedHappy: 2,
            }));
        });

        test("should add feedback successfully on gameStateId2 avatar2", async () => {
            const res = await agent.post("/survey/feedback").send({
                sessionId,
                gameStateId: gameStateId2,
                avatarId: avatarId2,
                depressedHappy: 3,
                individualCollective: 3,
                insatisfiedAccomplished: 3,
                greedyGenerous: 3,
                competitiveCooperative: 3,
                anxiousConfident: 3,
                agressiveAvenant: 3,
                irritableTolerant: 3,
                dependantAutonomous: 3
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();

            // socket emit appelé
            expect(mockEmitTo).toHaveBeenCalledTimes(1);
            expect(mockEmitTo).toHaveBeenCalledWith(gameStateId2, expect.stringContaining(C.NEW_FEEDBACK), expect.objectContaining({
                avatarId: avatarId2,
                depressedHappy: 3,
            }));
        });
    });
    describe("SURVEYS GET BY SessionId", () => {
        test("should get survey results by sessionId successfully", async () => {
            const res = await agent.get("/survey/session/" + sessionId).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.length).toBe(4);
        });
    });
    describe("SURVEYS GET BY GAMESTATE ID", () => {
        test("should get survey results by gameStateId successfully", async () => {
            const res = await agent.get("/survey/game/" + gameStateId1).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.length).toEqual(2);
        });
    });
    describe("SURVEYS GET BY all IDs", () => {
        test("should get survey by sessionId, gameStateId and avatarId successfully", async () => {
            const res = await agent.get("/survey/" + sessionId + "/" + gameStateId1 + "/" + avatarId1).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.sessionId).toBe(sessionId);
            expect(res.body.gameStateId).toBe(gameStateId1);
        });
    });
    describe("SURVEY REMOVE ALL BY GAMESTATE ID", () => {
        test("should remove all surveys by gameStateId successfully", async () => {
            const res = await agent.delete("/survey/game/" + gameStateId1).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.deletedCount).toBe(2);
        });
    });
    describe("SURVEY REMOVE ALL BY SESSION ID", () => {
        test("should remove all surveys by sessionId successfully", async () => {
            const res = await agent.delete("/survey/session/" + sessionId).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.deletedCount).toBe(2);
        });
    });

});

