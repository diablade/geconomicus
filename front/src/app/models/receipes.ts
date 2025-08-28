import * as _ from 'lodash-es';
import {Card} from './game';

export class ingredient {
	key = "";
	have = 0;
}

export class Receipe {
	letter = "";
	weight = 0;
	ingredients: ingredient[] = [];
	completed = false;

	constructor(letter: string, weight: number) {
		this.letter = letter;
		this.weight = weight;
	}

	generateIngredients(productionCards: number) {
		for (let i = 1; i <= productionCards; i++) {
			this.ingredients.push({key: `${this.letter}${this.weight}${i}`, have: 0});
		}
	}
}

export function getAvailableReceipes(items: Card[], productionCards: number) {
	let receipes: Receipe[] = [];
	_.forEach(items, item => {
		//found receipe
		let receipe = _.find(receipes, (receipe: Receipe) => receipe.letter == item.letter && receipe.weight == item.weight);
		if (!receipe) {
			let newReceipe = new Receipe(item.letter, item.weight);
			newReceipe.generateIngredients(productionCards);
			receipes.push(newReceipe);
		}
	});

	//receipe check have ingredient
	receipes.forEach(receipe => {
		receipe.ingredients.forEach(ingredient => {
			ingredient.have = _.filter(items, item => item.key == ingredient.key).length;
		});
	});

	//receipe check completed
	receipes.forEach(receipe => {
		receipe.completed = receipe.ingredients.every(ingredient => ingredient.have > 0);
	});

	//order by count ingredients
	receipes = _.orderBy(
		receipes,
		[r => _.sumBy(r.ingredients, (i:ingredient) => i.have), r => r.letter],
		["desc", "asc"]
	  );

	return receipes;
}
