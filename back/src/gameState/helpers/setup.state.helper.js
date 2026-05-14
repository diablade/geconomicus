import { PLAYER_STATUS, GAME_STATUS } from '@geco/shared';
import decksService from './decks.state.helper.js';
import _ from 'lodash';

//***************** DEFAULT VALUES *******//
export const minute = 60 * 1000;
export const defaultTauxDU = 10;
export const defaultPriceWeight1 = 1;
export const defaultPriceWeight2 = 2;
export const defaultPriceWeight3 = 4;
export const defaultPriceWeight4 = 8;
export const defaultPriceWeight1ML = 3;
export const defaultPriceWeight2ML = 6;
export const defaultPriceWeight3ML = 9;
export const defaultPriceWeight4ML = 12;
//***************************************//

//***************** DIVIDENDE UNIVERSEL ENGIN **********************************//
export async function generateDU(gameState, rules) {
    const nbPlayer = gameState.playersStates.filter(p => p.status === PLAYER_STATUS.ALIVE).length;
    const moyenne = gameState.currentMassMonetary / nbPlayer;
    const du = moyenne * rules.tauxCroissance / 100;
    const duRounded = Number(du.toFixed(2));
    return duRounded;
}
//******************************************************************************//

//***************** INÉGALITÉ INITIALE *****************************************//
//10% de riche = 2x le median
//10% de pauvre = 1/2 le median
//80% classe moyenne = la moyenne
export async function generateInequality(nbPlayer, pctRich, pctPoor) {
    const classHaute = Math.floor(nbPlayer * (pctRich / 100));
    const classBasse = Math.floor(nbPlayer * (pctPoor / 100));
    const classMoyenne = nbPlayer - classHaute - classBasse;
    return [classBasse, classMoyenne, classHaute];
}
//******************************************************************************//

//***************** SETUP JUNE GAME *************************************************//
export async function setupGameJune(gameState, rules) {
    let decks = await decksService.generateDecks(rules, gameState.playersStates.length);

    const classes = rules.inequalityStart ? await generateInequality(gameState.playersStates.length, rules.pctRich, rules.pctPoor) : [];

    for await (let playerState of gameState.playersStates) {
        // pull 4 cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], rules.amountCardsForProd === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
        playerState.cards = cards;
        playerState.status = PLAYER_STATUS.ALIVE;

        if (rules.inequalityStart) {
            if (classes[0] >= 1) {
                //classe basses
                playerState.coins = Math.floor(rules.startAmountCoins / 2);
                classes[0]--;
            }
            else if (classes[2] >= 1) {
                // classe haute
                playerState.coins = Math.floor(rules.startAmountCoins * 2);
                classes[2]--;
            }
            else {
                //classe moyenne
                playerState.coins = rules.startAmountCoins;
            }
        }
        else {
            playerState.coins = rules.startAmountCoins;
        }
        gameState.currentMassMonetary += playerState.coins;
    }
    gameState.currentDU = await generateDU(gameState, rules);
    gameState.decks = decks;
    gameState.status = GAME_STATUS.INITIALIZED;
    return gameState;
}
//******************************************************************************//

//***************** SETUP DEBT GAME *************************************************//
export async function setupGameDebt(gameState, rules) {
    let decks = await decksService.generateDecks(rules, gameState.playersStates.length);

    for await (let playerState of gameState.playersStates) {
        // pull cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], rules.distribInitCards === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
        playerState.cards = cards;
        playerState.status = PLAYER_STATUS.ALIVE;
        playerState.coins = 0;
    }
    gameState.decks = decks;
    gameState.status = GAME_STATUS.INITIALIZED;
    return gameState;
}
//******************************************************************************//

export default {
    setupGameJune,
    setupGameDebt,
};
