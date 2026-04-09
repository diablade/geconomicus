import { ALIVE } from '#constantes';

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

//10% de riche = 2x le median
//10% de pauvre = 1/2 le median
//80% classe moyenne = la moyenne
export async function generateInequality(nbPlayer, pctRich, pctPoor) {
    const classHaute = Math.floor(nbPlayer * (pctRich / 100));
    const classBasse = Math.floor(nbPlayer * (pctPoor / 100));
    const classMoyenne = nbPlayer - classHaute - classBasse;
    return [classBasse, classMoyenne, classHaute];
}

