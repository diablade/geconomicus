

// Import des dépendances
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import log from "../config/log.js";
// import gameSchema from "./../src/game/game.schema.js";

dotenv.config({ path: './../config/.env' });

const hostname = process.env.GECO_DB_CONFIG_HOSTNAME;
const port = process.env.GECO_DB_CONFIG_PORT;
const user = process.env.GECO_DB_CONFIG_USER;
const pass = process.env.GECO_DB_CONFIG_PASSWORD;
const collection = process.env.GECO_DB_CONFIG_COLLECTION;

// Construction de l'URI de connexion
const env = user ? `${user}:${pass}@` : '';
const uri = `mongodb://${env}${hostname}:${port}/${collection}${user ? '?authSource=admin' : ''}`;

// Options de connexion
const options = {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	maxPoolSize: 10
};

// Création du client MongoDB
let client;
let database;

const connect = async () => {
	try {
		client = new MongoClient(uri, options);
		await client.connect();
		database = client.db(collection);

		log.info(`Connected to MongoDB database: ${collection} on ${hostname}:${port}`);

		// await database.createCollection('games', {
		// 	validator: { $jsonSchema: gameSchema },
		// 	validationLevel: 'strict'
		// });

		// Gestion des événements de connexion et déconnexion
		client.on('close', () => {
			log.info('MongoDB connection closed');
		});
	} catch (error) {
		log.error(`MongoDB connection error: ${error.message}`);
		process.exit(1);  // Quitte le processus si la connexion échoue
	}
};

// Fonction pour récupérer la base de données
const getDatabase = () => {
	// if (!database) {
	// 	throw new Error('Database not connected. Please call connect() first.');
	// 	console.log('Database not connected. Please call connect() first.');
	// 	return null;
	// }
	return database;
};

// Fonction pour fermer la connexion
const closeConnection = async () => {
	if (client) {
		await client.close();
		log.info('MongoDB connection closed');
	}
};

export { connect, getDatabase, closeConnection };
