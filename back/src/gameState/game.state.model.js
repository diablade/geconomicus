import mongoose from 'mongoose';
import GameStateSchema from './game.state.schema.js';
const GameStateModel = mongoose.model('GameState', GameStateSchema);
export default GameStateModel;