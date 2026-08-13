import { Server } from 'socket.io';
import { IO, ROOMS, ASSIST_MODE, KICK_REASON } from '@geco/shared';
import PlayersStateConnectionManager from '../src/gameState/managers/PlayersStateConnectionManager.js';
import log from '#config/log';

// Constants
const CLEANUP_INTERVAL = 300000; // 5 minutes
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECTION_DELAY = 5000; // 5 seconds timeout for reconnection
const PING_INTERVAL = 3000; // Send a ping every 3 seconds
const PING_TIMEOUT = 6000; // Wait 6 seconds before considering connection closed
const ACK_TIMEOUT = 6000; // 6 seconds timeout for acknowledgements

export class SocketManager {
	static #instance = null;

	constructor() {
		if (SocketManager.#instance) {
			log.error('[socket] Use SocketManager.getInstance() to get the singleton instance.');
			throw new Error('Use SocketManager.getInstance() to get the singleton instance.');
		}
		this.ioInstance = null;
		// socketId -> { socket, lastActive, publicChannel, privateChannel, ... }. Keyed by socket
		// and not by channel because master cockpits and assist sessions legitimately share a
		// private channel — keying by channel dropped the incumbent out of reach of every cleanup.
		this.connections = new Map();
		// privateChannel -> Set<socketId>, the sockets currently registered on that channel
		this.channelSockets = new Map();
		// Acknowledgment pool: privateChannel -> Map(eventId -> { event, data, timestamp })
		this.ackPool = new Map();
		// init connection store
		PlayersStateConnectionManager.getInstance();

		// Setup cleanup interval for stale connections
		this.cleanupInterval = setInterval(() => {
			const now = Date.now();
			for (const [socketId, data] of this.connections.entries()) {
				const { lastActive } = data;

				if (now - lastActive > 3600000) {
					// 1 hour
					log.info(`[socket] Cleaning up stale socket ${socketId} (${data.privateChannel})`);
					this.cleanupConnection(socketId);
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
		log.info('[socket] IO initialization...');
		this.ioInstance = new Server(server, {
			cors: {
				origin: '*',
				credentials: false,
				methods: ['GET', 'POST'],
			},
			pingInterval: PING_INTERVAL,
			pingTimeout: PING_TIMEOUT,
			connectionStateRecovery: {
				maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
				skipMiddlewares: true,
			},
			maxHttpBufferSize: 1e8, // 100MB max buffer size
			allowEIO3: true, // For older clients
			ackTimeout: ACK_TIMEOUT,
			logFailure: true, // Log failed emissions
			transports: ['websocket'], // 🚫 no fallback polling => missing packets
			allowUpgrades: true,
			perMessageDeflate: {
				threshold: 1024, // Only compress messages larger than 1KB
			},
		});

		// Enable debugging in development
		if (process.env.NODE_ENV === 'development') {
			this.ioInstance.engine.on('connection_error', (err) => {
				log.error('[socket] connection error: ', err);
			});
		}

		this.setupConnectionHandlers();
		return this.ioInstance;
	}

	setupConnectionHandlers() {
		this.ioInstance.on('connection', (socket) => {
			const { publicChannel, privateChannel, assist, assistTarget } = socket.handshake.query;

			if (!this.validateConnection(publicChannel, privateChannel)) {
				socket.disconnect();
				return;
			}

			this.handleNewConnection(socket, publicChannel, privateChannel, assist, assistTarget);
		});
	}

	validateConnection(publicChannel, privateChannel) {
		if (!publicChannel || !privateChannel) {
			log.error('[socket] Error: publicChannel or privateChannel is missing in the query parameters.');
			return false;
		}
		return true;
	}

	/** Every live connection registered on a private channel, oldest first. */
	_connectionsOf(privateChannel) {
		const socketIds = this.channelSockets.get(privateChannel);
		if (!socketIds) return [];
		return Array.from(socketIds, (id) => this.connections.get(id)).filter(Boolean);
	}

	/**
	 * The connection that owns a Seat: the newest non-assist one, falling back to the newest
	 * of any kind. Assist sessions overlay a Seat, they never become its owner.
	 */
	_incumbentOf(privateChannel) {
		const connections = this._connectionsOf(privateChannel);
		return connections.filter((c) => !c.isAssist).pop() ?? connections.pop() ?? null;
	}

	/** Index a connection under both its socket id and its private channel. */
	_register(connectionData) {
		const { socket, privateChannel } = connectionData;
		this.connections.set(socket.id, connectionData);
		if (!this.channelSockets.has(privateChannel)) {
			this.channelSockets.set(privateChannel, new Set());
		}
		this.channelSockets.get(privateChannel).add(socket.id);
	}

	handleNewConnection(socket, publicChannel, privateChannel, assistMode = null, assistTarget = null) {
		const isAssist = !!assistMode;
		socket.data = socket.data || {};
		socket.data.isAssist = isAssist;
		log.info(
			`[socket] New connection - Public: ${publicChannel}, Private: ${privateChannel}, Socket: ${socket.id}` +
				(isAssist ? ` [assist:${assistMode} → ${assistTarget}]` : '')
		);

		// Store connection data with timestamp and reconnect attempts
		const connectionData = {
			socket,
			lastActive: Date.now(),
			publicChannel,
			privateChannel,
			disconnectHandler: null,
			errorHandler: null,
			isAssist,
			assistMode: assistMode || null,
			assistTarget: assistTarget || null,
		};

		// Handle previous connection if exists.
		// Assist sessions use a unique identity (they never collide), and master
		// cockpits are allowed to co-exist — in both cases we do NOT displace the
		// incumbent. See docs/adr/0010-animator-assist-sessions.md
		const previousConnection = this._incumbentOf(privateChannel);
		const isMaster = typeof privateChannel === 'string' && privateChannel.endsWith(':master');
		if (previousConnection && previousConnection.socket.connected) {
			if (isAssist || isMaster) {
				log.info(
					`[socket] Co-existing connection for ${privateChannel} (assist=${isAssist}, master=${isMaster})`
				);
			} else {
				// Standard single-session replacement
				try {
					log.info(`[socket] Replacing previous socket for player ${privateChannel}`);
					previousConnection.socket.emit('kicked', {
						reason: KICK_REASON.ANOTHER_CONNECTION,
						timestamp: Date.now(),
						privateChannel: previousConnection.privateChannel,
						publicChannel: previousConnection.publicChannel,
					});
				} catch (e) {
					log.warn(`[socket] Failed to notify kicked socket for player ${privateChannel}: ${e}`);
				}

				this.cleanupConnection(previousConnection.socket.id);
			}
		}

		const socketId = socket.id;
		connectionData.disconnectHandler = (reason) => this.handleDisconnect(socketId, reason);
		connectionData.errorHandler = (error) => this.handleError(socketId, error);

		this._register(connectionData);
		log.info(`[socket] Stored connection for ${privateChannel} -> socket ${socket.id}`);
		// Join rooms
		socket.join(publicChannel);
		socket.join(privateChannel);

		// Assist session: act on the device currently holding the target Seat.
		if (isAssist && assistTarget) {
			this._signalIncumbent(assistMode, assistTarget);
		}

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
				reconnectionDelay: RECONNECTION_DELAY,
			},
		});

		socket.on('disconnecting', (reason) => {
			// Emit player disconnected event to master board if this is a gameState room
			for (let room of socket.rooms) {
				if (room.includes(':')) {
					// Extract playerIdx from privateChannel format: gs:gameStateId:avatarIdx:playerStateIdx
					const [roomType, gameStateId, avatarIdx, playerStateIdx] = room.split(':');
					if (
						roomType === 'gs' &&
						avatarIdx !== 'master' &&
						avatarIdx !== 'table' &&
						avatarIdx !== 'results'
					) {
						const playerIdx = parseInt(playerStateIdx);
						if (playerIdx >= 0 && !socket.data?.isAssist) {
							this.emitDisconnecting(gameStateId, avatarIdx, playerIdx);
						}
					}
				}
			}
		});
		socket.on('disconnect', connectionData.disconnectHandler);
		socket.on('error', connectionData.errorHandler);
		socket.onAny(() => {
			// Track last activity on any socket event
			const connData = this.connections.get(socketId);
			if (connData) {
				connData.lastActive = Date.now();
			}
		});
		socket.on(IO.SHORT_CODE.EMIT, (data) => {
			log.info(`[socket] broadcasting to game state room: ${data.gameStateId} the code:${data.code} ...`);
			const gameStateRoom = ROOMS.gameState(data.gameStateId);
			this.emitTo(gameStateRoom, IO.SHORT_CODE.BROADCAST, data);
		});
		socket.on(IO.SHORT_CODE.CONFIRMED, (data) => {
			log.info(
				`[socket] ShortCodeConfirmed: ${data.code} for game state ${data.gameStateId} by seller ${data.sellerIdx}`
			);
			// send to buyer
			const buyerRoom = ROOMS.playerState(data.gameStateId, data.buyerIdx);
			log.info(`[socket] broadcasting confirmation to buyer's room: ${buyerRoom} for code: ${data.code}`);
			this.emitTo(buyerRoom, IO.SHORT_CODE.CONFIRMED, data);
		});
		socket.on('join', (room) => {
			log.info(`[socket] Socket ${socket.id} joining room: ${room}`);
			socket.join(room);
			// Emit player connected event to master board if this is a gameState room
			if (room && room.includes(':')) {
				// Extract from privateChannel format: gs:gameStateId:avatarIdx:playerStateIdx
				const [roomType, gameStateId, avatarIdx, playerStateIdx] = room.split(':');
				if (
					roomType === 'gs' &&
					gameStateId &&
					avatarIdx !== 'master' &&
					avatarIdx !== 'table' &&
					avatarIdx !== 'results'
				) {
					const playerIdx = parseInt(playerStateIdx);
					// Assist sessions (animator's "play the user" tab) join the same
					// gameplay rooms but must NOT flip the player's online indicator —
					// they belong to the animator, not the player.
					if (playerIdx >= 0 && !socket.data?.isAssist) {
						const lastSeen = new Date();
						PlayersStateConnectionManager.markConnected(gameStateId, playerIdx, lastSeen);
						// Emit to master room
						const masterRoom = ROOMS.gameStateMaster(gameStateId);
						this.emitTo(masterRoom, IO.PLAYER.CONNECTED, { idx: parseInt(playerStateIdx), lastSeen });
						log.info(
							`[socket] Player ${playerStateIdx} (avatar ${avatarIdx}) joined to gameState ${gameStateId}`
						);
					}
				} else if (avatarIdx === 'master') {
					const snapshot = PlayersStateConnectionManager.getPlayersConnectionStatus(gameStateId);
					socket.emit(IO.PLAYER.CONNECTIONS_SNAPSHOT, snapshot);
					log.info(
						`[socket] Sent connection snapshot to master for game ${gameStateId}: ${snapshot.length} players`
					);
				} else {
					log.info(
						`[socket] Room type: ${roomType}, gameStateId: ${gameStateId}, playerType: ${avatarIdx} joined`
					);
				}
			}
		});
		socket.on('leave', (room) => {
			log.info(`[socket] id: ${socket.id} leaving room: ${room}`);
			socket.leave(room);
			if (room.includes(':')) {
				// Extract playerIdx from privateChannel format: gs:gameStateId:avatarIdx:playerStateIdx
				const [roomType, gameStateId, avatarIdx, playerStateIdx] = room.split(':');
				if (roomType === 'gs' && avatarIdx !== 'master' && avatarIdx !== 'table' && avatarIdx !== 'results') {
					const playerIdx = parseInt(playerStateIdx);
					if (playerIdx >= 0 && !socket.data?.isAssist) {
						PlayersStateConnectionManager.markDisconnected(gameStateId, playerIdx);
						// Emit to master room
						const masterRoom = ROOMS.gameStateMaster(gameStateId);
						this.emitTo(masterRoom, IO.PLAYER.DISCONNECTED, { idx: playerIdx });
						log.info(
							`[socket] Player ${playerIdx} (avatar ${avatarIdx}) disconnected from gameState ${gameStateId}`
						);
					}
				}
			}
		});
		// Player reclaims their Seat from an animator take-over: drop every assist
		// session pointed at this Seat (a hard reclaim — see ADR-0010).
		socket.on(IO.PLAYER.RETAKE, (data) => {
			const { sessionId, avatarIdx } = data || {};
			if (!sessionId || avatarIdx === undefined || avatarIdx === null) return;
			const targetChannel = ROOMS.lobbyAvatar(sessionId, parseInt(avatarIdx));
			log.info(`[socket] Retake requested for ${targetChannel}; dropping assist sessions`);
			for (const [id, conn] of Array.from(this.connections.entries())) {
				if (conn.isAssist && conn.assistTarget === targetChannel && conn.socket.connected) {
					try {
						conn.socket.emit('kicked', { reason: KICK_REASON.RETAKEN, timestamp: Date.now() });
					} catch (e) {
						log.warn(`[socket] retake kick failed for ${conn.privateChannel}: ${e}`);
					}
					this.cleanupConnection(id);
				}
			}
		});
		socket.on('connect_error', (err) => log.error(`[socket] Connection error: `, err));
		socket.on('connect_timeout', (data) => log.error(`[socket] time out: `, data));
		socket.on('timeout', (err) => log.error(`[socket] io socket time out!: `, err));
		socket.on('reconnect_failed', (err) => log.error(`[socket] All reconnection attempts failed: `, err));
		socket.on('error', (err) => log.error(`[socket] error io socket: `, err));
		socket.on('acknowledge', (data, callback) => {
			const { eventId } = data;
			if (eventId) {
				const wasRemoved = this.removeFromAckPool(privateChannel, eventId);
				if (wasRemoved) {
					log.info(`[socket] Received explicit ack for event ${eventId} from player ${privateChannel}`);
					callback({ status: 'ok' });
				} else {
					log.warn(`[socket] Received ack for unknown event ${eventId} from player ${privateChannel}`);
					callback({ status: 'error', message: 'Event not found' });
				}
			} else {
				callback({ status: 'error', message: 'Invalid ack data' });
			}
		});

		// Check for unacknowledged events
		const unacknowledged = this.getUnacknowledgedEvents(privateChannel);
		if (unacknowledged.length > 0) {
			log.info(
				`[socket] Player ${privateChannel} reconnected with ${unacknowledged.length} unacknowledged events`
			);

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

	// Act on the device currently holding a Seat when an animator opens an
	// assist session onto it. Coexist = do nothing (both act); Take-over =
	// overlay the incumbent (it stays connected); Kick = hard-disconnect it.
	_signalIncumbent(mode, targetChannel) {
		const incumbent = this._incumbentOf(targetChannel);
		if (!incumbent || !incumbent.socket.connected) return;

		if (mode === ASSIST_MODE.KICK) {
			try {
				incumbent.socket.emit('kicked', {
					reason: KICK_REASON.KICKED_BY_ANIMATOR,
					timestamp: Date.now(),
				});
			} catch (e) {
				log.warn(`[socket] Failed to notify kicked incumbent ${targetChannel}: ${e}`);
			}
			this.cleanupConnection(incumbent.socket.id);
			log.info(`[socket] Assist KICK displaced incumbent ${targetChannel}`);
		} else if (mode === ASSIST_MODE.TAKEOVER) {
			incumbent.socket.emit(IO.PLAYER.TAKEN_OVER, { timestamp: Date.now() });
			log.info(`[socket] Assist TAKE-OVER overlaid incumbent ${targetChannel}`);
		}
		// ASSIST_MODE.COEXIST: leave the incumbent untouched
	}

	// Handle disconnection
	handleDisconnect(socketId, reason) {
		const connection = this.connections.get(socketId);
		if (!connection) {
			return;
		}

		const { publicChannel, privateChannel } = connection;

		log.info(
			`[socket] game ${publicChannel},Player ${privateChannel} disconnected. Reason: ${reason}`
		);

		this.cleanupConnection(socketId);
	}

	// Handle socket errors
	handleError(socketId, error) {
		const connection = this.connections.get(socketId);
		log.error(`[socket] Socket error for player ${connection?.privateChannel ?? socketId}:`, error);
		if (connection) {
			connection.lastActive = Date.now();
		}
	}

	// Clean up connection resources
	cleanupConnection(socketId) {
		const connection = this.connections.get(socketId);
		if (!connection) {
			return;
		}

		const { socket, disconnectHandler, errorHandler, privateChannel } = connection;

		// Remove event listeners
		if (disconnectHandler) {
			socket.off('disconnect', disconnectHandler);
		}
		if (errorHandler) {
			socket.off('error', errorHandler);
		}

		// Disconnect the socket if still connected
		if (socket.connected) {
			socket.disconnect(true);
		}

		this.connections.delete(socketId);
		log.info(`[socket] Cleaned up connection ${socketId} for player ${privateChannel}`);

		// The ack pool is per channel: only drop it once the channel has no socket left,
		// so one of two co-existing cockpits leaving does not wipe the other's pending events.
		const socketIds = this.channelSockets.get(privateChannel);
		if (socketIds) {
			socketIds.delete(socketId);
			if (socketIds.size === 0) {
				this.channelSockets.delete(privateChannel);
				this.ackPool.delete(privateChannel);
			}
		}
	}

	// Clean up all connections (for server shutdown)
	cleanupAll() {
		log.info('[socket] Cleaning up all socket connections...');

		// Create a copy of the keys to avoid modification during iteration
		const socketIds = Array.from(this.connections.keys());

		PlayersStateConnectionManager.cleanupAll();
		for (const socketId of socketIds) {
			this.cleanupConnection(socketId);
		}
		this.channelSockets.clear();

		// Clear the cleanup interval
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}

		log.info('[socket] All socket connections cleaned up');
	}

	emitDisconnecting(gameStateId, avatarIdx, playerIdx) {
		PlayersStateConnectionManager.markDisconnected(gameStateId, playerIdx);
		// Emit to master room
		const masterRoom = ROOMS.gameStateMaster(gameStateId);
		this.emitTo(masterRoom, IO.PLAYER.DISCONNECTED, {
			idx: playerIdx,
		});
		log.info(`[socket] Player ${playerIdx} (avatar ${avatarIdx}) disconnected from gameState ${gameStateId}`);
	}

	emitTo(roomId, event, data) {
		if (!this.ioInstance) return;
		this.getIo().to(roomId).emit(event, data);
	}

	broadcastTo(roomId, event, data) {
		if (!this.ioInstance) return;
		this.getIo().broadcast().to(roomId).emit(event, data);
	}

	async emitAckTo(roomId, event, data) {
		log.debug(`[socket] emitAckTo called - room: ${roomId}, event: ${event}`);
		if (!this.ioInstance) return;

		const eventId = data?.eventId || `${event}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		let sockets;
		try {
			sockets = await this.getIo().in(roomId).fetchSockets();
			log.debug(`[socket] emitAckTo - sockets found: ${sockets.length} in room ${roomId}`);
		} catch (err) {
			log.error(`[socket] fetchSockets failed for room ${roomId}:`, err);
			return;
		}

		if (!sockets.length) {
			log.warn(`[socket] emitAckTo: no sockets found in room ${roomId} for event ${event}`);
			return;
		}

		for (const socket of sockets) {
			const playerData = this.connections.get(socket.id);
			const privateChannel = playerData?.privateChannel;

			if (!playerData) {
				const knownIds = Array.from(this.connections.keys());
				log.warn(
					`[socket] emitAckTo: socket ${socket.id} in room ${roomId} not in connections map. ` +
					`Known socket IDs: [${knownIds.join(', ')}]. Emitting without ack tracking.`
				);
				// Still deliver the event — skip ack tracking only
				socket.emit(event, { ...data, _ackId: eventId });
				continue;
			}

			this.addToAckPool(privateChannel, eventId, event, data);

			// A RemoteSocket carries no ack timeout of its own — without .timeout() the
			// underlying broadcast operator calls back immediately with a timeout error
			// and drops the client's real answer, so the pool entry would never clear.
			socket.timeout(ACK_TIMEOUT).emit(event, { ...data, _ackId: eventId }, (err, ack) => {
				if (err) {
					log.error(`[socket] Ack timeout from ${socket.id} for event ${eventId}: ${err.message}`);
					return;
				}
				if (ack?.status === 'ok') {
					log.debug(`[socket] Ack ok from ${socket.id} for event ${eventId}`);
					this.removeFromAckPool(privateChannel, eventId);
				} else {
					log.error(`[socket] Ack failed from ${socket.id} for event ${eventId}`, ack);
				}
			});
		}
	}

	// Getter for io instance (replaces previous io() function)
	getIo() {
		if (!this.ioInstance) {
			log.error('[socket] Socket.IO not initialized');
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
			timestamp: Date.now(),
		});

		log.debug(`[socket] Added event ${eventId} to ack pool for player ${privateChannel}`);
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
			log.debug(`[socket] Removed event ${eventId} from ack pool for player ${privateChannel}`);

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
					log.info(`[socket] Removing old unacknowledged event ${eventId} for player ${privateChannel}`);
					playerAcks.delete(eventId);
				}
			}

			// Clean up empty player maps
			if (playerAcks.size === 0) {
				this.ackPool.delete(privateChannel);
			}
		}
	}

}

// Create a singleton instance
export default SocketManager.getInstance();
