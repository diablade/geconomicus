import EventModel from './event.model.js';
import log from '../../config/log.js';

/**
 * @description Create a new event
 * @route POST /api/events
 * @access Private
 */
const createEvent = async (req, res) => {
    try {
        const newEvent = await EventModel.createNew({
            sessionId: req.body.sessionId,
            gameId:    req.body.gameId,
            typeEvent: req.body.typeEvent,
            emitter:   req.body.emitter,
            receiver:  req.body.receiver,
            payload:   req.body.payload
        });

        return res.status(201).json({
            data: newEvent
        });
    }
    catch (error) {
        log.error('Error creating event:', error);
        return res.status(500).json({
            message: 'Failed to create event',
            error:   error.message
        });
    }
};

/**
 * @description Get event by ID
 * @route GET /api/events/:id
 * @access Private
 */
const getEventById = async (req, res) => {
    try {
        const {id} = req.params;
        const event = await EventModel.getById(id);

        if (!event) {
            return res.status(404).json({
                message: 'Event not found'
            });
        }

        return res.status(200).json({data: event});
    }
    catch (error) {
        log.error('Error fetching event:', error);
        return res.status(500).json({
            message: 'Failed to fetch event',
            error:   error.message
        });
    }
};

/**
 * @description Get all events for a session and game
 * @route GET /api/events/session/:sessionId/game/:gameId
 * @access Private
 */
const getEventsBySessionAndGame = async (req, res) => {
    try {
        const {
            sessionId,
            gameId
        } = req.params;
        const events = await EventModel.getBySessionIdAndGameId(sessionId, gameId);
        return res.status(200).json({
            count: events.length,
            data:  events
        });
    }
    catch (error) {
        log.error('Error fetching events:', error);
        return res.status(500).json({
            message: 'Failed to fetch events',
            error:   error.message
        });
    }
};

/**
 * @description Delete all events for a session
 * @route DELETE /api/events/session/:sessionId
 * @access Private (Admin only)
 */
const deleteEventsBySession = async (req, res) => {
    try {
        const {sessionId} = req.params;
        const result = await EventModel.removeBySessionId(sessionId);

        return res.status(200).json({
            message: `Successfully deleted ${result.deletedCount} events for session ${sessionId}`
        });
    }
    catch (error) {
        console.error('Error deleting events by session:', error);
        return res.status(500).json({
            message: 'Failed to delete events by session',
            error:   error.message
        });
    }
};

/**
 * @description Delete all events for a game
 * @route DELETE /api/events/game/:gameId
 * @access Private (Admin only)
 */
const deleteEventsByGame = async (req, res) => {
    try {
        const {gameId} = req.params;
        const result = await EventModel.removeByGameId(gameId);

        return res.status(200).json({
            message: `Successfully deleted ${result.deletedCount} events for game ${gameId}`
        });
    }
    catch (error) {
        console.error('Error deleting events by game:', error);
        return res.status(500).json({
            message: 'Failed to delete events by game',
            error:   error.message
        });
    }
};

export default {
    createEvent,
    getEventById,
    getEventsBySessionAndGame,
    deleteEventsBySession,
    deleteEventsByGame
};
