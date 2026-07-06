import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals';
/* ================= MOCK SOCKET (ESM SAFE) ================= */
await jest.unstable_mockModule('#config/socket', () => ({
    default: {
        initIo: jest.fn(),
        getIo:  jest.fn(),
        emitTo: jest.fn(),
    }
}));

/* ================= IMPORTS APRÈS MOCK ================= */
import request from 'supertest';
import app from '../src/app';
import db from '#configTest/database';

/* ================= SETUP ================= */
const agent = request.agent(app);
let sessionId;
let ruleIdx;
let gameStateId;

/* ================= HOOKS ================= */
beforeAll(async () => {
    await db.connect();

    // Create a test session
    const sessionRes = await agent.post('/session/create').send({
        name:     'test-game-state-session',
        animator: 'test-animator',
        location: 'test-location'
    });
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body._id).toBeTruthy();
    sessionId = sessionRes.body._id;

    // Create a rule set for the session
    const ruleRes = await agent.post('/rules/create').send({
        sessionId: sessionId,
        rules: {
            typeMoney: 'euro',
            initialMoneyPerPlayer: 100,
            maxRound: 10,
        }
    });
    expect(ruleRes.status).toBe(200);
    expect(ruleRes.body.idx).toBeTruthy();
    ruleIdx = ruleRes.body.idx;
});

beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
});

afterAll(async () => {
    await db.clear();
    await db.close();
    jest.clearAllMocks();
    agent.app?.close?.();
});

/* ================= TESTS ================= */
describe("GAME STATE controller tests", () => {
    let createdGameStateId;

    describe("GAME STATE CREATE", () => {
        test("should create a game state from a rule of a session successfully", async () => {
            const res = await agent.post("/game-state/create").send({
                sessionId: sessionId,
                ruleIdx: ruleIdx
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBeTruthy();
            createdGameStateId = res.body._id;
        });
    });

    describe("GAME STATE GET BY ID", () => {
        test("should get GAME STATE by id successfully", async () => {
            const res = await agent.get(`/game-state/${createdGameStateId}`);
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body._id).toBe(createdGameStateId);
        });
    });

    describe("GAME STATE INIT", () => {
        test("should initialize a game state successfully", async () => {
            const res = await agent.post("/game-state/init").send({
                gameStateId: createdGameStateId,
                players: [
                    { name: "Player 1", avatarIdx: 0 },
                    { name: "Player 2", avatarIdx: 1 },
                    { name: "Player 3", avatarIdx: 2 }
                ]
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
        });
    });

    describe("GAME STATE START", () => {
        test("should start a game state successfully", async () => {
            const res = await agent.post("/game-state/start").send({
                gameStateId: createdGameStateId
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
        });
    });

    describe("GAME STATE STOP", () => {
        test("should stop a game state successfully", async () => {
            const res = await agent.post("/game-state/stop").send({
                gameStateId: createdGameStateId
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
        });
    });
});
