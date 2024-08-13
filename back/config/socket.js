import {Server} from 'socket.io';
import * as C from "../../config/constantes.js";

let ioInstance; // Variable to store the Socket.IO instance

function initIo(server) {
	ioInstance = new Server(server, {
		cors: {
			origin: "*",
			credentials: false
		}
	});
	// Handle Socket.IO events
	ioInstance.on('connection', (socket) => {
		const {idPlayer, idGame} = socket.handshake.query; // Assuming you have a unique identifier for each user
		console.log('A player connected : ', idPlayer, ' on game :', idGame);
		socket.join(idGame);
		socket.join(idPlayer);

		// Example: Emit a custom event to the client
		socket.emit('connected', {message: 'Hello client! ' + idPlayer});

		// Handle socket events
		socket.on('disconnect', () => {
			console.log('A user disconnected');
		});

		socket.on(C.SHORT_CODE_EMIT, (data) => {
			console.log('ShortCodeEmitted', data.code);
			// Broadcast to all other clients except the sender
			socket.broadcast.emit(C.SHORT_CODE_EMIT, data);
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
