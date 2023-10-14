//Set up mongoose connection
import mongoose from 'mongoose';
import dotenv from 'dotenv';

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

mongoose.connect(uri, options, (err, db) => {
    if (err) {
        console.error(err);
    }
    else {
        // console.log("database connected!");
    }
});
mongoose.connection.on("connected", function() {
    // console.log(" Mongoose connected to " + collection);
});
mongoose.connection.on("error", function(err) {
    console.log(" Mongoose connection error: " + err);
});
mongoose.connection.on("disconnected", function() {
    console.log(" Mongoose disconnected");
});

mongoose.Promise = global.Promise;
export default mongoose;
