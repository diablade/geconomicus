import { Server } from 'socket.io';
import { IO } from "@geco/shared";
import log from "#config/log";

// Constants
const CLEANUP_INTERVAL = 300000; // 30 minutes
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECTION_DELAY = 5000; // 5 seconds timeout for reconnection
const PING_INTERVAL = 3000; // Send a ping every 3 seconds
const PING_TIMEOUT = 6000; // Wait 6 seconds before considering the connection closed
const ACK_TIMEOUT = 6000; // 6 seconds timeout for acknowledgements

export class SocketManager {
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
                const {
                    socket,
                    lastActive,
                    reconnectAttempts
                } = data;

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
        log.info("Socket.IO initialization...");
        this.ioInstance = new Server(server, {
            cors: {
                origin: "*",
                credentials: false,
                methods: ["GET", "POST"]
            },
            pingInterval: PING_INTERVAL,
            pingTimeout: PING_TIMEOUT,
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
                skipMiddlewares: true
            },
            maxHttpBufferSize: 1e8,   // 100MB max buffer size
            allowEIO3: true,          // For older clients
            ackTimeout: ACK_TIMEOUT,
            logFailure: true,         // Log failed emissions
            transports: ["websocket"], // 🚫 no fallback polling => missing packets
            allowUpgrades: true,
            perMessageDeflate: {
                threshold: 1024, // Only compress messages larger than 1KB
            },
        });

        // Enable debugging in development
        if (process.env.NODE_ENV === 'development') {
            this.ioInstance.engine.on("connection_error", (err) => {
                log.error('Socket connection error: '+ err);
            });
        }

        this.setupConnectionHandlers();
        return this.ioInstance;
    }

    setupConnectionHandlers() {
        this.setupAckHandler();
        this.ioInstance.on('connection', (socket) => {
            const {
                publicChannel,
                privateChannel
            } = socket.handshake.query;

            if (!this.validateConnection(publicChannel, privateChannel)) {
                socket.disconnect();
                return;
            }

            this.handleNewConnection(socket, publicChannel, privateChannel);
        });
    }

    validateConnection(publicChannel, privateChannel) {
        if (!publicChannel || !privateChannel) {
            log.error('socket error, idPlayer or idGame is missing in the query parameters.');
            return false;
        }
        return true;
    }

    handleNewConnection(socket, publicChannel, privateChannel) {
        log.info(`New connection - Public: ${publicChannel}, Private: ${privateChannel}, Socket: ${socket.id}`);

        // Store connection data with timestamp and reconnect attempts
        const connectionData = {
            socket,
            lastActive: Date.now(),
            reconnectAttempts: 0,
            publicChannel,
            privateChannel,
            disconnectHandler: null,
            errorHandler: null,
        };

        // Handle previous connection if exists
        const previousConnection = this.connections.get(privateChannel);
        if (previousConnection && previousConnection.socket.connected && process.env.NODE_ENV === 'production') {
            // Clean up previous connection
            try {
                log.info(`Replacing previous socket for player ${privateChannel}`);
                previousConnection.socket.emit('kicked', {
                    reason: 'another_connection',
                    timestamp: Date.now(),
                    privateChannel: previousConnection.privateChannel,
                    publicChannel: previousConnection.publicChannel
                });
            }
            catch (e) {
                log.warn(`Failed to notify kicked socket for player ${privateChannel}: ${e}`);
            }

            this.cleanupConnection(privateChannel);
        }

        // Set up event handlers
        connectionData.disconnectHandler = (reason) => this.handleDisconnect(privateChannel, reason);
        connectionData.errorHandler = (error) => this.handleError(privateChannel, error);

        // Store the new connection
        this.connections.set(privateChannel, connectionData);
        // Join rooms
        socket.join(publicChannel);
        socket.join(privateChannel);

        // Send connection confirmation with server timestamp
        socket.emit('connected', {
            timestamp: Date.now(),
            sessionId: socket.id,
            privateChannel: privateChannel,
            publicChannel: publicChannel,
            serverTime: new Date().toISOString(),
            config: {
                // heartbeatInterval: HEARTBEAT_INTERVAL,
                maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
                reconnectionDelay: RECONNECTION_DELAY
            }
        });

        socket.on('disconnect', connectionData.disconnectHandler);
        socket.on('error', connectionData.errorHandler);
        socket.onAny(() => {
            // Track last activity on any socket event
            const connData = this.connections.get(privateChannel);
            if (connData) {
                connData.lastActive = Date.now();
            }
        });
        socket.on(IO.SHORT_CODE.EMIT, (data) => {
            log.info(`broadcasting to game state room: ${data.gameStateId} the code:${data.code} ...`);
            this.emitTo(data.gameStateId, IO.SHORT_CODE.BROADCAST, data);
        });
        socket.on(IO.SHORT_CODE.CONFIRMED, (data) => {
            log.info(`ShortCodeConfirmed: ${data.code} for game state ${data.gameStateId} by seller ${data.sellerIdx}`);
            // send to buyer
            const buyerRoom = `${data.gameStateId}:${data.buyerAvatarIdx}:${data.buyerIdx}`;
            log.info(`broadcasting confirmation to buyer's room: ${buyerRoom} for code: ${data.code}`);
            this.emitTo(buyerRoom, IO.SHORT_CODE.CONFIRMED, data);
        });
        socket.on('join', (room) => {
            log.info(`Socket ${socket.id} joining room: ${room}`);
            socket.join(room);
        });
        socket.on('leave', (room) => {
            log.info(`Socket ${socket.id} leaving room: ${room}`);
            socket.leave(room);
        });
        socket.on('connect_error', () => log.error(`Connection error: ${err.message}`));
        socket.on('connect_timeout', (data) => log.error(`time out: ${data}`));
        socket.on('timeout', (err) => log.error(`io socket time out!: ${err}`));
        socket.on('reconnect_failed', (err) => log.error(`All reconnection attempts failed: ${err}`));
        socket.on('reconnect_attempt', (attempt) => this.handleReconnect(privateChannel, attempt));
        socket.on('reconnecting', (err) => log.error(`reconnecting...: ${err}`));
        socket.on('reconnect', (attemptNumber) => log.info(`Reconnected after ${attemptNumber} attempts`));
        socket.on('reconnect_error', () => log.error('Reconnection error'));
        socket.on('error', (err) => log.error(`error io socket: ${err}`));

        // Check for unacknowledged events
        const unacknowledged = this.getUnacknowledgedEvents(privateChannel);
        if (unacknowledged.length > 0) {
            log.info(`Player ${privateChannel} reconnected with ${unacknowledged.length} unacknowledged events`);

            // Send resync signal
            socket.emit('resync', { needsResync: true });

            // Optionally, you can resend unacknowledged events here
            // unacknowledged.forEach(({ event, data, timestamp }) => {
            //     socket.emit(event, { ...data, _isResend: true });
            // });

            // Or just clear the ack pool for this player
            this.ackPool.delete(privateChannel);
        }
    }

    // Handle disconnection
    handleDisconnect(privateChannel, reason) {
        const connection = this.connections.get(privateChannel);
        if (!connection) {
            return;
        }

        const {
            socket,
            reconnectAttempts,
            publicChannel
        } = connection;

        log.info(`game ${publicChannel},Player ${privateChannel} disconnected. Reason: ${reason}. Reconnect attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}`);

        this.cleanupConnection(privateChannel);
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
        log.error(`Socket error for player ${idPlayer}: ${error}`);
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
        if (!this.ioInstance) return;
        this.getIo().to(roomId).emit(event, data);
    }

    broadcastTo(roomId, event, data) {
        if (!this.ioInstance) return;
        this.getIo().broadcast().to(roomId).emit(event, data);
    }

    emitAckTo(roomId, event, data) {
        if (!this.ioInstance) return;
        // Generate a unique ID for this event if not provided
        const eventId = data?.eventId || `${event}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Add the event to the ack pool for each player in the room
        this.getIo().in(roomId).fetchSockets().then(sockets => {
            sockets.forEach(socket => {
                const playerData = Array.from(this.connections.values())
                    .find(conn => conn.socket.id === socket.id);

                if (playerData) {
                    const privateChannel = playerData.privateChannel;
                    this.addToAckPool(privateChannel, eventId, event, data);

                    // Emit with the eventId included
                    const eventData = {
                        ...data,
                        _ackId: eventId
                    };

                    socket.emit(event, eventData, (ack) => {
                        if (ack && ack.status === 'ok') {
                            log.info(`Ack received from socket ${socket.id} for event ${ack._ackId}`);
                            this.removeFromAckPool(ack.idPlayer, ack._ackId);
                        }
                        else {
                            log.error(`Ack failed from socket ${socket.id} for event ${ack._ackId}`);
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
     * @param {string} privateChannel - Private channel ID
     * @param {string} eventId - Unique event ID
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    addToAckPool(privateChannel, eventId, event, data) {
        if (!this.ackPool.has(privateChannel)) {
            this.ackPool.set(privateChannel, new Map());
        }

        const playerAcks = this.ackPool.get(privateChannel);
        playerAcks.set(eventId, {
            event,
            data,
            timestamp: Date.now()
        });

        log.debug(`Added event ${eventId} to ack pool for player ${privateChannel}`);
    }

    /**
     * Remove an event from the acknowledgment pool
     * @param {string} privateChannel - Private channel ID
     * @param {string} eventId - Event ID to remove
     * @returns {boolean} - True if event was found and removed
     */
    removeFromAckPool(privateChannel, eventId) {
        if (!this.ackPool.has(privateChannel)) {
            return false;
        }

        const playerAcks = this.ackPool.get(privateChannel);
        const wasRemoved = playerAcks.delete(eventId);

        if (wasRemoved) {
            log.debug(`Removed event ${eventId} from ack pool for player ${privateChannel}`);

            // Clean up empty player maps
            if (playerAcks.size === 0) {
                this.ackPool.delete(privateChannel);
            }
        }

        return wasRemoved;
    }

    /**
     * Get all unacknowledged events for a player
     * @param {string} privateChannel - Private channel ID
     * @returns {Array} - Array of unacknowledged events
     */
    getUnacknowledgedEvents(privateChannel) {
        if (!this.ackPool.has(privateChannel)) {
            return [];
        }
        return Array.from(this.ackPool.get(privateChannel).values());
    }

    /**
     * Clean up old unacknowledged events
     */
    cleanupOldAcks() {
        const now = Date.now();
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

        for (const [privateChannel, playerAcks] of this.ackPool.entries()) {
            for (const [eventId, eventData] of playerAcks.entries()) {
                if (now - eventData.timestamp > MAX_AGE) {
                    log.info(`Removing old unacknowledged event ${eventId} for player ${privateChannel}`);
                    playerAcks.delete(eventId);
                }
            }

            // Clean up empty player maps
            if (playerAcks.size === 0) {
                this.ackPool.delete(privateChannel);
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
                    const wasRemoved = this.removeFromAckPool(playerData.privateChannel, eventId);
                    if (wasRemoved) {
                        log.info(`Received explicit ack for event ${eventId} from player ${playerData.privateChannel}`);
                        callback({ status: 'ok' });
                    }
                    else {
                        log.warn(`Received ack for unknown event ${eventId} from player ${playerData.privateChannel}`);
                        callback({
                            status: 'error',
                            message: 'Event not found'
                        });
                    }
                }
                else {
                    callback({
                        status: 'error',
                        message: 'Invalid ack data'
                    });
                }
            });
        });
    }
}

// Create a singleton instance
export default SocketManager.getInstance();
