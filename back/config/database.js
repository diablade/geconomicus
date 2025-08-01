//Set up mongoose connection
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import log from "./log.js";

dotenv.config({path:'./../config/.env'});

const hostname = process.env.GECO_DB_CONFIG_HOSTNAME;
const port = process.env.GECO_DB_CONFIG_PORT;
const user = process.env.GECO_DB_CONFIG_USER;
const pass = process.env.GECO_DB_CONFIG_PASSWORD;
const collection = process.env.GECO_DB_CONFIG_COLLECTION;

const env = user ? user + ":" + pass + "@" : "";
const uri = "mongodb://" + env + hostname + ":" + port + "/" + collection + (user ? "?authSource=admin" : "");

const options = {
    family:             4, // Use IPv4, skip trying IPv6
    maxPoolSize:        10
}

const connect = async () => {
    try {
        await mongoose.connect(uri, options);
        log.info("Database connected!");
    } catch (err) {
        log.error("Failed to connect to database:", err);
    }
    mongoose.connection.on("error", function (err) {
        log.error("Mongoose connection error: ", err);
    });
    mongoose.connection.on("connected", function () {
        log.info("Mongoose connected");
    });
    mongoose.connection.on("disconnected", function () {
        log.info("Mongoose disconnected");
    });
    mongoose.Promise = global.Promise;
}

export { connect };
export default mongoose;
