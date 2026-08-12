import { PLAYER_STATUS, GAME_STATUS } from '@geco/shared';
import decksService from './decks.helper.js';
import { generateDU } from './money.helper.js';
import log from '#config/log';
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

/**
 * Deal every player their opening hand from the level-0 deck.
 *
 * Both game types read `distribInitCards`, so the field that is named for distributing the
 * initial cards is the one that does it — the June game used to deal from `amountCardsForProd`,
 * the recipe size, which silently gave the two games different openings.
 *
 * Refuses to deal at all when the deck cannot supply every player, because dealing past the end
 * of the deck puts `undefined` in the last hands instead of cards.
 *
 * @param {object} gameState - mutated
 * @param {Array<Array<object>>} decks
 * @param {{distribInitCards: number}} rules
 * @throws {Error} ERROR.NOT_ENOUGH_CARDS_IN_DECK when the level-0 deck is too small
 */
function dealOpeningHands(gameState, decks, rules) {
	const handSize = rules.distribInitCards;
	const players = gameState.playersStates.length;
	const needed = players * handSize;

	if (decks[0].length < needed) {
		log.error(
			`[SetupHelper] level-0 deck holds ${decks[0].length} cards, ${players} players × ${handSize} needs ${needed}`
		);
		throw new Error('ERROR.NOT_ENOUGH_CARDS_IN_DECK');
	}

	for (const playerState of gameState.playersStates) {
		playerState.cards = _.pullAt(decks[0], _.range(handSize));
		playerState.status = PLAYER_STATUS.ALIVE;
		playerState.actionTokens = rules.startingTokens ?? 1;
	}
}

//***************** SETUP JUNE GAME *************************************************//
export async function setupGameJune(gameState, rules) {
	let decks = await decksService.generateDecks(rules, gameState.playersStates.length);

	const classes = rules.inequalityStart
		? await generateInequality(gameState.playersStates.length, rules.pctRich, rules.pctPoor)
		: [];

	dealOpeningHands(gameState, decks, rules);

	for (const playerState of gameState.playersStates) {
		if (rules.inequalityStart) {
			if (classes[0] >= 1) {
				//classe basses
				playerState.coins = Math.floor(rules.startAmountCoins / 2);
				classes[0]--;
			} else if (classes[2] >= 1) {
				// classe haute
				playerState.coins = Math.floor(rules.startAmountCoins * 2);
				classes[2]--;
			} else {
				//classe moyenne
				playerState.coins = rules.startAmountCoins;
			}
		} else {
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

	dealOpeningHands(gameState, decks, rules);
	for (const playerState of gameState.playersStates) {
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
