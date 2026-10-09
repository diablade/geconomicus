import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const AvatarSchema = new Schema({
    idx:                 {
        type:     Number,
        required: true
    },
    name:                {
        type:     String,
        required: true
    },
    image:               String,
    eyes:                Number,
    earrings:            Number,
    eyebrows:            Number,
    features:            Number,
    hair:                Number,
    glasses:             Number,
    mouth:               Number,
    skinColor:           String,
    hairColor:           String,
    earringsProbability: Number,
    glassesProbability:  Number,
    featuresProbability: Number,
    boardConf:           String,
    boardColor:          String,
}, {_id: false});

export default AvatarSchema;
