import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { faFileSignature } from '@fortawesome/free-solid-svg-icons';
import { GAME_TYPE, PLAYER_STATUS } from '@geco/shared';
import { MatRadioChange } from '@angular/material/radio';
import { Rules } from 'src/app/models/rules';
import { Observable } from 'rxjs';
import { BankService } from 'src/app/services/api/bank.service';

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
	/** When launched from a player row the target is fixed: hide the picker. */
	locked = false;
	amount = 3;
	interest = 1;
	maxAmount = 10;
	maxInterest = 5;
	/** Informational solvency snapshot of the selected player (coins + card value vs debts). */
	solvency: { wealth: number; obligation: number; headroom: number; solvent: boolean } | null = null;

	constructor(
		public dialogRef: MatDialogRef<ContractDialogComponent>,
		private bankService: BankService,
		@Inject(MAT_DIALOG_DATA)
		public data: { rules: Observable<Rules>; players: Observable<any[]>; player?: any; gameStateId?: string }
	) {
		data.rules.subscribe((rules) => {
			this.rules = rules;
		});
		this.players = data.players;
		if (data.player) {
			this.selectedPlayer = data.player;
			this.locked = true;
			this.fetchSolvency(data.player);
		}
	}

	/** Fetch the target's live solvency (server-authoritative: coins + cards vs outstanding debts). */
	fetchSolvency(player: any) {
		this.solvency = null;
		const idx = player?.idx;
		if (!this.data.gameStateId || idx == null || idx < 0) return;
		this.bankService.getRate(this.data.gameStateId, idx).subscribe((res: any) => {
			this.solvency = res?.data?.solvency ?? null;
		});
	}

	onPlayerChange(player: any) {
		this.selectedPlayer = player;
		this.fetchSolvency(player);
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
