import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const EventSchema = new Schema({
    typeEvent: { type: String, required: true },
    sessionId: { type: String, required: true },
    gameStateId: { type: String, required: true },
    emitter: { type: String, required: true },
    receiver: { type: String, required: true },
    payload: { type: Object, required: true },
}, { timestamps: true });

EventSchema.index({ sessionId: 1, createdAt: 1 });
EventSchema.index({ gameStateId: 1, createdAt: 1 });

export default EventSchema;
