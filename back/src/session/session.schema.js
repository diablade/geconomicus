import mongoose from 'mongoose';
import AvatarSchema from './avatar/avatar.schema.js';
import RulesSchema from './rules/rules.schema.js';
const Schema = mongoose.Schema;

let SessionSchema = new Schema({
	name: { type: String, required: true },
	animator: { type: String, required: true, default: "-" },
	location: { type: String, required: true, default: "-" },
	shortId: { type: String, required: true },
	devMode: { type: Boolean, required: true, default: false },
	theme: { type: String, required: true, default: "CLASSIC" },
	gamesRules: { type: [RulesSchema], required: true, default: [] },
	players: { type: [AvatarSchema], required: true, default: [] },
}, { timestamps: true });


export default SessionSchema;
