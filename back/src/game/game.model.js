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

let EventGeco = {
    typeEvent: String,
    emitter: String,
    receiver: String,
    amount: Number,
    resources: [Card],
    date: Date,
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
    tauxCroissance: {type: Number, required: true},
    currentMassMonetary: {type: Number, required: true},
    currentDU: {type: Number, required: true},
    inequalityStart: {type: Boolean, required: true},
    startAmountCoins: {type: Number, required: true},
    priceWeight1: {type: Number, required: true},
    priceWeight2: {type: Number, required: true},
    priceWeight3: {type: Number, required: true},
    priceWeight4: {type: Number, required: true},
    players: {type: [Player], required: false},
    decks: {type: [[Card]], required: false},
    events: {type: [EventGeco], required: false},
    round: {type: Number, required: false},
    roundMax: {type: Number, required: false},
    roundMinutes: {type: Number, required: false},

    modified: {type: Date, default: Date.now},
    created: {type: Date, default: Date.now},
});


let constructor = {
    card: Card = (letter, color, weight, price) => {
        return {letter: letter, color: color, weight: weight, price: price};
    },
    credit: Credit = (amount, interest) => {
        return {amount: amount, interest: interest}
    },
    player: Player = () => {
        return {}
    },
    event: EventGeco = (typeEvent, emitter, receiver, amount, resources, date) => {
        return {
            typeEvent: typeEvent,
            emitter: emitter,
            receiver: receiver,
            amount: amount,
            resources: resources,
            date: date
        };
    }
}

export default mongoose.model('Game', Game);
export {constructor};
