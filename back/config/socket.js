import {Server} from 'socket.io';
import * as C from "../../config/constantes.js";
import log from "./log.js";

// Constants
const CLEANUP_INTERVAL = 300000; // 30 minutes
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECTION_DELAY = 5000; // 5 seconds

class SocketManager {
    static #instance = null;

    constructor() {
        if (SocketManager.#instance) {
            log.error("Use SocketManager.getInstance() to get the singleton instance.");
            throw new Error("Use SocketManager.getInstance() to get the singleton instance.");
        }
        this.ioInstance = null;
        this.connections = new Map(); // idPlayer -> { socket, lastActive, reconnectAttempts, idGame }
        // Acknowledgment pool: idPlayer -> Map(eventId -> { event, data, timestamp })
        this.ackPool = new Map();

        // Setup cleanup interval for stale connections
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [idPlayer, data] of this.connections.entries()) {
                const { socket, lastActive, reconnectAttempts } = data;

                // Clean up if socket is disconnected and exceeded max reconnection attempts
                if (!socket.connected && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    log.info(`Cleaning up socket for player ${idPlayer} - max reconnection attempts reached`);
                    this.cleanupConnection(idPlayer);
                }
                // Clean up if socket is stale (no activity for a long time)
                else if (now - lastActive > 3600000) { // 1 hour
                    log.info(`Cleaning up stale socket for player ${idPlayer}`);
                    this.cleanupConnection(idPlayer);
                }
            }

