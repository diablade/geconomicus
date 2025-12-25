import request from 'supertest';
import app from '../src/app';
import db from '../__test__/config/database';
import * as C from "../../config/constantes.js";
import socket from '../config/socket.js';
import { jest } from "@jest/globals";

const agent = request.agent(app);
let ioServer = socket.initIo(agent);

jest.mock('../config/socket.js');

let sessionId;
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

describe("SESSION controller tests", () => {
    describe("SESSION CREATE", () => {
        test("should create session successfully", async () => {
            const res = await agent.post("/session/create").send({
                name: "test-name-session",
                animator: "test-session-animator",
                location: "test-session-location",
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
        });
    });
    describe("SESSION GET ALL", () => {
        test("should get all sessions successfully", async () => {
            const res = await agent.get("/session/get-all").send();
            expect(res.body).toBeTruthy();
            expect(res.body.length).toBeGreaterThan(0);
        });
    });
    describe("SESSION UPDATE", () => {
        test("should update session successfully", async () => {
            const res = await agent.put("/session/update").send({
                name: "test-name-session-updated",
                animator: "test-session-animator-updated",
                location: "test-session-location-updated",
                _id: sessionId,
            });
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();
            expect(res.body._id).toBe(sessionId);
        });
    });
    describe("SESSION DELETE", () => {
        test("should delete session successfully", async () => {
            const res = await agent.delete("/session/delete").send({
                _id: sessionId,
            });
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();
            expect(res.body._id).toBe(sessionId);
        });
    });
});

