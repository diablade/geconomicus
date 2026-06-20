import DecksHelper from '../helpers/decks.helper.js';

const DecksStateService = {};

DecksStateService.produce = async (gameStateId, playerStateIdx, cards) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const result = await DecksHelper.produce(entry.gameState, playerStateIdx, cards);

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
