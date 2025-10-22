import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Recipe} from '../../models/recipe';
import {faCheck} from '@fortawesome/free-solid-svg-icons';
import {ThemesService} from '../../services/themes.service';

@Component({
	selector: 'app-recipe',
	templateUrl: './recipe.component.html',
	styleUrls: ['./recipe.component.scss']
})
export class RecipeComponent {

	@Input() recipe: Recipe = new Recipe('', 0);
	@Input() width: string = 'calc(18vw)';
	@Input() height: string = 'calc(18vw * 1.5)';
	@Output() onReceipeCompleted: EventEmitter<Recipe> = new EventEmitter<Recipe>();
	@Output() onIngredientClick: EventEmitter<any> = new EventEmitter<any>();
	faCheck = faCheck;

	constructor(private themesService: ThemesService) {
	}

	ngOnInit(): void {

	}

	buildCardLvlUp() {
		this.onReceipeCompleted.emit(this.recipe);
	}

	getBuildText() {
		switch (this.recipe.weight) {
			case 0:
				return "CARD.BUILD_UP_0";
			case 1:
				return "CARD.BUILD_UP_1";
			case 2:
				return "CARD.BUILD_UP_2";
		}
		return "CARD.BUILD_UP";
	}

	getReceipeColor() {
		switch (this.recipe.weight) {
			case 0:
				return "red";
			case 1:
				return "yellow";
			case 2:
				return "green";
		}
		return "blue";
	}

	ingredientClick(ingredient: any) {
		if (ingredient.have == 0) {
			this.onIngredientClick.emit(ingredient);
		}
	}

	getIcon(icon: string) {
		return this.themesService.getIcon(icon);
	}
}
