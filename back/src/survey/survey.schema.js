import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const SurveySchema = new Schema({
    sessionId: { type: String, required: true },
    gameStateId: { type: String, required: true },
    avatarId: { type: String, required: true },
    depressedHappy: { type: Number, required: true, default: 0 },
    individualCollective: { type: Number, required: true, default: 0 },
    insatisfiedAccomplished: { type: Number, required: true, default: 0 },
    greedyGenerous: { type: Number, required: true, default: 0 },
    competitiveCooperative: { type: Number, required: true, default: 0 },
    anxiousConfident: { type: Number, required: true, default: 0 },
    agressiveAvenant: { type: Number, required: true, default: 0 },
    irritableTolerant: { type: Number, required: true, default: 0 },
    dependantAutonomous: { type: Number, required: true, default: 0 },
});

SurveySchema.index(
    { sessionId: 1, gameStateId: 1, avatarId: 1 },
    { unique: true }
);

export default SurveySchema;