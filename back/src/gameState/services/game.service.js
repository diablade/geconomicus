import { ALIVE, FIRST_DU, MASTER } from '#constantes';

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
export async function generateDU(game) {
    const nbPlayer = game.avatars.filter(p => p.status === ALIVE).length;
    const moyenne = game.currentMassMonetary / nbPlayer;
    const du = moyenne * game.tauxCroissance / 100;
    const duRounded = Number(du.toFixed(2));
    return duRounded;
}
//******************************************************************************//


//***************** INÉGALITÉ INITIALE ********************************//
//10% de riche = 2x le median
//10% de pauvre = 1/2 le median
//80% classe moyenne = la moyenne
export async function generateInequality(nbPlayer, pctRich, pctPoor) {
    const classHaute = Math.floor(nbPlayer * (pctRich / 100));
    const classBasse = Math.floor(nbPlayer * (pctPoor / 100));
    const classMoyenne = nbPlayer - classHaute - classBasse;
    return [classBasse, classMoyenne, classHaute];
}
//*********************************************************************//


//***************** SETUP JUNE ********************************//
export async function setupGameJune(gameState, rules) {
    let decks = await decksService.generateDecks(rules);

    const classes = rules.inequalityStart ? await generateInequality(gameState.avatars.length, rules.pctRich, rules.pctPoor) : [];

    for await (let player of gameState.avatars) {
        // pull 4 cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], rules.amountCardsForProd === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
        player.cards = cards;
        player.status = ALIVE;

        if (rules.inequalityStart) {
            if (classes[0] >= 1) {
                //classe basses
                player.coins = Math.floor(gameState.startAmountCoins / 2);
                classes[0]--;
            }
            else if (classes[2] >= 1) {
                // classe haute
                player.coins = Math.floor(game.startAmountCoins * 2);
                classes[2]--;
            }
            else {
                //classe moyenne
                player.coins = rules.startAmountCoins;
            }
        }
        else {
            player.coins = rules.startAmountCoins;
        }
        gameState.currentMassMonetary += player.coins;
    }
    gameState.currentDU = await generateDU(gameState);

    let firstDUevent = constructor.event(FIRST_DU, MASTER, MASTER, gameState.currentDU, [], Date.now());
    gameState.decks = decks;
    return gameState;
}
//***************************************************************//

//***************** SETUP DEBT ****************************//
export async function setupGameDebt(gameState, rules) {
    let decks = await decksService.generateDecks(rules);

    for await (let player of gameState.playersStates) {
        // pull cards from the deck and distribute to the player
        const cards = _.pullAt(decks[0], rules.distribInitCards === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
        player.cards = cards;
        player.status = ALIVE;
        player.coins = 0;
    }
    gameState.decks = decks;
    return game;
}
//**********************************************************//

