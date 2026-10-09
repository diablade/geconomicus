import { PLAYER_STATUS } from '@geco/shared';

/**
 * The next universal dividend: a percentage of the average money held per living player.
 *
 * @param {object} gameState
 * @param {{tauxCroissance: number}} rules
 * @returns {Promise<number>} the dividend, rounded to two decimals
 */
export const generateDU = async (gameState, rules) => {
	const nbPlayer = gameState.playersStates.filter((p) => p.status === PLAYER_STATUS.ALIVE).length;
	const moyenne = gameState.currentMassMonetary / nbPlayer;
	const du = (moyenne * rules.tauxCroissance) / 100;
	return Number(du.toFixed(2));
};
