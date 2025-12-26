import EventModel from './event.schema.js';

const EventService = {};

/* Retrieve */
EventService.getBySessionId = async (sessionId) => {
    return await EventModel.find({
        sessionId
    }).sort({ createdAt: 1 }).exec();
};
EventService.getByGameStateId = async (gameStateId) => {
    return await EventModel.find({
        gameStateId
    }).sort({ createdAt: 1 }).exec();
};


/* Create */
/**
 * @description Create an event
 * @param {string} typeEvent - The type of the event
 * @param {string} sessionId - The ID of the session
 * @param {string} gameId - The ID of the game
 * @param {string} emitter - The emitter of the event
 * @param {string} receiver - The receiver of the event
 * @param {object} payload - The payload of the event
 * @returns {Promise<EventModel>} The created event
 */
EventService.create = async (typeEvent, sessionId, gameId, emitter, receiver, payload) => {
    const newEvent = new EventModel({
        typeEvent: typeEvent,
        sessionId: sessionId,
        gameId: gameId,
        emitter: emitter,
        receiver: receiver,
        payload: payload,
    });
    return await newEvent.save();
};

/* Remove */
EventService.removeAllBySessionId = async (sessionId) => {
    return await EventModel.deleteMany({ sessionId }).exec();
};
EventService.removeAllByGameStateId = async (gameStateId) => {
    return await EventModel.deleteMany({ gameStateId }).exec();
};

export default EventService;
