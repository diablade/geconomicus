import EventModel from '../schemas/event.schema.js';

/* Create */
EventModel.createNew = async (eventObject) => {
    const newEvent = new EventModel({
        typeEvent: eventObject.typeEvent || '',
        sessionId: eventObject.sessionId || '',
        gameId: eventObject.gameId || '',
        emitter: eventObject.emitter || '',
        receiver: eventObject.receiver || '',
        payload: eventObject.payload || '',
    });
    return await newEvent.save();
};

/* Retrieve */
EventModel.getById = async (id) => {
    return await EventModel.findById(id).exec();
};
EventModel.getBySessionIdAndGameId = async (sessionId, gameId) => {
    return await EventModel.find({ sessionId, gameId }).sort({ createdAt: 1 }).exec();
};

/* Remove */
EventModel.removeBySessionId = async (sessionId) => {
    return await EventModel.deleteMany({ sessionId }).exec();
};
EventModel.removeByGameId = async (gameId) => {
    return await EventModel.deleteMany({ gameId }).exec();
};

export default EventModel;