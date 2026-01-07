import SurveyModel from "./survey.model.js";

const SurveyService = {};

/* Create */
SurveyService.create = async (surveyObject) => {
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
SurveyService.getBySessionGameStateAvatarId = async (sessionId, gameStateId, avatarId) => {
    return await SurveyModel.findOne({ sessionId: sessionId, gameStateId: gameStateId, avatarId: avatarId }).exec();
};
SurveyService.getByGameStateId = async (gameStateId) => {
    return await SurveyModel.find({ gameStateId }).exec();
};
SurveyService.getBySessionId = async (sessionId) => {
    return await SurveyModel.find({ sessionId }).exec();
};

/* Update */
SurveyService.update = async (id, updates) => {
    return await SurveyModel.updateOne({ _id: id }, { $set: updates }, { runValidators: true }).exec();
};

/* Remove */
SurveyService.removeAllBySessionId = async (sessionId) => {
    return await SurveyModel.deleteMany({ sessionId }).exec();
};
SurveyService.removeAllByGameStateId = async (gameStateId) => {
    return await SurveyModel.deleteMany({ gameStateId }).exec();
};

export default SurveyService;
