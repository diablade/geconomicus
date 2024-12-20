import {Server} from 'socket.io';
import * as C from "../../config/constantes.js";
import log from "./log.js";

class SocketManager {
	static #instance = null;

	constructor() {
		if (SocketManager.#instance) {
			log.error("Use SocketManager.getInstance() to get the singleton instance.");
			throw new Error("Use SocketManager.getInstance() to get the singleton instance.");
		}
		this.ioInstance = null;
		this.connections = new Map(); // Optional: track active connections
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
			cors: {
				origin: "*",
				credentials: false
			},
			pingInterval: 10000,
			pingTimeout: 5000,
			allowEIO3: true, // if older clients need support
			ackTimeout: 10000,
			logFailure: true,      // Log failed emissions
		});

		this.setupConnectionHandlers();
		log.info("Socket.IO initialized.");
		return this.ioInstance;
	}

	setupConnectionHandlers() {
		this.ioInstance.on('connection', (socket) => {
			const {idPlayer, idGame} = socket.handshake.query;
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
		log.info('conn p:' + idPlayer + ' on g:' + idGame);

		// Join rooms
		socket.join(idGame);
		socket.join(idPlayer);

		// Track connection (optional)
		this.connections.set(idPlayer, socket);

		// Initial connection event
		socket.emit('connected', {message: 'Hello client! ' + idPlayer});

		// Short code emit handler
		socket.on(C.SHORT_CODE_EMIT, (data) => {
			log.info('ShortCodeEmitted:' + data.code);
			this.emitTo(idGame, C.SHORT_CODE_BROADCAST, data);
		});

		// Short code confirmation handler
		socket.on(C.SHORT_CODE_CONFIRMED, (data) => {
			log.info('ShortCodeConfirmed');
			this.emitTo(data.idBuyer, C.SHORT_CODE_CONFIRMED, data);
		});

		// Disconnect handler
		socket.on('disconnect', () => {
			log.info('Player disconnected:', idPlayer);
			this.connections.delete(idPlayer);
		});
		socket.on('connect_error', (err) => {
			log.error('Connection error:' + err.message);
		});
		socket.on("connect_timeout", (data) => {
			log.error('time out' + data);
		});
		socket.on("timeout", (err) => {
			log.error('io socket time out!:' + err);
		});
		socket.on('reconnect_failed', (err) => {
			log.error('All reconnection attempts failed:' + err);
		});
		socket.on('reconnect_attempt', (attempt) => {
			log.error('Reconnection attempt:' + attempt);
		});
		socket.on("reconnecting", (err) => {
			log.error('reconnecting...' + err);
		});
		socket.on('reconnect', (attemptNumber) => {
			log.info('Reconnected after ' + attemptNumber + 'attempts');
		});
		socket.on('reconnect_error', () => {
			log.error('Reconnection error');
		});
		socket.on('error', (err) => {
			log.error('error io soket' + err);
		});
		// Ping handler
		socket.on('ping_geco', () => {
			socket.emit('pong_geco');
		});
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
						log.info('io ack received from socket:'+ socket.id+' '+ ack);
					} else {
						log.error('io ack failed from socket:'+ socket.id);
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
