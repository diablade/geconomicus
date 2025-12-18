import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const SurveySchema = new Schema({
    sessionId: String,
    gameId: String,
    playerId: String,
    depressedHappy: Number,
    individualCollective: Number,
    insatisfiedAccomplished: Number,
    greedyGenerous: Number,
    competitiveCooperative: Number,
    anxiousConfident: Number,
    agressiveAvenant: Number,
    irritableTolerant: Number,
    dependantAutonomous: Number,
});

export default SurveySchema;