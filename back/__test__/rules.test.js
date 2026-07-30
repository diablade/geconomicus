import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { GAME_TYPE, IO, ROOMS } from '@geco/shared';

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
import SessionModel from '../src/session/session.model.js';

/* ================= SETUP ================= */
const agent = request.agent(app);
let session;
let ruleIdx;

/* ================= HOOKS ================= */
beforeAll(async () => {
    await db.connect();
    const res = await agent.post('/session/create').send({
        name: 'test-rules-session',
        animator: 'test-rules-animator',
        location: 'test-rules-location'
    });
    expect(res.body).toBeTruthy();
    expect(res.body._id).toBeTruthy();
    session = res.body;
});
afterAll(async () => {
    await db.clear();
    await db.close();
    // Clear all instances and calls to constructor and all methods:
    jest.clearAllMocks();
});

/* ================= TESTS ================= */
describe('RULES controller', () => {
    describe("RULES CREATE", () => {
        test('should create rules and emit socket event', async () => {
            const res = await agent.post('/rules/create').send({
                sessionId: session._id,
                rules: {
                    typeMoney: GAME_TYPE.DEBT,
                    priceWeight1: 1,
                    priceWeight2: 2,
                    priceWeight3: 4,
                    priceWeight4: 8,
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.idx).toBeTruthy();
            ruleIdx = res.body.idx;

            // socket emit appelé
            expect(mockEmitTo).toHaveBeenCalledTimes(1);
            expect(mockEmitTo).toHaveBeenCalledWith(ROOMS.session(session._id), expect.stringContaining(IO.SESSION.NEW_RULES), expect.objectContaining({
                idx: ruleIdx,
                typeMoney: GAME_TYPE.DEBT,
            }));
        });
    });
    describe("RULES UPDATE", () => {
        test("should update rules successfully", async () => {
            const res = await agent.put("/rules/update").send({
                updates: {
                    typeMoney: GAME_TYPE.JUNE,
                },
                ruleIdx: ruleIdx,
                sessionId: session._id,
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.status).toBe("updated");

            // socket emit appelé
            expect(mockEmitTo).toHaveBeenCalledTimes(2);
            expect(mockEmitTo).toHaveBeenCalledWith(ROOMS.session(session._id), expect.stringContaining(IO.SESSION.UPDATED_RULES), expect.objectContaining({
                idx: ruleIdx,
                typeMoney: GAME_TYPE.JUNE,
            }));
        });
    });
    describe("RULES GET BY ID", () => {
        test("should get rules by id successfully", async () => {
            const res = await agent.get("/rules/" + session._id + "/" + ruleIdx).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.typeMoney).toBe(GAME_TYPE.JUNE);
        });
    });
    describe("RULES RESET DEFAULT", () => {
        test("should reset to defaults while keeping every schema field persisted", async () => {
            const res = await agent.put("/rules/default").send({
                sessionId: session._id,
                ruleIdx: ruleIdx,
            });
            expect(res.status).toBe(200);
            expect(res.body.idx).toBe(ruleIdx);
            expect(res.body.typeMoney).toBe(GAME_TYPE.JUNE);
            expect(res.body.priceWeight1).toBe(3);
            expect(res.body.roundMinutes).toBe(20);

            const raw = await SessionModel.findById(session._id).lean();
            const persisted = raw.gamesRules.find((rule) => rule.idx === ruleIdx);
            expect(persisted.roundMinutes).toBe(20);
            expect(persisted.autoBank).toBe(false);
            expect(persisted.seizureType).toBeTruthy();
            expect(persisted.actions.length).toBeGreaterThan(0);
            expect(persisted.rateSchedule.length).toBeGreaterThan(0);
        });
    });
    describe("RULES REMOVE", () => {
        test("should remove rules successfully", async () => {
            const res = await agent.delete("/rules/" + session._id + "/" + ruleIdx).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.acknowledged).toBeTruthy();
            expect(res.body.modifiedCount).toBe(1);
            // socket emit appelé
            expect(mockEmitTo).toHaveBeenCalledTimes(3);
            expect(mockEmitTo).toHaveBeenCalledWith(ROOMS.session(session._id), expect.stringContaining(IO.SESSION.DELETED_RULES), expect.objectContaining({
                idx: ruleIdx,
            }));
        });
    });
});

