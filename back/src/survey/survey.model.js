import SurveyModel from './survey.schema.js';

/* Create */
SurveyModel.createNew = async (surveyObject) => {
    const newSurvey = new SurveyModel({
        sessionId: surveyObject.sessionId,
        gameId: surveyObject.gameId,
        playerId: surveyObject.playerId,
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
SurveyModel.getByGameIdAndPlayerId = async (idGame, idPlayer) => {
    return await SurveyModel.findOne({ idGame, idPlayer }).exec();
};
SurveyModel.getByGameId = async (gameId) => {
    return await SurveyModel.find({ gameId }).exec();
};
SurveyModel.getBySessionId = async (sessionId) => {
    return await SurveyModel.find({ sessionId }).exec();
};

/* Update */
SurveyModel.update = async (id, updates) => {
    return await SurveyModel.updateOne({ _id: id }, { $set: updates }).exec();
};

/* Remove */
SurveyModel.removeBySessionId = async (sessionId) => {
    return await SurveyModel.deleteMany({ sessionId }).exec();
};
SurveyModel.removeByGameId = async (gameId) => {
    return await SurveyModel.deleteMany({ gameId }).exec();
};

export default SurveyModel;
