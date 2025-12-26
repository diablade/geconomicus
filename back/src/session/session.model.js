import mongoose from 'mongoose';
import SessionSchema from './session.schema.js';
const SessionModel = mongoose.model('Session', SessionSchema);
export default SessionModel;