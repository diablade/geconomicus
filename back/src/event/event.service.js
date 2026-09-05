import EventModel from './event.model.js';
import mongoose from 'mongoose';
import log from '#config/log';
import LkGuard from '../gameState/helpers/lk.guard.js';

const EventService = {};

/* Retrieve */
/**
 * Replay order. Sorting on `at` alone leaves ties unordered, and a batch such as one DU tick
 * stamps every event it emits with the same `at`. `_id` breaks the tie in insertion order, so
 * the rising partial sums those events carry are read back in the order they were written.
 */
const REPLAY_ORDER = { at: 1, _id: 1 };

/** Every event of a session, in replay order. */
EventService.getBySessionId = async (sessionId) => {
	return await EventModel.find({
		sessionId,
	})
		.sort(REPLAY_ORDER)
		.exec();
};
/** Every event of one game, in replay order. */
EventService.getByGameStateId = async (gameStateId) => {
	return await EventModel.find({
		gameStateId,
	})
		.sort(REPLAY_ORDER)
		.exec();
};

/** Every event one avatar emitted or received in a game, in replay order. */
EventService.getByAvatarIdx = async (gameStateId, avatarIdx) => {
	return await EventModel.find({
		gameStateId,
		$or: [{ emitter: avatarIdx }, { receiver: avatarIdx }],
	})
		.sort(REPLAY_ORDER)
		.exec();
};

/* Post */
/**
 * @description Post an event
 * @param {string} typeEvent - The type of the event
 * @param {string} sessionId - The ID of the session
 * @param {string} gameStateId - The ID of the game state
 * @param {string} emitter - The emitter of the event
 * @param {string} receiver - The receiver of the event
 * @param {object} payload - The payload of the event
 * @returns {Promise<EventModel>} The created event
 */
EventService.postNow = async (typeEvent, sessionId, gameStateId, emitter, receiver, payload) => {
	log.debug(`[EventService] postNow: ${typeEvent} for game: ${gameStateId}`);
	LkGuard.assertEventContract(typeEvent, sessionId, gameStateId, payload);
	const newEvent = new EventModel({
		typeEvent,
		sessionId,
		gameStateId,
		emitter,
		receiver,
		payload,
	});
	return await newEvent.save();
};

/* Post */
/**
 * @description Post many events
 * @param {Array<object>} eventObjects - The array of event objects to post
 * @param {string} gameStateId - The ID of the game state
 * @returns {Promise<Array<EventModel>>} The created events
 */
EventService.postMany = async (eventObjects, gameStateId) => {
	log.debug(`[EventService] posting: ${eventObjects.length || 0} events for game: ${gameStateId}`);

	if (!Array.isArray(eventObjects) || eventObjects.length === 0) {
		return [];
	}
	const newEvents = eventObjects.map((eventObject) => ({
		typeEvent: eventObject.typeEvent,
		sessionId: new mongoose.Types.ObjectId(eventObject.sessionId),
		gameStateId: new mongoose.Types.ObjectId(eventObject.gameStateId),
		emitter: eventObject.emitter,
		receiver: eventObject.receiver,
		payload: eventObject.payload,
		at: eventObject.at || new Date(),
	}));
	return await EventModel.insertMany(newEvents);
};

/* Remove */
EventService.removeAllBySessionId = async (sessionId) => {
	log.info(`[EventService] removeAllBySessionId: ${sessionId}`);
	return await EventModel.deleteMany({ sessionId }).exec();
};
EventService.removeAllByGameStateId = async (gameStateId) => {
	log.info(`[EventService] removeAllByGameStateId: ${gameStateId}`);
	return await EventModel.deleteMany({ gameStateId }).exec();
};

export default EventService;
