import express from 'express';
import env from '#config/env';
import morgan from 'morgan';
import cors from 'cors';
import log from '#config/log';

// IMPORT ROUTES
import legacyGameRoutes from './legacy/game/game.routes.js';
import legacyBankRoutes from './legacy/bank/bank.routes.js';
import legacyPlayerRoutes from './legacy/player/player.routes.js';
import sessionRoutes from './session/session.routes.js';
import eventRoutes from './event/event.routes.js';
import surveyRoutes from './survey/survey.routes.js';
import gameStateRoutes from './gameState/game.state.routes.js';
import bankStateRoutes from "./gameState/bank/bank.routes.js";
import avatarRoutes from './session/avatar/avatar.routes.js';
import rulesRoutes from './session/rules/rules.routes.js';

const app = express();
// Enable trust proxy for correct client IP detection
app.set('trust proxy', true);
// CORS POLICY
// app.use(cors())
app.use(cors({
    origin:      [
        'http://localhost:4200', 'https://geconomicus.fr'
    ],
    credentials: false
}));

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
//legacy routes for old version of the app
app.use('/bank', legacyBankRoutes);
app.use('/game', legacyGameRoutes);
app.use('/player', legacyPlayerRoutes);
//new app routes
app.use('/session', sessionRoutes);
app.use('/rules', rulesRoutes);
app.use('/survey', surveyRoutes);
app.use('/event', eventRoutes);
app.use('/avatar', avatarRoutes);
app.use('/gameState', gameStateRoutes);
app.use('/bankState', bankStateRoutes);

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

// handle errors
app.use((err, req, res) => {
    log.error(err);

    // Set error response
    return res.status(err.status || 500).json({
        message: err.message || err || "Something looks wrong :(",
    });
});

export default app;
