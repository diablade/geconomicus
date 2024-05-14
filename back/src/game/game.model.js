import mongoose from 'mongoose';

const Schema = mongoose.Schema;

let Card = {
	letter: String,
	color: String,
	weight: Number,
	price: Number,
}

let Credit = {
	id: String,
	amount: Number,
	interest: Number,
	idGame: String,
	idPlayer: String,
	status: String,
	extended: Number,
	createDate: Date,
	startDate: Date,
	endDate: Date,
}

let EventGeco = {
	typeEvent: String,
	emitter: String,
	receiver: String,
	amount: Number,
	resources: [],
	date: Date,
}

let Feedback = {
	depressedHappy: Number,
	individualCollective: Number,
	aloneIntegrated: Number,
	greedyGenerous: Number,
	competitiveCooperative: Number,
	anxiousConfident: Number,
	agressiveAvenant: Number,
	irritableTolerant: Number,
	dependantAutonomous: Number,
}

let Player = {
	name: String,
	image: String,
	coins: Number,
	cards: [Card],
	survey: Feedback,
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
	boardConf: String,
	boardColor: String,
	status: String,
}


let Game = new Schema({
	status: {type: String, required: true},
	name: {type: String, required: true},
	animator: {type: String, required: true},
	location: {type: String, required: true},
	typeMoney: {type: String, required: false},
	events: {type: [EventGeco], required: false},
	decks: {type: [[Card]], required: false},
	players: {type: [Player], required: false},
	currentMassMonetary: {type: Number, required: true},
	amountCardsForProd: {type: Number, required: true},
	generatedIdenticalCards: {type: Number, required: true},
	surveyEnabled: {type: Boolean, required: true},
	priceWeight1: {type: Number, required: true},
	priceWeight2: {type: Number, required: true},
	priceWeight3: {type: Number, required: true},
	priceWeight4: {type: Number, required: true},
	round: {type: Number, required: false},
	roundMax: {type: Number, required: false},
	roundMinutes: {type: Number, required: false},

	//option june
	currentDU: {type: Number, required: true},
	inequalityStart: {type: Boolean, required: true},
	tauxCroissance: {type: Number, required: true},
	startAmountCoins: {type: Number, required: true},
	pctPoor: {type: Number, required: true},
	pctRich: {type: Number, required: true},

	//option debt
	credits: [Credit],
	defaultCreditAmount: {type: Number, required: true},
	defaultInterestAmount: {type: Number, required: true},
	bankInterestEarned: {type: Number, required: true},
	bankGoodsEarned: {type: Number, required: true},
	timerCredit: {type: Number, required: true},
	timerPrison: {type: Number, required: true},
	manualBank: {type: Boolean, required: true},
	seizureType: {type: String, required: true},
	seizureCosts: {type: Number, required: true},
	seizureDecote: {type: Number, required: true},

	modified: {type: Date, default: Date.now},
	created: {type: Date, default: Date.now},
});


let constructor = {
	card: Card = (letter, color, weight, price) => {
		return {letter: letter, color: color, weight: weight, price: price};
	},
	credit: Credit = (id, amount, interest, idGame, idPlayer, status, createDate, startDate, endDate) => {
		return {
			_id: id,
			amount,
			interest,
			idGame,
			idPlayer,
			status,
			extended: 0,
			createDate,
			startDate,
			endDate,
		}
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
	},
	feedback: Feedback = (
		depressedHappy,
		individualCollective,
		aloneIntegrated,
		greedyGenerous,
		competitiveCooperative,
		anxiousConfident,
		agressiveAvenant,
		irritableTolerant,
		dependantAutonomous,
	) => {
		return {
			depressedHappy,
			individualCollective,
			aloneIntegrated,
			greedyGenerous,
			competitiveCooperative,
			anxiousConfident,
			agressiveAvenant,
			irritableTolerant,
			dependantAutonomous,
		}
	}
}

export default mongoose.model('Game', Game);
export {constructor};
