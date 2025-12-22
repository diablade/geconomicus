//Set up mongoose connection
import mongoose from 'mongoose';
import env from './env.js';
import log from "./log.js";

const hostname = env.db_config_hostname;
const port = env.db_config_port;
const user = env.db_config_user;
const pass = env.db_config_password;
const collection = env.db_config_collection;

const credentials = user ? user + ":" + pass + "@" : "";
const uri = "mongodb://" + credentials + hostname + ":" + port + "/" + collection + (user ? "?authSource=admin" : "");

const options = {
    family:      4, // Use IPv4, skip trying IPv6
    maxPoolSize: 10
}

const connect = async () => {
    try {
        await mongoose.connect(uri, options);
        log.info("Database connected!");
    }
    catch (err) {
        log.error("Failed to connect to database:", err);
    }
    mongoose.connection.on("error", function(err) {
        log.error("Mongoose connection error: ", err);
    });
    mongoose.connection.on("connected", function() {
        log.info("Mongoose connected");
    });
    mongoose.connection.on("disconnected", function() {
        log.info("Mongoose disconnected");
    });
    mongoose.Promise = global.Promise;
}

export {connect};
export default mongoose;
