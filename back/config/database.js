//Set up mongoose connection
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import log from "../config/log.js";

dotenv.config({path:'./../config/.env'});

const hostname = process.env.GECO_DB_CONFIG_HOSTNAME;
const port = process.env.GECO_DB_CONFIG_PORT;
const user = process.env.GECO_DB_CONFIG_USER;
const pass = process.env.GECO_DB_CONFIG_PASSWORD;
const collection = process.env.GECO_DB_CONFIG_COLLECTION;

const env = user ? user + ":" + pass + "@" : "";
const uri = "mongodb://" + env + hostname + ":" + port + "/" + collection + (user ? "?authSource=admin" : "");


const options = {
    useNewUrlParser:    true,
    useUnifiedTopology: true,
    family:             4, // Use IPv4, skip trying IPv6
    maxPoolSize:        20
}


const connect = () => {
    mongoose.connect(uri, options, (err, db) => {
        if (err) {
            log.error(err);
        }
        else {
            // console.log("Database connected!");
        }
    });
    mongoose.connection.on("error", function(err) {
        log.error("Mongoose connection error: " + err);
    });
    mongoose.connection.on("connected", function() {
        // log.info("Mongoose connected to " + collection);
    });
    mongoose.connection.on("disconnected", function() {
        log.info("Mongoose disconnected");
    });

    mongoose.Promise = global.Promise;
}

export { connect };
export default mongoose;
