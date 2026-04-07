import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
// @ts-ignore
import { GAME_TYPE } from '@geco/shared';
import { I18nService } from '../../services/i18n.service';
import { Rules } from 'src/app/models/rules';

@Component({
	selector: 'app-game-options-dialog',
	templateUrl: './game-options-dialog.component.html',
	styleUrls: ['./game-options-dialog.component.scss'],
})
	export class GameOptionsDialogComponent {
	rules: Rules;
    protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly Math = Math;
	playersLength: any;
	devMode= false;

	constructor(
		private i18n: I18nService,
		public dialogRef: MatDialogRef<GameOptionsDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any
	) {
		this.i18n.loadNamespace('option');
		this.rules = data.rules;
		this.playersLength = data.playersLength;
		this.devMode = data.devMode;
		//TODO return object should be only modified Partial rules, not all rules
	}

	getTranslate(key: string): string {
		return this.i18n.instant(key);
	}
}
