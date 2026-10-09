import GameStateManager from '../managers/GameStateManager.js';
import DecksEngine from '../engine/decks.engine.js';
import SyncHelper from '../helpers/sync.helper.js';

const DecksStateService = {};

/**
 * Build a completed recipe, then tell the Table what moved.
 *
 * Produce emits nothing to any room on its own, so the Table would otherwise never see
 * the producer's new hand and tokens or the two deck levels that changed. See docs/adr/0008.
 *
 * @param {string} gameStateId
 * @param {number} playerStateIdx
 * @param {Array<{key: string}>} cards
 * @returns {Promise<object>} the production result, including the producer's new token count
 */
DecksStateService.produce = async (gameStateId, playerStateIdx, cards) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { player, ...result } = DecksEngine.produce(entry, playerStateIdx, cards);

		SyncHelper.emitPlayerSync(gameStateId, [player]);
		SyncHelper.emitDecksSync(gameStateId, entry.gameState, [result.weight, result.weight + 1]);

		return result;
	});
};

export default DecksStateService;
