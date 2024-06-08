import mongoose from "mongoose";
import {constructor} from "../game/game.model.js";
import _ from "lodash";

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
const colors = ["red", "yellow", "green", "blue"];


async function generateOneCard(letter, color, weight, price) {
	const comId = new mongoose.Types.ObjectId();
	let card = constructor.card(letter, color, weight, price);
	card._id = comId;
	return card;
}

export default {
	async generateDecks(game) {
		const prices = [game.priceWeight1, game.priceWeight2, game.priceWeight3, game.priceWeight4];

		let tableDecks = [[], [], [], []];
		let lettersInGame = game.players.length;
		if (!game.generateLettersAuto) {
			lettersInGame = game.generateLettersInDeck;
		}
		// genere cartes pour les 4 lots
		for (let weight = 0; weight <= 3; weight++) {
			let deck = [];
			for (let letter = 0; letter <= lettersInGame; letter++) {
				// genere 3, 4 ou 5 cartes identiques
				for (let j = 1; j <= game.generatedIdenticalCards; j++) {
					const card = await generateOneCard(letters[letter], colors[weight], weight, prices[weight]);
					deck.push(card);
				}
			}
			tableDecks[weight] = _.shuffle(deck);
		}
		return tableDecks;
	}
}
