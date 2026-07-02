import DecksHelper from '../helpers/decks.helper.js';
import GameStateManager from '../managers/GameStateManager.js';
import EventHelper from '../helpers/event.helper.js';
import { DB_EVENTS } from '@geco/shared';

const DecksStateService = {};

DecksStateService.produce = async (gameStateId, playerStateIdx, cards) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const result = await DecksHelper.produce(entry.gameState, entry.rules, playerStateIdx, cards);

		const player = entry.gameState.playersStates.find((p) => p.idx === playerStateIdx);
		if (player) {
			player.actionTokens = (player.actionTokens ?? 0) + 1;
			result.actionTokens = player.actionTokens;
		}

		entry.events.push(
			EventHelper.createEvent(
				DB_EVENTS.PRODUCTION,
				entry.gameState.sessionId,
				gameStateId,
				playerStateIdx,
				playerStateIdx,
				{
					newCards: result.newCards,
				}
			)
		);

		return result;
	});
};

export default DecksStateService;
