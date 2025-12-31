import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
jest.mock('../config/socket.js', () => ({
    initIo: jest.fn(),
    getIo: jest.fn()
}));

import request from 'supertest';
import app from '../src/app';
import db from '../__test__/config/database';
// import socket from '../__test__/config/socket.js';

const agent = request.agent(app);
// let ioServer = socket.initIo(agent);


let sessionId;
let shortId;

beforeAll(async () => await db.connect());
// afterEach(async () => await db.clear());
beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    // ioServer.mockClear();
});
afterAll(async () => {
    await db.clear();
    await db.close();
});

describe("SESSION controller tests", () => {
    describe("SESSION CREATE", () => {
        test("should create session successfully", async () => {
            const res = await agent.post("/session/create").send({
                name: "test-name-session",
                animator: "test-session-animator",
                location: "test-session-location",
                theme: "test-session-theme",
            });
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();
            sessionId = res.body._id;
        });
    });
    describe("SESSION GET BY ID", () => {
        test("should get session by id successfully", async () => {
            const res = await agent.get("/session/" + sessionId).send();
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();
            expect(res.body._id).toBe(sessionId);
            shortId = res.body.shortId;
        });
    });
    describe("SESSION GET BY SHORT ID", () => {
        test("should get session by short id successfully", async () => {
            const res = await agent.get("/session/short/" + shortId).send();
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBe(sessionId);
            expect(res.body.shortId).toBe(shortId);
        });
    });
    describe("SESSION GET ALL", () => {
        test("should get all sessions successfully", async () => {
            const res = await agent.get("/session/all").send();
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
            expect(res.body).toBeTruthy();
            expect(res.body.acknowledged).toBeTruthy();
            expect(res.body.modifiedCount).toBe(1);
        });
    });
    describe("SESSION DELETE", () => {
        test("should delete session successfully", async () => {
            const res = await agent.delete("/session/" + sessionId).send();
            expect(res.body).toBeTruthy();
            expect(res.body.name).toBe("test-name-session-updated");
            expect(res.body.animator).toBe("test-session-animator-updated");
            expect(res.body.location).toBe("test-session-location-updated");
            expect(res.body.shortId).toBe(shortId);
            expect(res.body._id).toBe(sessionId);
        });
    });
});

