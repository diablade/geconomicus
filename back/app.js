import express from 'express';
import dotenv from 'dotenv';
import mongoose from './conf_database.js';
import morgan from 'morgan';
import cors from 'cors';
import socket from './conf_socket.js';
import http from 'http';

// IMPORT ROUTES
import bankRoutes from "./src/bank/bank.routes.js";
import gameRoutes from './src/game/game.routes.js';
import playerRoutes from './src/player/player.routes.js';

dotenv.config();

const app = express();
// CORS POLICY
app.use(cors())

// USE MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(morgan(":remote-addr | :remote-user |[:date[clf]] " + "| :method | \":url\" | :status | res-size: :res[content-length] | :response-time ms"));


// MAIN ROUTES middleware
app.use('/bank', bankRoutes);
app.use('/game', gameRoutes);
app.use('/player', playerRoutes);
//api health routes
app.get('/status', (req, res) => {
    res.status(200).json({
        status: 'running',
        version: process.env.GECO_VERSION
    })
});
// WEB APP BUILD HOSTING
// app.get('/', (req, res) => {
//     res.sendFile(process.cwd() + "/../front/dist/geconomicus/index.html")
// });

// for all other routes go with 404 error
app.use(function (req, res, next) {
    let error = new Error('Not Found');
    error.status = 404;
    next(error);
});
// handle errors
app.use(function (err, req, res, next) {
    if (err.status === 500) {
        console.log(err);
    }
    res.status(err.status || 500);
    const message = err.message || "something looks wrong :(";
    res.json({
        status: "error",
        message: message
    });
});
const server = http.createServer(app);
let io = socket.initIo(server);
server.listen(process.env.GECO_PORT_NODE, () => console.log(
    "\n" +
    "   ____                                      _                \n" +
    "  / ___| ___  ___ ___  _ __   ___  _ __ ___ (_) ___ _   _ ___ \n" +
    " | |  _ / _ \\/ __/ _ \\| '_ \\ / _ \\| '_ ` _ \\| |/ __| | | / __|\n" +
    " | |_| |  __/ (_| (_) | | | | (_) | | | | | | | (__| |_| \\__ \\\n" +
    "  \\____|\\___|\\___\\___/|_| |_|\\___/|_| |_| |_|_|\\___|\\__,_|___/\n" +
    "                                                              \n"
    + process.env.GECO_VERSION + '                    made with <3 by Markovic Nicolas Copyright ©\n' + '   server is started and ready'));
