import request from 'supertest';
import app from '../src/app';
import db from '../__test__/config/database';

const agent = request.agent(app);

beforeAll(async () => await db.connect());
// afterEach(async () => await db.clear());
afterAll(async () => {
    await db.clear();
    await db.close();
});

describe("game controller test", () => {
    describe("POST /game/create", () => {
        test("create game successful", async () => {
            const res = await agent.post("/game/create").send({gameName: "test-name"});
            expect(res.statusCode).toEqual(200);
            expect(res.body).toBeTruthy();
        });
    });
});
