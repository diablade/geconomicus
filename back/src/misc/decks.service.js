import mongoose from "mongoose";
import GameModel, {constructor} from "../game/game.model.js";
import _ from "lodash";
import log from "../../config/log.js";

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
	},
	async pushCardsInDecks(idGame, cards) {
		const groupedCards = _.groupBy(_.sortBy(cards, 'weight'), 'weight');
		await GameModel.updateOne(
			{_id: idGame},
			{
				$push: {
					[`decks.${0}`]: {$each: groupedCards[0] ? groupedCards[0] : []},
					[`decks.${1}`]: {$each: groupedCards[1] ? groupedCards[1] : []},
					[`decks.${2}`]: {$each: groupedCards[2] ? groupedCards[2] : []},
					[`decks.${3}`]: {$each: groupedCards[3] ? groupedCards[3] : []},
				},
			}
		).catch(err => {
			log.error('cards are not back in decks, error', err);
		});
	}
}
