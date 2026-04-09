import * as _ from 'lodash-es';
import {Card} from './gameState';

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

	generateIngredients(amountCardsForProd: number) {
		for (let i = 1; i <= amountCardsForProd; i++) {
			this.ingredients.push({key: `${this.letter}${this.weight}${i}`, have: 0});
		}
	}
}

export function getAvailableRecipes(items: Card[], amountCardsForProd: number, generatedIdenticalLetters: number) {
	let recipes: Recipe[] = [];
	_.forEach(items, item => {
		//found recipe
		let recipe = _.find(recipes, (recipe: Recipe) => recipe.letter == item.letter && recipe.weight == item.weight);
		if (!recipe) {
			let newRecipe = new Recipe(item.letter, item.weight);
			newRecipe.generateIngredients(generatedIdenticalLetters);
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
		let have = recipe.ingredients.filter(i => i.have).length;
		recipe.completed = have >= amountCardsForProd;
	});

	//order by count ingredients
	recipes = _.orderBy(
		recipes,
		[r => _.sumBy(r.ingredients, (i: Ingredient) => i.have), r => r.letter],
		["desc", "asc"]
	);

	return recipes;
}
