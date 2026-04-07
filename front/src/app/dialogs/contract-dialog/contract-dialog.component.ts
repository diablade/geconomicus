import {Component, Inject} from '@angular/core';
import {Credit, Game, Player} from "../../models/game";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {faFileSignature} from "@fortawesome/free-solid-svg-icons";
// @ts-ignore
import { GAME_TYPE, PLAYER_STATUS } from '@geco/shared';
import * as _ from 'lodash-es';
import {MatRadioChange} from "@angular/material/radio";


@Component({
	selector: 'app-contract-dialog',
	templateUrl: './contract-dialog.component.html',
	styleUrls: ['./contract-dialog.component.scss']
})
export class ContractDialogComponent {
    protected readonly DEBT = GAME_TYPE.DEBT;
    protected readonly JUNE = GAME_TYPE.JUNE;
    protected readonly ALIVE = PLAYER_STATUS.ALIVE;
	faFileSignature = faFileSignature;
	game: Game = new Game();
	idPlayer: Player | undefined;
	selectedCreditOption: any;
	amount = 3;
	interest = 1;

	constructor(public dialogRef: MatDialogRef<ContractDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
		this.game = data.game;
	}

	cancel() {
		this.dialogRef.close();
	}

	getAlivePlayer(): Player[] {
		return _.filter(this.game.players, p => p.status === this.ALIVE);
	}

	saveUserCredit() {
		this.dialogRef.close({
			idPlayer: this.idPlayer,
			amount: this.amount,
			interest: this.interest
		});
	}

	onCreditOptionChange($event: MatRadioChange) {
		switch($event.value){
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
}
