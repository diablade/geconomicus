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
        // Get all sockets in the room
        this.getIo().in(roomId).fetchSockets().then(sockets => {
            // Emit to each socket individually
            sockets.forEach(socket => {
                socket.emit(event, data, (ack) => {
                    if (ack && ack.status === 'ok') {
                        log.info('io ack received from socket:' + socket.id + ' ' , ack);
                    }
                    else {
                        log.error('io ack failed from socket:' + socket.id);
                    }
                });
            });
        }).catch(err => {
            log.error('Error fetching sockets:', err);
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
}

// Create a singleton instance
export default SocketManager.getInstance();
