import SurveyModel from './survey.schema.js';

/* Create */
SurveyModel.create = async (surveyObject) => {
    const newSurvey = new SurveyModel({
        sessionId: surveyObject.sessionId,
        gameStateId: surveyObject.gameStateId,
        avatarId: surveyObject.avatarId,
        depressedHappy: surveyObject.depressedHappy,
        individualCollective: surveyObject.individualCollective,
        insatisfiedAccomplished: surveyObject.insatisfiedAccomplished,
        greedyGenerous: surveyObject.greedyGenerous,
        competitiveCooperative: surveyObject.competitiveCooperative,
        anxiousConfident: surveyObject.anxiousConfident,
        agressiveAvenant: surveyObject.agressiveAvenant,
        irritableTolerant: surveyObject.irritableTolerant,
        dependantAutonomous: surveyObject.dependantAutonomous,
    });
    return await newSurvey.save();
};

/* Retrieve */
SurveyModel.getByGameStateIdAndAvatarId = async (gameStateId, avatarId) => {
    return await SurveyModel.findOne({ gameStateId: gameStateId, avatarId: avatarId }).exec();
};
SurveyModel.getByGameStateId = async (gameStateId) => {
    return await SurveyModel.find({ gameStateId }).exec();
};
SurveyModel.getBySessionId = async (sessionId) => {
    return await SurveyModel.find({ sessionId }).exec();
};

/* Update */
SurveyModel.update = async (id, updates) => {
    return await SurveyModel.updateOne({ _id: id }, { $set: updates }).exec();
};

/* Remove */
SurveyModel.removeAllBySessionId = async (sessionId) => {
    return await SurveyModel.deleteMany({ sessionId }).exec();
};
SurveyModel.removeAllByGameStateId = async (gameStateId) => {
    return await SurveyModel.deleteMany({ gameStateId }).exec();
};

export default SurveyModel;
