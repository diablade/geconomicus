import express from 'express';
import env from './../config/env.js';
import morgan from 'morgan';
import cors from 'cors';
import socket from '../config/socket.js';
import http from 'http';
import log from '../config/log.js';

// IMPORT ROUTES
import bankRoutes from "./bank/bank.routes.js";
import gameRoutes from './game/game.routes.js';
import playerRoutes from './player/player.routes.js';
import eventRoutes from './event/event.routes.js';
import surveyRoutes from './survey/survey.routes.js';

import * as db from "../config/database.js";
// import {connect} from "../config/database2.js";

if (env.environment !== "test") {
    db.connect();
    // connect();
}

const app = express();
// Enable trust proxy for correct client IP detection
app.set('trust proxy', true);
// CORS POLICY
app.use(cors())

// USE MIDDLEWARE

// // Middleware to block bots
// app.use((req, res, next) => {
// 	// Regex to match bot user-agents
// 	const botPattern = /bot|crawler|spider|crawling/i;
// 	if (botPattern.test(req.headers['user-agent'])) {
// 		// End the connection without responding
// 		req.destroy();
// 		return;
// 	}
// 	next();
// });
const botPattern = /bot|crawler|spider|crawling/i;
const acceptedPathToBeLogged = /^\/(bank|game|player|status)(\/|$)/;
// Middleware to block bots
app.use((req, res, next) => {
    if (botPattern.test(req.headers['user-agent'])) {
        // Respond with 403 Forbidden for bots
        return res.status(403).json({message: 'Forbidden'});
    }
    next();
});

// Ensure all requests and responses use UTF-8 encoding
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.headers['accept-charset'] = 'utf-8';
    next();
});

app.use(express.json());
app.use(express.urlencoded({extended: true}));
// Morgan logger setup: Log only defined routes
app.use(morgan(":remote-addr | :remote-user | [:date[clf]] | :method | \":url\" | :status | res-size: :res[content-length] | :response-time ms", {
    skip: (req, res) => {
        return !acceptedPathToBeLogged.test(req.originalUrl);
    }
}));

// MAIN ROUTES middleware
app.use('/bank', bankRoutes);
app.use('/game', gameRoutes);
app.use('/player', playerRoutes);
app.use('/survey', surveyRoutes);
app.use('/event', eventRoutes);

//api health routes
app.get('/status', (req, res) => {
    return res.status(200).json({
        status:  'running',
        version: env.version
    })
});
//api memory routes
app.get('/debug/memory', (req, res) => {
    const used = process.memoryUsage();
    return res.status(200).json({
        status:      'running',
        version:     env.version,
        memoryUsage: {
            rss:       `${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`,
            heapTotal: `${Math.round(used.heapTotal / 1024 / 1024 * 100) / 100} MB`,
            heapUsed:  `${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`,
            external:  `${Math.round(used.external / 1024 / 1024 * 100) / 100} MB`
        }
    })
});

// Catch-all for non-matching routes (404 handler)
app.use((req, res, next) => {
    return res.status(404).json({"not": "Found"});
});

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

// handle errors
app.use((err, req, res) => {
    log.error(err);

    // Set error response
    return res.status(err.status || 500).json({
        message: err.message || err || "Something looks wrong :(",
    });
});
if (env.environment !== "test") {
    const server = http.createServer(app);
    // Timeout settings
    server.keepAliveTimeout = 70000;     // 70 secondes
    server.headersTimeout = 75000;       // Doit être > keepAliveTimeout

    let io = socket.initIo(server);
    // Verify initialization
    if (!io) {
        log.error('Socket.IO failed to initialize');
    }

    server.listen(env.port, '0.0.0.0', () => console.log(
        "\n" + "   ____                                      _                \n" + "  / ___| ___  ___ ___  _ __   ___  _ __ ___ (_) ___ _   _ ___ \n"
        + " | |  _ / _ \\/ __/ _ \\| '_ \\ / _ \\| '_ ` _ \\| |/ __| | | / __|\n" + " | |_| |  __/ (_| (_) | | | | (_) | | | | | | | (__| |_| \\__ \\\n"
        + "  \\____|\\___|\\___\\___/|_| |_|\\___/|_| |_| |_|_|\\___|\\__,_|___/\n" + "                                                              \n"
        + env.version + '                    made with <3 by Markovic Nicolas Copyright ©\n' + '   server is started and ready'));
    try {
        socket.getIo(); // This should not throw an error if initialized correctly
        log.info('Socket.IO successfully initialized');
    }
    catch (error) {
        log.error('Socket.IO initialization failed:', error);
    }
}
export default app;
