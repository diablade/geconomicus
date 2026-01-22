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
            expect(res.body.acknowledged).toBeTruthy();
            expect(res.body.modifiedCount).toBe(1);
        });
    });
    describe("SESSION DELETE", () => {
        test("should delete session successfully", async () => {
            const res = await agent.delete("/session/").send({
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

