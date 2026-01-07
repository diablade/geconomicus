// server.js
import http from 'http';
import app from './app.js';
import env from '#config/env';
import socket from '#config/socket';
import log from '#config/log';

import * as db from '#config/database';

if (env.environment !== "test") {
    db.connect();
}

const server = http.createServer(app);

server.keepAliveTimeout = 70_000;
server.headersTimeout = 75_000;

if (env.environment !== "test") {
    // Timeout settings
    server.keepAliveTimeout = 70000;     // 70 secondes
    server.headersTimeout = 75000;       // Doit être > keepAliveTimeout

    let io = socket.initIo(server);
    // Verify initialization
    if (!io) {
        log.error('Socket.IO failed to initialize');
    }

    // Add to your main app.js or server startup
    setInterval(() => {
        const used = process.memoryUsage();
        const memoryUsage = {
            rss:       `${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`,
            heapTotal: `${Math.round(used.heapTotal / 1024 / 1024 * 100) / 100} MB`,
            heapUsed:  `${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`,
            external:  `${Math.round(used.external / 1024 / 1024 * 100) / 100} MB`
        };
        log.info('Memory usage:', memoryUsage);
    }, 3600000); // Log every hours

}
server.listen(env.port, '0.0.0.0', () => {
    log.info("\n" + "   ____                                      _                \n" + "  / ___| ___  ___ ___  _ __   ___  _ __ ___ (_) ___ _   _ ___ \n"
        + " | |  _ / _ \\/ __/ _ \\| '_ \\ / _ \\| '_ ` _ \\| |/ __| | | / __|\n" + " | |_| |  __/ (_| (_) | | | | (_) | | | | | | | (__| |_| \\__ \\\n"
        + "  \\____|\\___|\\___\\___/|_| |_|\\___/|_| |_| |_|_|\\___|\\__,_|___/\n" + "                                                              \n"
        + env.version + '                    made with <3 by Markovic Nicolas Copyright ©\n' + '   server is started and ready')
});
if (env.environment !== 'test') {
    try {
        socket.getIo();
        log.info('Socket.IO successfully initialized');
    }
    catch (err) {
        log.error('Socket.IO not initialized', err);
    }
}

