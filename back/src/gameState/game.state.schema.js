import mongoose from 'mongoose';
import { GAME_STATUS, GAME_TYPE } from '@geco/shared';

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
		idx: { type: Number, required: true }, //nanoId4
		amount: { type: Number, required: true },
		interest: { type: Number, required: true },
		playerLifeId: { type: String, required: true },
		status: { type: String, required: true },
		extended: { type: Number, required: true },
		createDate: { type: Date, required: true },
		startDate: { type: Date },
		endDate: { type: Date },
	},
	{ _id: false }
);

let PlayerLife = new Schema(
	{
		idx: { type: Number, required: true },
		avatarIdx: { type: Number, required: true },
		status: { type: String, required: true },
		coins: { type: Number, required: true },
		cards: { type: [CardSchema], required: true },
	},
	{ _id: false }
);

let GameStateSchema = new Schema(
	{
		typeMoney: {
			type: String,
			enum: [GAME_TYPE.JUNE, GAME_TYPE.DEBT],
			required: true,
		},
		sessionId: {
			type: String,
			required: true,
		},
		ruleIdx: {
			type: Number,
			required: true,
		},
		status: {
			type: String,
			required: true,
			default: GAME_STATUS.CREATED,
		},
		decks: {
			type: [[CardSchema]],
			required: true,
			default: [],
		},
		playerLifeIndexSeq: { type: Number, required: true, default: 0 },
		playersLifes: {
			type: [PlayerLife],
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
	},
	{ timestamps: true }
);

export default GameStateSchema;
