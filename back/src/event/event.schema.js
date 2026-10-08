import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const EventSchema = new Schema(
	{
		typeEvent: { type: String, required: true },
		sessionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Session',
			required: true,
		},
		gameStateId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'GameState',
            required: false,
		},
		emitter: { type: String },
		receiver: { type: String },
		payload: { type: Object },
		at: { type: Date, default: Date.now },
	},
	{ timestamps: true }
);

EventSchema.index({ sessionId: 1, createdAt: 1 });
EventSchema.index({ gameStateId: 1, createdAt: 1 });

export default EventSchema;
