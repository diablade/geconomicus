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
 * Deal every player their opening hand from the level-0 deck, and the rich a bonus from the level-1 deck.
 *
 * Both game types read `distribInitCards`, so the field that is named for distributing the
 * initial cards is the one that does it — the June game used to deal from `amountCardsForProd`,
 * the recipe size, which silently gave the two games different openings.
 *
 * With `inequalityCards`, the poor get half the hand, the middle class the full hand, and the rich the
 * full hand plus half of it in level-1 cards (4 → poor 2, middle 4, rich 4 + 2). If the percentages
 * add up past 100 the surplus is cut off the end, so the poor and rich are served first.
 *
 * Refuses to deal at all when a deck cannot supply every player, because dealing past the end
 * of the deck puts `undefined` in the last hands instead of cards.
 *
 * @param {object} gameState - mutated
 * @param {Array<Array<object>>} decks
 * @param {{distribInitCards: number, inequalityCards?: boolean, pctRichCards?: number, pctPoorCards?: number}} rules
 * @throws {Error} ERROR.NOT_ENOUGH_CARDS_IN_DECK when the level-0 or level-1 deck is too small
 */
async function dealOpeningHands(gameState, decks, rules) {
	const handSize = rules.distribInitCards;
	const half = Math.floor(handSize / 2);
	const players = gameState.playersStates.length;
	const [poor, middle, rich] = rules.inequalityCards
		? await generateInequality(players, rules.pctRichCards, rules.pctPoorCards)
		: [0, players, 0];
	const hands = [
		..._.times(poor, () => ({ level0: half, level1: 0 })),
		..._.times(rich, () => ({ level0: handSize, level1: half })),
		..._.times(Math.max(middle, 0), () => ({ level0: handSize, level1: 0 })),
	].slice(0, players);
	const needed0 = _.sumBy(hands, 'level0');
	const needed1 = _.sumBy(hands, 'level1');

	if (decks[0].length < needed0 || decks[1].length < needed1) {
		log.error(
			`[SetupHelper] decks hold ${decks[0].length} level-0 and ${decks[1].length} level-1 cards, ${players} players need ${needed0} and ${needed1}`
		);
		throw new Error('ERROR.NOT_ENOUGH_CARDS_IN_DECK');
	}

	gameState.playersStates.forEach((playerState, i) => {
		playerState.cards = [..._.pullAt(decks[0], _.range(hands[i].level0)), ..._.pullAt(decks[1], _.range(hands[i].level1))];
		playerState.status = PLAYER_STATUS.ALIVE;
		playerState.actionTokens = rules.startingTokens ?? 1;
	});
}

//***************** SETUP JUNE GAME *************************************************//
export async function setupGameJune(gameState, rules) {
	let decks = await decksService.generateDecks(rules, gameState.playersStates.length);

	const classes = rules.inequalityStart
		? await generateInequality(gameState.playersStates.length, rules.pctRich, rules.pctPoor)
		: [];

	await dealOpeningHands(gameState, decks, rules);

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

	await dealOpeningHands(gameState, decks, rules);
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
