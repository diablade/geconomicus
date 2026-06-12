import { Component, Inject, Input } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { faKeyboard, faQrcode } from '@fortawesome/free-solid-svg-icons';
import { I18nService } from '../../services/i18n.service';

@Component({
	selector: 'app-notice-btn',
	templateUrl: './notice-btn.component.html',
	styleUrls: ['./notice-btn.component.scss'],
})
export class NoticeBtnComponent {
	@Input() labelBtn = 'GAME_NOTICE';
	@Input() icon = true;
	@Input() stroked = false;
	@Input() white = false;
	@Input() amountCardsForProd = 4;
	@Input() durationCredit = 5;

	constructor(
		public dialog: MatDialog,
		private i18n: I18nService
	) {
		this.i18n.loadNamespace('notice');
	}

	showRules() {
		this.dialog.open(GameInfosDialog, {
			data: {
				amountCardsForProd: this.amountCardsForProd,
				durationCredit: this.durationCredit,
			},
		});
	}
}

@Component({
	selector: 'game-infos-dialog',
	templateUrl: './game-infos-dialog.html',
})
export class GameInfosDialog {
	amountCardsForProd: number;
	durationCredit: number;
	constructor(
		public dialogRef: MatDialogRef<GameInfosDialog>,
		@Inject(MAT_DIALOG_DATA) public data: any
	) {
		this.amountCardsForProd = data.amountCardsForProd;
		this.durationCredit = data.durationCredit;
	}

	faQrcode = faQrcode;
	faKeyboard = faKeyboard;
}
