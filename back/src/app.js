import express from 'express';
import dotenv from 'dotenv';
// import {mongoose} from '../config/database.js';
import morgan from 'morgan';
import cors from 'cors';
import socket from '../config/socket.js';
import http from 'http';
import log from '../config/log.js';

// IMPORT ROUTES
import bankRoutes from "./bank/bank.routes.js";
import gameRoutes from './game/game.routes.js';
import playerRoutes from './player/player.routes.js';
import * as db from "../config/database.js";

dotenv.config();
if (process.env.GECO_NODE_ENV !== "test") {
	db.connect();
}

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

// for all other routes go with 404 error
app.use(function (req, res, next) {
	let error = new Error('Not Found');
	error.status = 404;
	next(error);
});
// handle errors
app.use(function (err, req, res, next) {
	if (err.status === 500) {
		log.error(err);
	}
	res.status(err.status || 500);
	const message = err.message || "something looks wrong :(";
	res.json({
		status: "error",
		message: message
	});
});
if (process.env.GECO_NODE_ENV !== "test") {
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
}
export default app;
