import {jest, describe, test, expect, beforeAll, afterAll} from '@jest/globals';
import {C} from "../../config/constantes.mjs";

/* ================= MOCK SOCKET (ESM SAFE) ================= */
jest.unstable_mockModule('../config/socket.js', () => ({
    default: {
        emitTo: jest.fn(),          // ce que ton controller appelle
        initIo: jest.fn(),
        getIo:  jest.fn(() => ({
            to:   jest.fn().mockReturnThis(),
            emit: jest.fn()
        }))
    }
}));

/* ================= IMPORTS AFTER MOCK ================= */
const {default: app} = await import('../src/app.js');
const {default: socket} = await import('../config/socket.js');
import request from 'supertest';
import db from '../__test__/config/database.js';

/* ================= SETUP ================= */
const agent = request.agent(app);
let session;
let avatarId;

/* ================= HOOKS ================= */
beforeAll(async () => {
    await db.connect();
    const res = await agent.post('/session/create').send({
        name:     'test-avatar-session',
        animator: 'test-avatar-animator',
        location: 'test-avatar-location'
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
describe('AVATAR controller', () => {

    describe("AVATAR CREATE", () => {
        test('should create avatar and emit socket event', async () => {
            const res = await agent.post('/avatar/join').send({
                sessionId: session._id,
                name:      'test-avatar-name'
            });
            expect(res.status).toBe(200);
            expect(res.body.avatarId).toBeTruthy();
            avatarId = res.body.avatarId;

            // socket emit appelé
            expect(socket.emitTo).toHaveBeenCalledTimes(1);
            expect(socket.emitTo).toHaveBeenCalledWith(session._id, expect.stringContaining(C.NEW_AVATAR), expect.objectContaining({
                name: 'test-avatar-name',
                id:   avatarId,
            }));
        });
    });
    describe("AVATAR UPDATE", () => {
        test("should update avatar successfully", async () => {
            const res = await agent.put("/avatar/update").send({
                updates:   {
                    name:     "test-avatar-name-updated",
                    eyes:     2,
                    earrings: 2,
                    eyebrows: 2,
                    features: 2,
                },
                avatarId:  avatarId,
                sessionId: session._id,
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.name).toBe("test-avatar-name-updated");

            // socket emit appelé
            expect(socket.emitTo).toHaveBeenCalledTimes(2);
            expect(socket.emitTo).toHaveBeenCalledWith(session._id, expect.stringContaining(C.UPDATED_AVATAR), expect.objectContaining({
                name:     'test-avatar-name-updated',
                id:       avatarId,
                eyes:     2,
                earrings: 2,
                eyebrows: 2,
                features: 2,
            }));
        });
    });
    describe("AVATAR GET BY ID", () => {
        test("should get avatar by id successfully", async () => {
            const res = await agent.get("/avatar/" + session._id + "/" + avatarId).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.name).toBe("test-avatar-name-updated");
            expect(res.body.eyes).toBe(2);
            expect(res.body.earrings).toBe(2);
            expect(res.body.eyebrows).toBe(2);
            expect(res.body.features).toBe(2);
            expect(res.body.hair).toBe(1);
            expect(res.body.glasses).toBe(1);
            expect(res.body.mouth).toBe(1);
        });
    });
    //TODO ADD GAME STATE , TEST AVATAR can't DELETE, then REMOVE GAME and Delete AVATAR
    describe("AVATAR DELETE", () => {
        test("should delete avatar successfully", async () => {
            const res = await agent.delete("/avatar/delete").send({
                sessionId: session._id,
                avatarId:  avatarId,
            });
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.acknowledged).toBeTruthy();
            expect(res.body.modifiedCount).toBe(1);
            expect(res.body.avatarId).toBe(avatarId);

            // socket emit appelé
            expect(socket.emitTo).toHaveBeenCalledTimes(3);
            expect(socket.emitTo).toHaveBeenCalledWith(session._id, expect.stringContaining(C.DELETED_AVATAR), expect.objectContaining({
                avatarId: avatarId,
            }));
        });
    });
});

