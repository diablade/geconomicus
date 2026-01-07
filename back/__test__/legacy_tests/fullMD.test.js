import request from 'supertest';
import app from '../src/app.js';
import db from '#configTest/database';
import { C } from "#constantes";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const agent = request.agent(app);
let ioServer = socket.initIo(agent);
import _ from 'lodash';

let idGame;
let currentGame;
let currentDU = 0.5;
let numberOfPlayers = 10;

let players = [];
let playersId = [];

let getPlayerCardsUpdate = async (idPlayer) => {
    const res = await agent.get("/player/" + idGame + "/" + idPlayer).send();
    expect(res.statusCode).toEqual(200);
    expect(res.body.player).toBeTruthy();
    players = _.map(players, p => {
        return p.name === res.body.player.name ? res.body.player : p
    });
    currentDU = res.body.currentDU;
}

let transaction = async (idBuyer, idSeller, idCard) => {
    const res = await agent.post("/player/transaction").send({
        idGame: idGame,
        idBuyer: idBuyer,
        idSeller: idSeller,
        idCard: idCard
    });
    expect(res.statusCode).toEqual(200);
    await getPlayerCardsUpdate(idBuyer);
    await getPlayerCardsUpdate(idSeller);
}

let produce = async (idPlayer, cards) => {
    const res = await agent.post("/player/produce").send({
        idGame: idGame,
        idPlayer: idPlayer,
        cards: cards
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(5);
    let newCards = _.countBy(res.body, c => c.weight === cards[0].weight);
    let produceCard = _.countBy(res.body, c => c.weight === cards[0].weight + 1);
    expect(newCards.true).toEqual(4);
    expect(produceCard.true).toEqual(1);
    await getPlayerCardsUpdate(idPlayer);
}

let searchAndTryBuyCard = async (card, currentPlayer) => {
    // Attempt to trade cards with other players
    for await (const player of players) {
        if (currentPlayer._id !== player._id) {
            const cardToBuy = _.find(player.cards, c => c.letter === card.letter && c.weight === card.weight);
            if (cardToBuy && currentPlayer.coins >= (cardToBuy.price * currentDU)) {
                await transaction(currentPlayer._id, player._id, cardToBuy._id);
                return true;
            }
            else {
                return false;
            }
        }
    }
    return false;
}

let playerDoPlay = async (currentPlayer) => {
    // Group the cards by type (weight-letter)
    const groupedCards = _.groupBy(currentPlayer.cards, card => `${card.weight}-${card.letter}`);
    const square = Object.values(groupedCards).find(group => group.length === 4);
    if (square) {
        await produce(currentPlayer._id, square);
        return;
    }
    // Convert the grouped cards object into an array of groups
    const cardGroups = Object.values(groupedCards);
    // Sort the array of groups by the weight of the cards in descending order
    cardGroups.sort((a, b) => b[0].weight - a[0].weight);
    for await (let cardGroup of cardGroups) {
        const succeed = await searchAndTryBuyCard(cardGroup[0], currentPlayer);
        if (succeed) {
            return;
        }
    }
}
let play = async (round) => {
    for (let i = 1; i <= round; i++) {
        console.log("ROUND : ", i);
        for (let player of players) {
            if (player.status === C.ALIVE) {
                console.log("player" + player.name + " current playing ");
                await playerDoPlay(player);
            }
            else {
                //console.log("player " + player.status)
            }
        }
    }
}

let createPlayers = async (nb) => {
    for (let i = 1; i <= nb; i++) {
        const res = await agent.post("/player/join").send({
            idGame: idGame,
            name: "player" + i
        });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toBeTruthy();
        playersId.push(res.body);
    }
}
let updatePlayers = async () => {
    players = [];
    for (let id of playersId) {
        const resp = await agent.get("/player/" + idGame + "/" + id).send();
        players.push(resp.body.player);
    }
}
let CheckPlayersHand = async () => {
    for (let id of playersId) {
        const resp = await agent.get("/player/" + idGame + "/" + id).send();
        expect(resp.body.player.cards.length === 4).toBeTruthy();
    }
}
beforeEach(async () => {
    // Clear all instances and calls to constructor and all methods:
    // io.mockClear();
});
afterAll(async () => {
    const res = await agent.get("/game/" + idGame).send();
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeTruthy();
    console.log("ALL GAME RESULT:");
    // for (let player of res.body.players) {
    //console.log("player cards", player.name, player.cards);
    // console.log("event:", event.typeEvent, event.emitter, event.receiver, event.amount);
    // }
    await db.clear();
    // await db.close();
});

describe("FULL GAME simulation", () => {
    test("CREATE game", async () => {
        const res = await agent.post("/game/create").send({
            name: "test-full-simu",
            animator: "animator",
            location: "ici",
        });
        expect(res.statusCode).toEqual(200);
        expect(res.body._id).toBeTruthy();
        idGame = res.body._id;
        const modified = res.body.modified;
        const created = res.body.created;
        currentGame = res.body;
        //CHECK DEFAULT VALUES
        expect(res.body).toEqual({
            __v: 0,
            name: "test-full-simu",
            location: "ici",
            animator: "animator",
            _id: idGame,
            status: C.OPEN,
            typeMoney: "june",
            events: [
                {
                    "_id": expect.any(String),
                    "amount": 0,
                    "date": expect.any(String),
                    "emitter": "master",
                    "receiver": "master",
                    "resources": [],
                    "typeEvent": "create-game",
                }
            ],
            decks: [],
            players: [],
            amountCardsForProd: 4,
            currentMassMonetary: 0,
            generatedIdenticalLetters: 4,
            distribInitCards: 4,
            generateLettersAuto: true,
            generateLettersInDeck: 0,

            surveyEnabled: true,
            autoDeath: true,
            deathPassTimer: 4,
            devMode: false,
            priceWeight1: 1,
            priceWeight2: 2,
            priceWeight3: 4,
            priceWeight4: 8,
            round: 0,
            roundMax: 1,
            roundMinutes: 25,

            //option june
            currentDU: 0,
            tauxCroissance: 5,
            inequalityStart: false,
            startAmountCoins: 5,
            pctPoor: 10,
            pctRich: 10,

            //option debt
            credits: [],
            defaultCreditAmount: 3,
            defaultInterestAmount: 1,
            bankInterestEarned: 0,
            bankGoodsEarned: 0,
            bankMoneyLost: 0,
            timerCredit: 5,
            timerPrison: 5,
            manualBank: true,
            seizureType: "decote",
            seizureCosts: 2,
            seizureDecote: 33,

            modified: modified,
            created: created,
        });
    });
    test("UPDATE game", async () => {
        const res = await agent.put("/game/update").send({
            typeMoney: "debt",
            name: "test-full-md-simu",
            idGame: idGame,
            surveyEnabled: false,
            autoDeath: false,
            roundMinutes: 1,
        });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toStrictEqual({
            status: "updated",
        });
    });
    test("ADD PLAYERS", async () => {
        await createPlayers(numberOfPlayers);
    });
    test("START game", async () => {
        const resStart = await agent.put("/game/start").send({
            idGame: idGame,
            typeMoney: C.DEBT
        });
        expect(resStart.statusCode).toEqual(200);
        expect(resStart.body).toBeTruthy();
    });
    test("CHECK cards distributed to players", async () => {
        await CheckPlayersHand();
    });
    test("CHECK decks cards in game", async () => {
        const res = await agent.get("/game/" + idGame).send();
        expect(res.statusCode).toEqual(200);
        expect(res.body.decks).toBeTruthy();
        expect(res.body.decks[0].length).toEqual(4);
        expect(res.body.decks[1].length).toEqual(44);
        expect(res.body.decks[2].length).toEqual(44);
        expect(res.body.decks[3].length).toEqual(44);
    });
    test("GRANT CREDITS", async () => {
        await updatePlayers();
        for (let player of players) {
            const resCredit = await agent.post("/bank/create-credit").send({
                idGame: idGame,
                idPlayer: player._id,
                amount: 3,
                interest: 1,
            });
            expect(resCredit.statusCode).toEqual(200);
            expect(resCredit.body).toBeTruthy();
            expect(resCredit.body._id).toBeTruthy();
            expect(resCredit.body.status).toEqual(C.PAUSED_CREDIT);
        }
    });
    test("START round", async () => {
        const res = await agent.post("/game/start-round").send({
            idGame: idGame,
            round: 0
        });
        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toEqual(C.START_ROUND);
    });
    test("RUNNING CREDIT", async () => {
        const res = await agent.get("/game/" + idGame).send();
        expect(res.statusCode).toEqual(200);
        expect(res.body.credits.length).toEqual(numberOfPlayers);
        for (let credit of res.body.credits) {
            expect(credit.status).toEqual(C.RUNNING_CREDIT);
        }
    });
    test("TEST concurrent TRANSACTION", async () => {
        const seller = players[0];
        const buyer1 = players[1];
        const buyer2 = players[2];

        const cardToSell = seller.cards[0];

        const p1 = agent.post("/player/transaction").send({
            idGame: idGame,
            idBuyer: buyer1._id,
            idSeller: seller._id,
            idCard: cardToSell._id
        }).then(res => expect(res.statusCode).toEqual(200));
        const p2 = agent.post("/player/transaction").send({
            idGame: idGame,
            idBuyer: buyer2._id,
            idSeller: seller._id,
            idCard: cardToSell._id
        }).then(res => expect(res.statusCode).toEqual(409));
        p1.then(() => agent.post("/player/transaction").send({
            idGame: idGame,
            idBuyer: seller._id,
            idSeller: buyer1._id,
            idCard: cardToSell._id
        }).then(res => expect(res.statusCode).toEqual(200)));
    });
    test("CHECK pay interest and settle credits", async () => {
        const res1 = await agent.post("/bank/create-credit").send({
            idGame: idGame,
            idPlayer: players[0]._id,
            amount: 3,
            interest: 0
        });
        expect(res1.statusCode).toEqual(200);
        expect(res1.body).toBeTruthy();
        expect(res1.body._id).toBeTruthy();
        expect(res1.body.status).toEqual(C.RUNNING_CREDIT);
        const res2 = await agent.post("/bank/create-credit").send({
            idGame: idGame,
            idPlayer: players[1]._id,
            amount: 3,
            interest: 0
        });
        expect(res2.statusCode).toEqual(200);
        expect(res2.body).toBeTruthy();
        expect(res2.body._id).toBeTruthy();
        expect(res2.body.status).toEqual(C.RUNNING_CREDIT);

        await updatePlayers();

        const res = await agent.get("/game/" + idGame).send();
        expect(res.statusCode).toEqual(200);
        const credit1 = res.body.credits[0];
        const credit2 = res.body.credits[1];
        expect(credit1.status).toEqual(C.RUNNING_CREDIT);
        expect(credit2.status).toEqual(C.RUNNING_CREDIT);

        const credit1After = await agent.post("/bank/pay-interest").send({
            idGame: idGame,
            idPlayer: credit1.idPlayer,
            idCredit: credit1._id
        });
        expect(credit1After.statusCode).toEqual(200);
        expect(credit1After.body.status).toEqual(C.RUNNING_CREDIT);
        const credit2After = await agent.post("/bank/settle-credit").send({
            idGame: idGame,
            idPlayer: credit2.idPlayer,
            idCredit: credit2._id
        });
        expect(credit2After.statusCode).toEqual(200);
        expect(credit2After.body.status).toEqual(C.CREDIT_DONE);
    });
    test("PLAY 10 rounds and STOP", async () => {
        await updatePlayers();
        await play(2);
        // await playerService.killPlayer()
        // await play(5);
        const res = await agent.post("/game/stop-round").send({
            idGame: idGame,
            round: 0
        });
        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toEqual(C.STOP_ROUND);
    });
    test("END GAME", async () => {
        const res = await agent.post("/game/end").send({ idGame: idGame });
        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toEqual(C.END_GAME);
    });
});
