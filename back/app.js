import express from 'express';
import dotenv from 'dotenv';
import mongoose from './database';
import morgan from 'morgan';

dotenv.config();

// IMPORT ROUTES

const app = express();

// WEB APP
app.use(express.static(process.cwd() + "/../front/dist/geconomicus"));
// USE MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(morgan(":remote-addr | :remote-user |[:date[clf]] " + "| :method | \":url\" | :status | res-size: :res[content-length] | :response-time ms"));

// CORS POLICY
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'PUT, POST, DELETE, GET');
        return res.status(200).json({});
    }
    next();
});

// MAIN ROUTES middleware
app.use('/back/xxx', xxx);

//api health routes
app.get('/api/status', (req, res) => {
    res.status(200).json({
        status:  'running',
        version: process.env.VERSION
    })
});
// WEB APP BUILD HOSTING
app.get('/', (req, res) => {
    res.sendFile(process.cwd() + "/../front/dist/geconomicus/index.html")
});

// for all other routes go with 404 error
app.use(function(req, res, next) {
    let error = new Error('Not Found');
    error.status = 404;
    next(error);
});
// handle errors
app.use(function(err, req, res, next) {
    if (err.status === 500) console.log(err);
    res.status(err.status || 500);
    const message = err.message || "something looks wrong :(";
    res.json({
        status:  "error",
        message: message
    });
});

app.listen(process.env.EVOPOL_PORT_NODE, () => console.log(
    "TODO geconomicus"
    + process.env.VERSION + '                      made with <3 by Markovic Nicolas \n'
    + '   server is started and ready'));
