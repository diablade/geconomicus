import LkGuard from './lk.guard.js';
import LkBuilder from './lk.builder.js';

const EventHelper = {};

/**
 * @description Create an event object, taking its Last-Known data from the gameState
 * as declared by EVENT_LK_CONTRACT.
 * @param {string} typeEvent - The type of the event
 * @param {object} gameState - The game state the event is emitted from
 * @param {object} options
 * @param {string|number} options.emitter - Who acted
 * @param {string|number} options.receiver - Who was acted upon
 * @param {number[]} [options.touched] - Lives whose LK must be captured, when emitter/receiver do not name them
 * @param {object} [options.payload] - Domain payload merged under the Last-Known data
 * @param {number} [options.at] - The timestamp of the event
 * @returns {object} The created event object
 */
EventHelper.createEvent = (typeEvent, gameState, { emitter, receiver, touched, payload = {}, at = Date.now() } = {}) => {
	const sessionId = gameState?.sessionId;
	const gameStateId = gameState?._id?.toString ? gameState._id.toString() : gameState?._id;
	const lk = LkBuilder.build(typeEvent, gameState, LkBuilder.resolveTouched(gameState, emitter, receiver, touched));
	const event = {
		typeEvent,
		sessionId,
		gameStateId,
		emitter,
		receiver,
		payload: { ...payload, ...lk },
		at,
	};
	LkGuard.assertEventContract(typeEvent, sessionId, gameStateId, event.payload);
	return event;
};

export default EventHelper;
