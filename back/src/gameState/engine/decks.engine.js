import { DB_EVENTS } from '@geco/shared';
import EventHelper from '../helpers/event.helper.js';
import DecksHelper from '../helpers/decks.helper.js';

const DecksEngine = {};

/**
 * Exchange a completed recipe for a card one weight up, and pay the producer a token.
 *
 * The exchange itself is DecksHelper's, which validates the whole trade before mutating
 * anything — a hand short of the recipe, or a deck too thin to redraw from, throws with
 * nothing moved. The token grant and the event are what make it a game action rather
 * than a deck operation.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @param {number} playerStateIdx - the producer
 * @param {Array<{key: string}>} cards - the copies being exchanged
 * @returns {{cardsLK: object[], consumed: object[], newCards: object[], producedCard: object, weight: number,
 *            actionTokens: number, player: object}}
 * @throws {Error} when the hand or the decks cannot satisfy the exchange
 */
DecksEngine.produce = (entry, playerStateIdx, cards) => {
	const { gameState, rules, events } = entry;
	const result = DecksHelper.produce(gameState, rules, playerStateIdx, cards);

	const player = gameState.playersStates.find((p) => p.idx === playerStateIdx);
	player.actionTokens = (player.actionTokens ?? 0) + 1;

	events.push(
		EventHelper.createEvent(DB_EVENTS.PRODUCTION, gameState, {
			emitter: playerStateIdx,
			receiver: playerStateIdx,
			payload: { consumed: result.consumed, produced: result.producedCard, newCards: result.newCards },
		})
	);

	return { ...result, actionTokens: player.actionTokens, player };
};

export default DecksEngine;
