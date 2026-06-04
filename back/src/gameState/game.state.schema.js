import mongoose from 'mongoose';
import { GAME_STATUS, GAME_TYPE, CREDIT_STATUS, PLAYER_STATUS } from '@geco/shared';

const Schema = mongoose.Schema;

const CardSchema = new Schema(
	{
		key: { type: String, required: true },
		letter: { type: String, required: true },
		color: { type: String, required: true },
		weight: { type: Number, required: true },
		price: { type: Number, required: true },
	},
	{ _id: false }
);

let Credit = new Schema(
	{
		id: { type: String, required: true },
		amount: { type: Number, required: true },
		interest: { type: Number, required: true },
		playerStateIdx: { type: Number, required: true },
		status: { type: String, enum: Object.values(CREDIT_STATUS), required: true },
		extended: { type: Number, required: true },
		createdAt: { type: Date, required: true },
		startedAt: { type: Date },
		endAt: { type: Date },
		timerLeft: { type: Number, required: true },
	},
	{ _id: false }
);

let PlayerState = new Schema(
	{
		idx: { type: Number, required: true },
		avatarIdx: { type: Number, required: true },
		status: { type: String, required: true, enum: Object.values(PLAYER_STATUS) },
		coins: { type: Number, required: true },
		cards: { type: [CardSchema], required: true },
	},
	{ _id: false }
);

let DeathState = new Schema(
	{
		intervalDeathMs: { type: Number, required: true, default: 0 },
		intervalDeathLeft: { type: Number, required: true, default: 0 },
		deathQueue: { type: Array, required: true, default: [] },
	},
	{ _id: false }
);

let GameTimers = new Schema(
	{
		createdAt: { type: Date },
		startedAt: { type: Date },
		endedAt: { type: Date },
		remainingTime: { type: Number, required: true, default: 0 },
		deathState: { type: DeathState, default: {} },
	},
	{ _id: false }
);

let GameStateSchema = new Schema(
	{
		typeMoney: {
			type: String,
			enum: Object.values(GAME_TYPE),
			required: true,
		},
		sessionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Session',
			required: true,
		},
		ruleIdx: {
			type: Number,
			required: true,
		},
		status: {
			type: String,
			required: true,
			enum: Object.values(GAME_STATUS),
			default: GAME_STATUS.CREATED,
		},
		decks: {
			type: [[CardSchema]],
			required: true,
			default: [],
		},
		playerStateIndexSeq: { type: Number, required: true, default: 0 },
		playersStates: {
			type: [PlayerState],
			required: true,
			default: [],
		},
		currentMassMonetary: {
			type: Number,
			required: true,
			default: 0,
		},
		//state june
		currentDU: {
			type: Number,
			default: 0,
		},
		//state debt
		creditIndexSeq: { type: Number, required: true, default: 0 },
		credits: {
			type: [Credit],
			default: [],
		},
		bankInterestEarned: {
			type: Number,
			default: 0,
		},
		bankGoodsEarned: {
			type: Number,
			default: 0,
		},
		bankMoneyLost: {
			type: Number,
			default: 0,
		},
		gameTimers: {
			type: GameTimers,
			default: {},
		},
	},
	{ timestamps: true }
);

export default GameStateSchema;
