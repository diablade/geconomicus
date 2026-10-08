import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
/* ================= MOCK SOCKET (ESM SAFE) ================= */
// const mockEmitTo = jest.fn();
// const mockGetIo = jest.fn(() => ({
//     to: jest.fn().mockReturnThis(),
//     emit: jest.fn()
// }));

// jest.unstable_mockModule('#config/socket', () => ({
//     default: {
//         initIo: jest.fn(),
//         getIo: mockGetIo,
//         emitTo: mockEmitTo  // Use the same mock reference
//     }
// }));

/* ================= IMPORTS AFTER MOCK ================= */
import request from 'supertest';
import app from '../src/app';
import db from '#configTest/database';
import SessionModel from '../src/session/session.model.js';
import { GAME_STATUS } from '@geco/shared';

/* ================= SETUP ================= */
const agent = request.agent(app);
let sessionId;
let shortId;

/* ================= HOOKS ================= */
beforeAll(async () => await db.connect());
beforeEach(() => {
});
afterAll(async () => {
    await db.clear();
    await db.close();
    jest.clearAllMocks();
    agent.app?.close?.();
});

/* ================= TESTS ================= */
describe("SESSION controller tests", () => {
    describe("SESSION CREATE", () => {
        test("should create session successfully", async () => {
            const res = await agent.post("/session/create").send({
                name: "test-name-session",
                animator: "test-session-animator",
                location: "test-session-location",
                theme: "test-session-theme",
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();
            sessionId = res.body._id;
        });
    });
    describe("SESSION GET BY ID", () => {
        test("should get session by id successfully", async () => {
            const res = await agent.get("/session/" + sessionId).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();
            expect(res.body._id).toBe(sessionId);
            shortId = res.body.shortId;
        });
    });
    describe("SESSION GET BY SHORT ID", () => {
        test("should get session by short id successfully", async () => {
            const res = await agent.get("/session/short/" + shortId).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBe(sessionId);
            expect(res.body.shortId).toBe(shortId);
        });
    });
    describe("SESSION GET ALL", () => {
        test("should get all sessions successfully", async () => {
            const res = await agent.get("/session/all").send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.length).toBe(1);
        });
    });
    describe("SESSION UPDATE", () => {
        test("should update session successfully", async () => {
            const res = await agent.put("/session/update").send({
                sessionId: sessionId,
                updates: {
                    name: "test-name-session-updated",
                    animator: "test-session-animator-updated",
                    location: "test-session-location-updated",
                },
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.name).toBe("test-name-session-updated");
            expect(res.body.animator).toBe("test-session-animator-updated");
            expect(res.body.location).toBe("test-session-location-updated");
        });
    });
    describe("SESSION START", () => {
        test("should persist complete rules with schema defaults", async () => {
            const created = await agent.post("/session/create").send({
                name: "started-session",
                animator: "a",
                location: "l",
            });
            const startedId = created.body._id;
            await agent.post("/session/start").send({ sessionId: startedId });

            const raw = await SessionModel.collection.findOne({
                _id: new SessionModel.base.Types.ObjectId(startedId),
            });
            expect(raw.gamesRules.length).toBe(2);
            raw.gamesRules.forEach((rule) => {
                expect(Array.isArray(rule.actions)).toBe(true);
                expect(rule.actions.length).toBeGreaterThan(0);
                expect(Array.isArray(rule.rateSchedule)).toBe(true);
                expect(rule.roundMinutes).toBe(20);
                expect(rule.generateLettersAuto).toBe(true);
            });
        });
        test("should expose gameStatus none on rules that have no game state yet", async () => {
            const started = await agent.post("/session/start").send({ sessionId: sessionId });
            expect(started.status).toBe(200);
            expect(started.body.gamesRules.length).toBe(2);
            started.body.gamesRules.forEach((rule) => expect(rule.gameStatus).toBe(GAME_STATUS.NONE));

            const reloaded = await agent.get("/session/" + sessionId).send();
            expect(reloaded.status).toBe(200);
            expect(reloaded.body.gamesRules.length).toBe(2);
            reloaded.body.gamesRules.forEach((rule) => expect(rule.gameStatus).toBe(GAME_STATUS.NONE));
        });
    });
    describe("SESSION DELETE", () => {
        test("should delete session successfully", async () => {
            const res = await agent.post("/session/delete").send({
                sessionId: sessionId,
                password: "admin",
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.name).toBe("test-name-session-updated");
            expect(res.body.animator).toBe("test-session-animator-updated");
            expect(res.body.location).toBe("test-session-location-updated");
            expect(res.body.shortId).toBe(shortId);
            expect(res.body._id).toBe(sessionId);
        });
    });
});

