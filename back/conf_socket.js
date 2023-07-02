import {Server} from 'socket.io';

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
        socket.emit('connected', {message: 'Hello client! '+idPlayer});

        // Handle socket events
        socket.on('disconnect', () => {
            console.log('A user disconnected');
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
