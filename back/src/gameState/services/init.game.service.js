import _ from 'lodash';
// import { ALIVE, DEBT, SOCKET_EVENTS, FIRST_DU, INIT_DISTRIB, JUNE, MASTER, START_GAME } from '#constantes';
// import decksService from './decks.service.js';
// import socket from '#config/socket';
// import { constructor } from '../../legacy/game/game.model.js';

export async function initGameJune(gameState, rules, socket) {
    // let decks = await decksService.generateDecks(rules);

    // const classes = rules.inequalityStart ? await generateInequality(gameState.avatars.length, rules.pctRich, rules.pctPoor) : [];

    // for await (let player of gameState.avatars) {
    //     // pull 4 cards from the deck and distribute to the player
    //     const cards = _.pullAt(decks[0], rules.amountCardsForProd === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
    //     player.cards = cards;
    //     player.status = ALIVE;

    //     if (game.inequalityStart) {
    //         if (classes[0] >= 1) {
    //             //classe basses
    //             player.coins = Math.floor(gameState.startAmountCoins / 2);
    //             classes[0]--;
    //         }
    //         else if (classes[2] >= 1) {
    //             // classe haute
    //             player.coins = Math.floor(game.startAmountCoins * 2);
    //             classes[2]--;
    //         }
    //         else {
    //             //classe moyenne
    //             player.coins = game.startAmountCoins;
    //         }
    //     }
    //     else {
    //         player.coins = game.startAmountCoins;
    //     }
    //     game.currentMassMonetary += player.coins;

    //     socket.emitAckTo(player.id, START_GAME, {
    //         cards: cards,
    //         coins: player.coins,
    //         game: {
    //             typeMoney: JUNE,
    //             status: START_GAME,
    //             amountCardsForProd: game.amountCardsForProd,
    //             generatedIdenticalLetters: game.generatedIdenticalLetters,
    //             theme: game.theme
    //         }
    //     });
    //     let newEvent = constructor.event(INIT_DISTRIB, MASTER, player.id, player.coins, cards, Date.now());
    //     socket.emitTo(game._id.toString() + EVENT, EVENT, newEvent);
    //     game.events.push(newEvent);
    // }
    // game.currentDU = await generateDU(game);
    // socket.emitTo(game._id.toString(), FIRST_DU, { du: game.currentDU });

    // let firstDUevent = constructor.event(FIRST_DU, MASTER, MASTER, game.currentDU, [], Date.now());
    // game.events.push(firstDUevent);
    // game.decks = decks;
    // return game;
}

export async function initGameDebt(gameState, rules, socket) {
    // let decks = await decksService.generateDecks(rules);

    // for await (let player of gameState.playersStates) {
    //     // pull cards from the deck and distribute to the player
    //     const cards = _.pullAt(decks[0], game.distribInitCards === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
    //     player.cards = cards;
    //     player.status = ALIVE;
    //     player.coins = 0;

    //     socket.emitAckTo(player.id, START_GAME, {
    //         cards: cards,
    //         coins: 0,
    //         typeMoney: DEBT,
    //         status: START_GAME,
    //         amountCardsForProd: game.amountCardsForProd,
    //         generatedIdenticalLetters: game.generatedIdenticalLetters,
    //         timerCredit: game.timerCredit,
    //         timerPrison: game.timerPrison,
    //         theme: game.theme
    //     });
    //     let newEvent = constructor.event(INIT_DISTRIB, MASTER, player.id, player.coins, cards, Date.now());
    //     socket.emitTo(game._id.toString() + SOCKET_EVENTS.EVENT, SOCKET_EVENTS.EVENT, newEvent);
    //     // game.events.push(newEvent);
    // }
    // game.decks = decks;
    // return game;
}

export default {
    initGameJune,
    initGameDebt
}
