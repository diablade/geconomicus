import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer;
const options = {
    family:             4, // Use IPv4, skip trying IPv6
    maxPoolSize:        10
}

const connect = async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connection.close();
    await mongoose.connect(mongoUri,options);
};

const close = async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
};

const clear = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
};
export default { connect, close, clear };
