import mongoose from 'mongoose';

const Schema = mongoose.Schema;

let Card = {
    letter: String,
    color: String,
    weight: Number,
    price: Number,
}

let Credit = {
    amount: Number,
    interest: Number,
}

let Player = {
    name: String,
    image: String,
    coins: Number,
    credits: [Credit],
    cards: [Card],
    eye: Number,
    earrings: Number,
    eyebrows: Number,
    features: Number,
    hair: Number,
    glasses: Number,
    mouth: Number,
    skinColor: String,
    hairColor: String,
    earringsProbability: Number,
    glassesProbability: Number,
    featuresProbability: Number,
    status: String,
}

let Game = new Schema({
    status: {type: String, required: true},
    name: {type: String, required: true},
    typeMoney: {type: String, required: false},
    priceWeight1: {type: Number, required: true},
    priceWeight2: {type: Number, required: true},
    priceWeight3: {type: Number, required: true},
    priceWeight4: {type: Number, required: true},
    players: {type: [Player], required: false},
    decks: {type: [[Card]], required: false},
    round: {type: Number, required: false},
    roundMax: {type: Number, required: false},
    roundMinutes: {type: Number, required: false},

    modified: {type: Date, default: Date.now},
    created: {type: Date, default: Date.now},
});

export default mongoose.model('Game', Game);
