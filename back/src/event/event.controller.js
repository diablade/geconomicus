import EventService from './event.service.js';
import log from '../../config/log.js';

const EventController = {};
/**
 * @description Get event by ID
 * @route GET /api/events/:id
 * @access Private
 */
EventController.getBySessionId = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await EventService.getBySessionId(id);

        if (!event) {
            return res.status(404).json({
                message: 'Event not found'
            });
        }

        return res.status(200).json({ data: event });
    }
    catch (error) {
        log.error('Error fetching event:', error);
        return res.status(500).json({
            message: 'Failed to fetch event',
            error: error.message
        });
    }
};

/**
 * @description Get all events for a session and game
 * @route GET /api/events/session/:sessionId/game/:gameStateId
 * @access Private
 */
EventController.getByGameStateId = async (req, res) => {
    try {
        const {
            gameStateId
        } = req.params;
        const events = await EventService.getByGameStateId(gameStateId);
        return res.status(200).json({
            count: events.length,
            data: events
        });
    }
    catch (error) {
        log.error('Error fetching events:', error);
        return res.status(500).json({
            message: 'Failed to fetch events',
            error: error.message
        });
    }
};

export default EventController;
