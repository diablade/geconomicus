import request from 'supertest';
import app from '../../../src/app.js';
import db from '../../../__test__/config/database.js';
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals';
import bankTimerManager from "../../../src/legacy/bank/BankTimerManager.js";
import bankService from "../../../src/legacy/bank/bank.service.js";
import Timer from "../../../src/misc/Timer.js";

// Mock dependencies
jest.mock("../../config/socket.js");
jest.mock("../../../src/legacy/bank/BankTimerManager.js");
jest.mock("../../../src/legacy/bank/bank.service.js");

const agent = request.agent(app);
let idGame;
let idPlayer;

describe("Prison Break Tests", () => {
    beforeAll(async () => {
        await db.connect();
    });

    afterAll(async () => {
        await db.clear();
        // Comment out close to avoid connection issues in full test suite
        // await db.close();
    });

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
    });

    test("Create game and player", async () => {
        // Create a test game
        const gameRes = await agent.post("/game/create").send({
            name:     "test-prison",
            animator: "test-animator",
            location: "test-location",
        });
        expect(gameRes.statusCode).toEqual(200);
        expect(gameRes.body._id).toBeTruthy();
        idGame = gameRes.body._id;

        // Create a player
        const playerRes = await agent.post("/player/join").send({
            idGame: idGame,
            name:   "prisoner"
        });
        expect(playerRes.statusCode).toEqual(200);
        expect(playerRes.body).toBeTruthy();
        idPlayer = playerRes.body;
    });

    test("Set player to prison", async () => {
        const updateRes = await agent.post("/game/lock-down-player").send({
            idGame:     idGame,
            idPlayer:   idPlayer,
            prisonTime: 1
        });
        expect(updateRes.statusCode).toEqual(200);
    });

    test("Prison break when timer exists", async () => {
        // Mock the timer exists
        const mockTimer = new Timer("testTimerId", 60000, 5000, {
            idGame,
            idPlayer
        }, jest.fn(), jest.fn());
        bankTimerManager.getTimer.mockResolvedValue(mockTimer);

        // Mock the timeoutPrison implementation
        bankService.timeoutPrison.mockResolvedValue(undefined);

        // Call prison break endpoint
        const res = await agent.post("/bank/prison-break").send({
            idGame:         idGame,
            idPlayerToFree: idPlayer
        });

        // Verify response
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({});

        // Verify mocks were called correctly
        expect(bankTimerManager.getTimer).toHaveBeenCalledWith(idPlayer);
        expect(bankService.timeoutPrison).toHaveBeenCalledWith(mockTimer);
        expect(bankService.getOut).not.toHaveBeenCalled();
    });

    test("Prison break when no timer exists", async () => {
        // Mock no timer exists
        bankTimerManager.getTimer.mockResolvedValue(null);

        // Mock the getOut implementation
        bankService.getOut.mockResolvedValue(undefined);

        // Call prison break endpoint
        const res = await agent.post("/bank/prison-break").send({
            idGame:         idGame,
            idPlayerToFree: idPlayer
        });

        // Verify response
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({});

        // Verify mocks were called correctly
        expect(bankTimerManager.getTimer).toHaveBeenCalledWith(idPlayer);
        expect(bankService.timeoutPrison).not.toHaveBeenCalled();
        expect(bankService.getOut).toHaveBeenCalledWith(idGame, idPlayer);
    });

    test("Prison break with error handling", async () => {
        // Mock getTimer to throw an error
        const testError = new Error("Test error");
        bankTimerManager.getTimer.mockRejectedValue(testError);

        // Create a mock for next function
        const mockNext = jest.fn();

        // Replace the app's normal error handler with our mock
        app.use((err, req, res, next) => {
            mockNext(err);
            res.status(500).json({error: "Mock error response"});
        });

        // Call prison break endpoint
        const res = await agent.post("/bank/prison-break").send({
            idGame:         idGame,
            idPlayerToFree: idPlayer
        });

        // The test will capture the 500 response
        expect(res.statusCode).toEqual(500);
    });
});
