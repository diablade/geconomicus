import { Component, Inject } from '@angular/core';
import { PlayerState } from '../../models/gameState';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { faFileSignature } from '@fortawesome/free-solid-svg-icons';
import { GAME_TYPE, PLAYER_STATUS } from '@geco/shared';
import * as _ from 'lodash-es';
import { MatRadioChange } from '@angular/material/radio';
import { Rules } from 'src/app/models/rules';
import { Observable } from 'rxjs';
import { Avatar } from 'src/app/models/avatar';

@Component({
	selector: 'app-contract-dialog',
	templateUrl: './contract-dialog.component.html',
	styleUrls: ['./contract-dialog.component.scss'],
})
export class ContractDialogComponent {
	protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly ALIVE = PLAYER_STATUS.ALIVE;
	faFileSignature = faFileSignature;
	rules: Rules = new Rules();
	players: Observable<any[]>;
	selectedCreditOption = 'basic';
	selectedPlayerIdx = -1;
	selectedPlayer: any;
	amount = 3;
	interest = 1;
	maxAmount = 10;
	maxInterest = 5;

	constructor(
		public dialogRef: MatDialogRef<ContractDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: { rules: Observable<Rules>; players: Observable<any[]> }
	) {
		data.rules.subscribe((rules) => {
			this.rules = rules;
		});
		this.players = data.players;
	}

	cancel() {
		this.dialogRef.close();
	}

	saveUserCredit() {
		this.dialogRef.close({
			playerName: this.selectedPlayer.avatar.name,
			playerIdx: this.selectedPlayer?.idx ?? -1,
			amount: this.amount,
			interest: this.interest,
		});
	}

	onCreditOptionChange($event: MatRadioChange) {
		switch ($event.value) {
			case 'basic':
				this.amount = 3;
				this.interest = 1;
				break;
			case 'double':
				this.amount = 6;
				this.interest = 2;
				break;
			default:
				break;
		}
	}

	compareById(a: any, b: any): boolean {
		return a?.idx === b?.idx;
	}
}
