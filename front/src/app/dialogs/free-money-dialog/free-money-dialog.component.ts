import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { faFileSignature } from '@fortawesome/free-solid-svg-icons';
import { GAME_TYPE, PLAYER_STATUS } from '@geco/shared';
import { Rules } from 'src/app/models/rules';
import { Observable } from 'rxjs';

@Component({
	selector: 'app-free-money-dialog',
	templateUrl: './free-money-dialog.component.html',
	styleUrls: ['./free-money-dialog.component.scss'],
})
export class FreeMoneyDialogComponent {
	protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly ALIVE = PLAYER_STATUS.ALIVE;
	faFileSignature = faFileSignature;
	players: Observable<any[]>;
	selectedPlayerIdx = -1;
	selectedPlayer: any;

	constructor(
		public dialogRef: MatDialogRef<FreeMoneyDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: { rules: Observable<Rules>; players: Observable<any[]> }
	) {
		this.players = data.players;
	}

	cancel() {
		this.dialogRef.close();
	}

	giveMoney() {
		this.dialogRef.close({
			playerName: this.selectedPlayer.avatar.name,
			playerStateIdx: this.selectedPlayer?.idx ?? -1,
			amount: 1,
		});
	}

	compareById(a: any, b: any): boolean {
		return a?.idx === b?.idx;
	}
}
