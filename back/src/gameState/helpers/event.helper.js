const EventHelper = {};

/**
 * @description Create an event object
 * @param {string} typeEvent - The type of the event
 * @param {string} sessionId - The ID of the session
 * @param {string} gameStateId - The ID of the game state
 * @param {string} emitter - The emitter of the event
 * @param {string} receiver - The receiver of the event
 * @param {object} payload - The payload of the event
 * @param {number} [at=Date.now()] - The timestamp of the event
 * @returns {object} The created event object
 */
EventHelper.createEvent = (typeEvent, sessionId, gameStateId, emitter, receiver, payload, at = Date.now()) => {
	return {
		typeEvent,
		sessionId,
		gameStateId,
		emitter,
		receiver,
		payload,
		at,
	};
};

export default EventHelper;