            // Clean up old unacknowledged events (older than 1 day)
            this.cleanupOldAcks();

        }, CLEANUP_INTERVAL);

        // Handle process cleanup
        process.on('SIGINT', this.cleanupAll.bind(this));
        process.on('SIGTERM', this.cleanupAll.bind(this));
    }

    // Singleton access method
    static getInstance() {
        if (!SocketManager.#instance) {
            SocketManager.#instance = new SocketManager();
        }
        return SocketManager.#instance;
    }

    initIo(server) {
        this.ioInstance = new Server(server, {
            cors:                    {
                origin:      "*",
                credentials: false,
                methods:     ["GET", "POST"]
            },
            pingInterval:            3000,      // Send a ping every 3 seconds
            pingTimeout:             6000,       // Wait 6 seconds before considering the connection closed
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
                skipMiddlewares:          true
            },
            maxHttpBufferSize:       1e8,   // 100MB max buffer size
            allowEIO3:               true,          // For older clients
            ackTimeout:              6000,        // 6 seconds timeout for acknowledgements
            logFailure:              true,         // Log failed emissions
            transports:              ["websocket"], // 🚫 no fallback polling => missing packets
            allowUpgrades:           true,
            perMessageDeflate:       {
                threshold: 1024, // Only compress messages larger than 1KB
            },
        });

        // Enable debugging in development
        if (process.env.NODE_ENV === 'development') {
            this.ioInstance.engine.on("connection_error", (err) => {
                log.error('Socket connection error:', err);
            });
        }

        this.setupConnectionHandlers();
        log.info("Socket.IO initialized.");
        return this.ioInstance;
    }

    setupConnectionHandlers() {
        this.setupAckHandler();
        this.ioInstance.on('connection', (socket) => {
            const {
                idPlayer,
                idGame
            } = socket.handshake.query;

            if (!this.validateConnection(idPlayer, idGame)) {
                socket.disconnect();
                return;
            }

            this.handleNewConnection(socket, idPlayer, idGame);
        });
    }

    validateConnection(idPlayer, idGame) {
        if (!idPlayer || !idGame) {
            log.error('socket error, idPlayer or idGame is missing in the query parameters.');
            return false;
        }
        return true;
    }

    handleNewConnection(socket, idPlayer, idGame) {
        log.info(`New connection - Player: ${idPlayer}, Game: ${idGame}, Socket: ${socket.id}`);

        // Store connection data with timestamp and reconnect attempts
        const connectionData = {
            socket,
            lastActive:        Date.now(),
            reconnectAttempts: 0,
            idGame,
            disconnectHandler: null,
            errorHandler:      null,
        };

        // Handle previous connection if exists
        const previousConnection = this.connections.get(idPlayer);
        if (previousConnection && previousConnection.socket.connected && process.env.NODE_ENV === 'production') {
            // Clean up previous connection
            try {
                log.info(`Replacing previous socket for player ${idPlayer}`);
                previousConnection.socket.emit('kicked', {
                    reason:    'another_connection',
                    timestamp: Date.now(),
                    idPlayer:  idPlayer
                });
            }
            catch (e) {
                log.warn(`Failed to notify kicked socket for player ${idPlayer}:`, e);
            }

            this.cleanupConnection(idPlayer);
        }

        // Set up event handlers
        connectionData.disconnectHandler = (reason) => this.handleDisconnect(idPlayer, reason);
        connectionData.errorHandler = (error) => this.handleError(idPlayer, error);

        // Store the new connection
        this.connections.set(idPlayer, connectionData);
        // Join rooms
        socket.join(idGame);
        socket.join(idPlayer);

        // Send connection confirmation with server timestamp
        socket.emit('connected', {
            timestamp:  Date.now(),
            sessionId:  socket.id,
            idPlayer:   idPlayer,
            idGame:     idGame,
            serverTime: new Date().toISOString(),
            config:     {
                // heartbeatInterval: HEARTBEAT_INTERVAL,
                maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
                reconnectionDelay:    RECONNECTION_DELAY
            }
        });

        socket.on('disconnect', connectionData.disconnectHandler);
        socket.on('error', connectionData.errorHandler);
        socket.onAny(() => {
            // Track last activity on any socket event
            const connData = this.connections.get(idPlayer);
            if (connData) {
                connData.lastActive = Date.now();
            }
        });
        socket.on(C.SHORT_CODE_EMIT, (data) => {
            log.info('ShortCodeEmitted:', data.code);
            this.emitTo(idGame, C.SHORT_CODE_BROADCAST, data);
        });
        socket.on(C.SHORT_CODE_CONFIRMED, (data) => {
            log.info('ShortCodeConfirmed');
            this.emitTo(data.idBuyer, C.SHORT_CODE_CONFIRMED, data);
        });
        socket.on('connect_error', () => log.error('Connection error:', err.message));
        socket.on('connect_timeout', (data) => log.error('time out:', data));
        socket.on('timeout', (err) => log.error('io socket time out!:', err));
        socket.on('reconnect_failed', (err) => log.error('All reconnection attempts failed:', err));
        socket.on('reconnect_attempt', (attempt) => this.handleReconnect(idPlayer, attempt));
        socket.on('reconnecting', (err) => log.error('reconnecting...', err));
        socket.on('reconnect', (attemptNumber) => log.info('Reconnected after ' + attemptNumber + ' attempts'));
        socket.on('reconnect_error', () => log.error('Reconnection error'));
        socket.on('error', (err) => log.error('error io socket:', err));

        // Check for unacknowledged events
        const unacknowledged = this.getUnacknowledgedEvents(idPlayer);
        if (unacknowledged.length > 0) {
            log.info(`Player ${idPlayer} reconnected with ${unacknowledged.length} unacknowledged events`);

            // Send resync signal
            socket.emit('resync', { needsResync: true });

            // Optionally, you can resend unacknowledged events here
            // unacknowledged.forEach(({ event, data, timestamp }) => {
            //     socket.emit(event, { ...data, _isResend: true });
            // });

            // Or just clear the ack pool for this player
            this.ackPool.delete(idPlayer);
        }
    }

    // Handle disconnection
    handleDisconnect(idPlayer, reason) {
        const connection = this.connections.get(idPlayer);
        if (!connection) {
            return;
        }

        const {
            socket,
            reconnectAttempts,
            idGame
        } = connection;

        log.info(`game ${idGame},Player ${idPlayer} disconnected. Reason: ${reason}. Reconnect attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}`);

        this.cleanupConnection(idPlayer);

    }

    // Handle reconnect
    handleReconnect(idPlayer, attempt) {
        const connection = this.connections.get(idPlayer);
        if (!connection) {
            return;
        }
        // Update reconnect attempts
        connection.reconnectAttempts++;
        connection.lastActive = Date.now();

        this.connections.set(idPlayer, connection);

        // If we've exceeded max reconnection attempts, clean up
        if (connection.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            log.warn(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached for player ${idPlayer}. Cleaning up.`);
            this.cleanupConnection(idPlayer);
        }
    }

    // Handle socket errors
    handleError(idPlayer, error) {
        log.error(`Socket error for player ${idPlayer}:`, error);
        const connection = this.connections.get(idPlayer);
        if (connection) {
            connection.lastActive = Date.now();
        }
    }

    // Clean up connection resources
    cleanupConnection(idPlayer) {
        const connection = this.connections.get(idPlayer);
        if (!connection) {
            return;
        }

        const {
            socket,
            disconnectHandler,
            errorHandler
        } = connection;

        // Remove event listeners
        if (disconnectHandler) {
            socket.off('disconnect', disconnectHandler);
        }
        if (errorHandler) {
            socket.off('error', errorHandler);
        }

        // Leave all rooms
        socket.leaveAll();

        // Disconnect the socket if still connected
        if (socket.connected) {
            socket.disconnect(true);
        }

        // Remove from connections map
        this.connections.delete(idPlayer);
        log.info(`Cleaned up connection for player ${idPlayer}`);

        // Clean up ack pool
        this.ackPool.delete(idPlayer);
    }

    // Clean up all connections (for server shutdown)
    cleanupAll() {
        log.info('Cleaning up all socket connections...');

        // Create a copy of the keys to avoid modification during iteration
        const idPlayers = Array.from(this.connections.keys());

        for (const idPlayer of idPlayers) {
            this.cleanupConnection(idPlayer);
        }

        // Clear the cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        log.info('All socket connections cleaned up');
    }

    emitTo(roomId, event, data) {
        this.getIo().to(roomId).emit(event, data);
    }

    broadcastTo(roomId, event, data) {
        this.getIo().broadcast().to(roomId).emit(event, data);
    }

    emitAckTo(roomId, event, data) {
        // Generate a unique ID for this event if not provided
        const eventId = data?.eventId || `${event}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Add the event to the ack pool for each player in the room
        this.getIo().in(roomId).fetchSockets().then(sockets => {
            sockets.forEach(socket => {
                const playerData = Array.from(this.connections.values())
                    .find(conn => conn.socket.id === socket.id);

                if (playerData) {
                    const idPlayer = playerData.idPlayer;
                    this.addToAckPool(idPlayer, eventId, event, data);

                    // Emit with the eventId included
                    const eventData = { ...data, _ackId: eventId };

                    socket.emit(event, eventData, (ack) => {
                        if (ack && ack.status === 'ok') {
                            log.info(`Ack received from socket ${socket.id} for event ${eventId}`);
                            this.removeFromAckPool(idPlayer, eventId);
                        } else {
                            log.error(`Ack failed from socket ${socket.id} for event ${eventId}`);
                        }
                    });
                }
            });
        });
    }

    // Getter for io instance (replaces previous io() function)
    getIo() {
        if (!this.ioInstance) {
            log.error('Socket.IO not initialized');
            throw new Error('Socket.IO not initialized');
        }
        return this.ioInstance;
    }

    /**
     * Add an event to the acknowledgment pool
     * @param {string} idPlayer - Player ID
     * @param {string} eventId - Unique event ID
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    addToAckPool(idPlayer, eventId, event, data) {
        if (!this.ackPool.has(idPlayer)) {
            this.ackPool.set(idPlayer, new Map());
        }

        const playerAcks = this.ackPool.get(idPlayer);
        playerAcks.set(eventId, {
            event,
            data,
            timestamp: Date.now()
        });

        log.debug(`Added event ${eventId} to ack pool for player ${idPlayer}`);
    }

    /**
     * Remove an event from the acknowledgment pool
     * @param {string} idPlayer - Player ID
     * @param {string} eventId - Event ID to remove
     * @returns {boolean} - True if event was found and removed
     */
    removeFromAckPool(idPlayer, eventId) {
        if (!this.ackPool.has(idPlayer)) return false;

        const playerAcks = this.ackPool.get(idPlayer);
        const wasRemoved = playerAcks.delete(eventId);

        if (wasRemoved) {
            log.debug(`Removed event ${eventId} from ack pool for player ${idPlayer}`);

            // Clean up empty player maps
            if (playerAcks.size === 0) {
                this.ackPool.delete(idPlayer);
            }
        }

        return wasRemoved;
    }

    /**
     * Get all unacknowledged events for a player
     * @param {string} idPlayer - Player ID
     * @returns {Array} - Array of unacknowledged events
     */
    getUnacknowledgedEvents(idPlayer) {
        if (!this.ackPool.has(idPlayer)) return [];
        return Array.from(this.ackPool.get(idPlayer).values());
    }

    /**
     * Clean up old unacknowledged events
     */
    cleanupOldAcks() {
        const now = Date.now();
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

        for (const [idPlayer, playerAcks] of this.ackPool.entries()) {
            for (const [eventId, eventData] of playerAcks.entries()) {
                if (now - eventData.timestamp > MAX_AGE) {
                    log.info(`Removing old unacknowledged event ${eventId} for player ${idPlayer}`);
                    playerAcks.delete(eventId);
                }
            }

            // Clean up empty player maps
            if (playerAcks.size === 0) {
                this.ackPool.delete(idPlayer);
            }
        }
    }

    setupAckHandler() {
        this.getIo().on('connection', (socket) => {
            socket.on('acknowledge', (data, callback) => {
                const { eventId } = data;
                const playerData = Array.from(this.connections.values())
                    .find(conn => conn.socket.id === socket.id);

                if (playerData && eventId) {
                    const wasRemoved = this.removeFromAckPool(playerData.idPlayer, eventId);
                    if (wasRemoved) {
                        log.info(`Received explicit ack for event ${eventId} from player ${playerData.idPlayer}`);
                        callback({ status: 'ok' });
                    } else {
                        log.warn(`Received ack for unknown event ${eventId} from player ${playerData.idPlayer}`);
                        callback({ status: 'error', message: 'Event not found' });
                    }
                } else {
                    callback({ status: 'error', message: 'Invalid ack data' });
                }
            });
        });
    }
}

// Create a singleton instance
export default SocketManager.getInstance();
