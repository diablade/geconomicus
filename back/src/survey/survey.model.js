import mongoose from 'mongoose';
import SurveySchema from './survey.schema.js';
const SurveyModel = mongoose.model('Survey', SurveySchema);
export default SurveyModel;
