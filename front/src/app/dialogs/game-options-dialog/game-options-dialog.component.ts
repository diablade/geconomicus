import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
// @ts-ignore
import {C} from "../../../../../back/shared/constantes.mjs";
import {I18nService} from '../../services/i18n.service';
import {Rules} from 'src/app/models/rules';

@Component({
	selector: 'app-game-options-dialog',
	templateUrl: './game-options-dialog.component.html',
	styleUrls: ['./game-options-dialog.component.scss']
})
export class GameOptionsDialogComponent {
	game: Rules;
	C = C;
	protected readonly Math = Math;
	playersLength: any;

	constructor(
		private i18n: I18nService,
		public dialogRef: MatDialogRef<GameOptionsDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any
	) {
		this.i18n.loadNamespace("option");
		this.game = data.rules;
		this.playersLength = data.playersLength;

		//TODO return object should be only modified Partial rules, not all rules
	}

	getTranslate(key: string): string {
		return this.i18n.instant(key);
	}
}
