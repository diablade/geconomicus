import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import db from '#configTest/database';

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
        emitTo: mockEmitTo,
        emitAckTo: jest.fn()
    }
}));

/* ================= IMPORTS AFTER MOCK ================= */
const { default: app } = await import('../src/app.js');
import EventModel from '../src/event/event.model.js';
import EventService from '../src/event/event.service.js';

/* ================= SETUP ================= */
const agent = request.agent(app);
const sessionId = new mongoose.Types.ObjectId().toString();

beforeAll(async () => {
    await db.connect();
});

beforeEach(async () => {
    await db.clear();
    mockEmitTo.mockClear();
});

afterAll(async () => {
    await db.clear();
    await db.close();
    jest.clearAllMocks();
    agent.app?.close?.();
});

describe('EVENT controller tests', () => {
    describe('GET /event/session/:sessionId', () => {
        test('should return empty data array when no events exist (200)', async () => {
            const res = await agent.get(`/event/session/${sessionId}`).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.data).toEqual([]);
        });

        test('should return added events (200)', async () => {
            const gameStateId = new mongoose.Types.ObjectId().toString();

            await EventService.create('event-A', sessionId, gameStateId, 'master', '-', { a: 1 });

            const res = await agent.get(`/event/session/${sessionId}`).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].typeEvent).toBe('event-A');
            expect(res.body.data[0].sessionId).toBe(sessionId);
        });

        test('should filter events by sessionId (200)', async () => {
            const sessionId1 = new mongoose.Types.ObjectId().toString();
            const sessionId2 = new mongoose.Types.ObjectId().toString();
            const gameStateId = new mongoose.Types.ObjectId().toString();

            await EventService.create('event-A', sessionId1, gameStateId, 'master', '-', { a: 1 });
            await EventService.create('event-B', sessionId2, gameStateId, 'master', '-', { b: 2 });

            const res1 = await agent.get(`/event/session/${sessionId1}`).send();
            expect(res1.status).toBe(200);
            expect(res1.body.data).toHaveLength(1);
            expect(res1.body.data[0].sessionId).toBe(sessionId1);
            expect(res1.body.data[0].typeEvent).toBe('event-A');
        });

        test('should return 400 on invalid sessionId format', async () => {
            const res = await agent.get('/event/session/not-an-object-id').send();
            expect(res.status).toBe(400);
            expect(res.body).toBeTruthy();
            expect(res.body.status).toBe('validation_error');
            expect(Array.isArray(res.body.errors)).toBe(true);
        });

        test('should return 500 when EventModel.find throws', async () => {
            const sessionId = new mongoose.Types.ObjectId().toString();

            const spy = jest.spyOn(EventModel, 'find').mockImplementation(() => {
                throw new Error('forced failure');
            });

            const res = await agent.get(`/event/session/${sessionId}`).send();
            expect(res.status).toBe(500);
            expect(res.body).toBeTruthy();
            expect(res.body.message).toBe('Failed to fetch event');
            expect(res.body.error).toBe('forced failure');

            spy.mockRestore();
        });
    });

    describe('GET /event/game/:gameStateId', () => {
        test('should return count=0 and empty data array when no events exist (200)', async () => {
            const gameStateId = new mongoose.Types.ObjectId().toString();

            const res = await agent.get(`/event/game/${gameStateId}`).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.count).toBe(0);
            expect(res.body.data).toEqual([]);
        });

        test('should return added events (200)', async () => {
            const sessionId = new mongoose.Types.ObjectId().toString();
            const gameStateId = new mongoose.Types.ObjectId().toString();

            await EventService.create('event-A', sessionId, gameStateId, 'master', '-', { a: 1 });

            const res = await agent.get(`/event/game/${gameStateId}`).send();
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
            expect(res.body.count).toBe(1);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].gameStateId).toBe(gameStateId);
            expect(res.body.data[0].typeEvent).toBe('event-A');
        });

        test('should filter events by gameStateId (200)', async () => {
            const sessionId = new mongoose.Types.ObjectId().toString();
            const gameStateId1 = new mongoose.Types.ObjectId().toString();
            const gameStateId2 = new mongoose.Types.ObjectId().toString();

            await EventService.create('event-A', sessionId, gameStateId1, 'master', '-', { a: 1 });
            await EventService.create('event-B', sessionId, gameStateId2, 'master', '-', { b: 2 });

            const res1 = await agent.get(`/event/game/${gameStateId1}`).send();
            expect(res1.status).toBe(200);
            expect(res1.body.count).toBe(1);
            expect(res1.body.data[0].gameStateId).toBe(gameStateId1);
            expect(res1.body.data[0].typeEvent).toBe('event-A');
        });

        test('should return 400 on invalid gameStateId format', async () => {
            const res = await agent.get('/event/game/not-an-object-id').send();
            expect(res.status).toBe(400);
            expect(res.body).toBeTruthy();
            expect(res.body.status).toBe('validation_error');
            expect(Array.isArray(res.body.errors)).toBe(true);
        });

        test('should return 500 when EventModel.find throws', async () => {
            const gameStateId = new mongoose.Types.ObjectId().toString();

            const spy = jest.spyOn(EventModel, 'find').mockImplementation(() => {
                throw new Error('forced failure');
            });

            const res = await agent.get(`/event/game/${gameStateId}`).send();
            expect(res.status).toBe(500);
            expect(res.body).toBeTruthy();
            expect(res.body.message).toBe('Failed to fetch events');
            expect(res.body.error).toBe('forced failure');

            spy.mockRestore();
        });
    });
});
