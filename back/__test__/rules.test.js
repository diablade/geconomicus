import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
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

/* ================= SETUP ================= */
const agent = request.agent(app);
let session;
let ruleId;

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
                    typeMoney: C.DEBT,
                    priceWeight1: 1,
                    priceWeight2: 2,
                    priceWeight3: 4,
                    priceWeight4: 8,
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.id).toBeTruthy();
            ruleId = res.body.id;

            // socket emit appelé
            expect(mockEmitTo).toHaveBeenCalledTimes(1);
            expect(mockEmitTo).toHaveBeenCalledWith(session._id, expect.stringContaining(C.NEW_GAMES_RULES), expect.objectContaining({
                id: ruleId,
                typeMoney: C.DEBT,
            }));
        });
    });
    describe("RULES UPDATE", () => {
        test("should update rules successfully", async () => {
            const res = await agent.put("/rules/update").send({
                updates: {
                    typeMoney: C.JUNE,
                },
                ruleId: ruleId,
                sessionId: session._id,
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.status).toBe("updated");

            // socket emit appelé
            expect(mockEmitTo).toHaveBeenCalledTimes(2);
            expect(mockEmitTo).toHaveBeenCalledWith(session._id, expect.stringContaining(C.UPDATED_RULES), expect.objectContaining({
                id: ruleId,
                typeMoney: C.JUNE,
            }));
        });
    });
    describe("RULES GET BY ID", () => {
        test("should get rules by id successfully", async () => {
            const res = await agent.get("/rules/" + session._id + "/" + ruleId).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.typeMoney).toBe(C.JUNE);
        });
    });
    describe("RULES REMOVE", () => {
        test("should remove rules successfully", async () => {
            const res = await agent.delete("/rules/" + session._id + "/" + ruleId).send();
            console.log("rules : ", res.body);
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.acknowledged).toBeTruthy();
            expect(res.body.modifiedCount).toBe(1);
            // socket emit appelé
            expect(mockEmitTo).toHaveBeenCalledTimes(3);
            expect(mockEmitTo).toHaveBeenCalledWith(session._id, expect.stringContaining(C.DELETED_RULES), expect.objectContaining({
                id: ruleId,
            }));
        });
    });
});

