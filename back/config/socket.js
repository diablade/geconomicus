import {Server} from 'socket.io';
import * as C from "../../config/constantes.js";

let ioInstance; // Variable to store the Socket.IO instance

function initIo(server) {
	ioInstance = new Server(server, {
		cors: {
			origin: "*",
			credentials: false
		},
		pingInterval: 20000,  // Server-side ping interval
		pingTimeout: 5000,    // Server-side ping timeout
	});
	// Handle Socket.IO events
	ioInstance.on('connection', (socket) => {
		const {idPlayer, idGame} = socket.handshake.query;
		// Assuming you have a unique identifier for each user
		if (!idPlayer || !idGame) {
			console.error('idPlayer or idGame is missing in the query parameters.');
			socket.disconnect();
			return;
		}
		console.log('A player connected : ', idPlayer, ' on game :', idGame);
		socket.join(idGame);
		socket.join(idPlayer);

		// Example: Emit a custom event to the client
		socket.emit('connected', {message: 'Hello client! ' + idPlayer});

		// Handle socket events
		socket.on('disconnect', () => {
			console.log('A user disconnected');
		});
		// Listen for ping
		socket.on('ping_geco', () => {
			socket.emit('pong_geco');
		});

		socket.on(C.SHORT_CODE_EMIT, (data) => {
			console.log('ShortCodeEmitted', data.code);
			// Broadcast to all other clients except the sender
			socket.broadcast.to(idGame).emit(C.SHORT_CODE_EMIT, data);
		});
		socket.on(C.SHORT_CODE_CONFIRMED, (data) => {
			console.log('ShortCodeConfirmed');
			io().to(data.idBuyer).emit(C.SHORT_CODE_CONFIRMED, data);
		});

	});
	// Additional Socket.IO configuration and event handling can be added here
	return ioInstance;
}

// Export the io instance for usage in other modules
export function io() {
	return ioInstance;
}

export default {
	initIo,
};
