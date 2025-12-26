import mongoose from 'mongoose';
import Avatar from './avatar/avatar.schema.js';
import Rules from './rules/rules.schema.js';

const Schema = mongoose.Schema;


let SessionSchema = new Schema({
	name: { type: String, required: true },
	animator: { type: String, required: true, default: "-" },
	location: { type: String, required: true, default: "-" },
	shortId: { type: String, required: true },
	devMode: { type: Boolean, required: true, default: false },
	theme: { type: String, required: true, default: "CLASSIC" },
	gamesRules: { type: [Rules], required: true, default: [] },
	players: { type: [Avatar], required: true, default: [] },
}, { timestamps: true });


export default SessionSchema;
