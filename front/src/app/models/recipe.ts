import * as _ from 'lodash-es';
import {Card} from './game';

export class Ingredient {
	key = "";
	have = 0;
}

export class Recipe {
	letter = "";
	weight = 0;
	ingredients: Ingredient[] = [];
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

export function getAvailableRecipes(items: Card[], productionCards: number) {
	let recipes: Recipe[] = [];
	_.forEach(items, item => {
		//found recipe
		let recipe = _.find(recipes, (recipe: Recipe) => recipe.letter == item.letter && recipe.weight == item.weight);
		if (!recipe) {
			let newRecipe = new Recipe(item.letter, item.weight);
			newRecipe.generateIngredients(productionCards);
			recipes.push(newRecipe);
		}
	});

	//recipe check have ingredient
	recipes.forEach(recipe => {
		recipe.ingredients.forEach(ingredient => {
			ingredient.have = _.filter(items, item => item.key == ingredient.key).length;
		});
	});

	//recipe check completed
	recipes.forEach(recipe => {
		recipe.completed = recipe.ingredients.every(ingredient => ingredient.have > 0);
	});

	//order by count ingredients
	recipes = _.orderBy(
		recipes,
		[r => _.sumBy(r.ingredients, (i: Ingredient) => i.have), r => r.letter],
		["desc", "asc"]
	);

	return recipes;
}
