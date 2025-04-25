import { Component, Inject, Input } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from "@angular/material/dialog";
import { faCircleInfo, faKeyboard, faQrcode } from "@fortawesome/free-solid-svg-icons";
import { Game } from 'src/app/models/game';

@Component({
	selector: 'app-notice-btn',
	templateUrl: './notice-btn.component.html',
	styleUrls: ['./notice-btn.component.scss']
})
export class NoticeBtnComponent {
	protected readonly faInfo = faCircleInfo;
	@Input() labelBtn = "GAME_NOTICE";
	@Input() icon = true;
	@Input() stroked = false;
	@Input() amountCardsForProd = 4;
	@Input() timerCredit = 5;

	constructor(public dialog: MatDialog) {
	}

	showRules() {
		this.dialog.open(GameInfosDialog, {
			data: {
				amountCardsForProd: this.amountCardsForProd, timerCredit: this.timerCredit
			}
		});
	}
}

@Component({
	selector: 'game-infos-dialog',
	templateUrl: '../../dialogs/game-infos-dialog.html',
})
export class GameInfosDialog {
	amountCardsForProd: number;
	timerCredit: number;
	constructor(public dialogRef: MatDialogRef<GameInfosDialog>, @Inject(MAT_DIALOG_DATA) public data: any) {
		this.amountCardsForProd = data.amountCardsForProd;
		this.timerCredit = data.timerCredit;
	}

	faQrcode = faQrcode;
	faKeyboard = faKeyboard;
}

