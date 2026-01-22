import {jest, describe, test, expect, beforeAll, afterAll} from '@jest/globals';
import {C} from "#constantes";

/* ================= MOCK SOCKET (ESM SAFE) ================= */
const mockEmitTo = jest.fn();
const mockGetIo = jest.fn(() => ({
    to:   jest.fn().mockReturnThis(),
    emit: jest.fn()
}));

jest.unstable_mockModule('#config/socket', () => ({
    default: {
        initIo: jest.fn(),
        getIo:  mockGetIo,
        emitTo: mockEmitTo  // Use the same mock reference
    }
}));

/* ================= IMPORTS AFTER MOCK ================= */
const {default: app} = await import('../src/app.js');
import request from 'supertest';
import db from '#configTest/database';

/* ================= SETUP ================= */
const agent = request.agent(app);
let session;
let avatarIdx;

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
    describe("AVATAR JOIN", () => {
        test('should create avatar and emit socket event', async () => {
            const res = await agent.post('/avatar/join').send({
                sessionId: session._id,
                name:      'test-avatar-name'
            });
            expect(res.status).toBe(200);
            expect(res.body.avatarIdx).toBeTruthy();
            avatarIdx = res.body.avatarIdx;

            // socket emit appelé
            expect(mockEmitTo).toHaveBeenCalledTimes(1);
            expect(mockEmitTo).toHaveBeenCalledWith(session._id, expect.stringContaining(C.NEW_AVATAR), expect.objectContaining({
                name:   'test-avatar-name',
                avatar: {
                    idx:                 avatarIdx,
                    name:                'test-avatar-name',
                    image:               "",
                    eyes:                1,
                    earrings:            1,
                    eyebrows:            1,
                    features:            1,
                    hair:                1,
                    glasses:             1,
                    mouth:               1,
                    skinColor:           "",
                    hairColor:           "",
                    earringsProbability: 100,
                    glassesProbability:  100,
                    featuresProbability: 100,
                    boardConf:           "",
                    boardColor:          "",
                },
            }));
        });
    });
    describe("AVATAR UPDATE", () => {
        test("should update avatar successfully", async () => {
            const res = await agent.put("/avatar/update").send({
                sessionId: session._id,
                avatarIdx: avatarIdx,
                updates:   {
                    name:     "test-avatar-name-updated",
                    eyes:     2,
                    earrings: 2,
                    eyebrows: 2,
                    features: 2,
                },
            });
            console.log(res.body);
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.name).toBe("test-avatar-name-updated");
            expect(res.body.idx).toBe(avatarIdx);

            // socket emit appelé
            expect(mockEmitTo).toHaveBeenCalledTimes(2);
            expect(mockEmitTo).toHaveBeenCalledWith(session._id, expect.stringContaining(C.UPDATED_AVATAR), expect.objectContaining({
                name:     'test-avatar-name-updated',
                idx:      avatarIdx,
                eyes:     2,
                earrings: 2,
                eyebrows: 2,
                features: 2,
            }));
        });
    });
    describe("AVATAR GET BY ID", () => {
        test("should get avatar by id successfully", async () => {
            const res = await agent.get("/avatar/" + session._id + "/" + avatarIdx).send();
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
            const res = await agent.delete("/avatar/" + session._id + "/" + avatarIdx).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.acknowledged).toBeTruthy();
            expect(res.body.modifiedCount).toBe(1);
            expect(res.body.avatarIdx).toBe(avatarIdx);

            // socket emit appelé
            expect(mockEmitTo).toHaveBeenCalledTimes(3);
            expect(mockEmitTo).toHaveBeenCalledWith(session._id, expect.stringContaining(C.DELETED_AVATAR), expect.objectContaining({
                avatarIdx: avatarIdx,
            }));
        });
    });
});

