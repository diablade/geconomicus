import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { faFileSignature } from '@fortawesome/free-solid-svg-icons';
import { CREDIT_QUESTION_ANSWER, GAME_TYPE, PLAYER_STATUS } from '@geco/shared';
import { MatRadioChange } from '@angular/material/radio';
import { Rules } from 'src/app/models/rules';
import { Observable } from 'rxjs';
import { BankService } from 'src/app/services/api/bank.service';
import { AudioService } from 'src/app/services/audio.service';

export type ContractDialogMode = 'contract' | 'request' | 'first-question';

@Component({
	selector: 'app-contract-dialog',
	templateUrl: './contract-dialog.component.html',
	styleUrls: ['./contract-dialog.component.scss'],
})
export class ContractDialogComponent {
	protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly ALIVE = PLAYER_STATUS.ALIVE;
	protected readonly ANSWER = CREDIT_QUESTION_ANSWER;
	faFileSignature = faFileSignature;
	rules: Rules = new Rules();
	players: Observable<any[]>;
	mode: ContractDialogMode = 'contract';
	selectedCreditOption = 'basic';
	selectedPlayerIdx = -1;
	selectedPlayer: any;
	/** When launched from a player row the target is fixed: hide the picker. */
	locked = false;
	amount = 3;
	interest = 1;
	maxAmount = 10;
	maxInterest = 5;
	rate: { amount: number; interest: number; allowDouble: boolean } | null = null;
	/** Informational solvency snapshot of the selected player (coins + card value vs debts). */
	solvency: { wealth: number; obligation: number; headroom: number; solvent: boolean } | null = null;

	constructor(
		public dialogRef: MatDialogRef<ContractDialogComponent>,
		private bankService: BankService,
		private audioService: AudioService,
		@Inject(MAT_DIALOG_DATA)
		public data: {
			rules: Observable<Rules>;
			players: Observable<any[]>;
			player?: any;
			gameStateId?: string;
			mode?: ContractDialogMode;
			playerStateIdx?: number;
		}
	) {
		this.mode = data.mode || 'contract';
		data.rules.subscribe((rules) => {
			this.rules = rules;
			this.applyRate(this.rate ?? this.baseRateFromRules());
		});
		this.players = data.players;
		if (data.player) {
			this.selectedPlayer = data.player;
			this.locked = true;
		}
		const idx = data.player?.idx ?? data.playerStateIdx;
		if (idx != null && idx >= 0) this.fetchRateAndSolvency(idx);
		if (this.mode === 'first-question') this.audioService.playSound('request');
	}

	get isAnimator(): boolean {
		return this.mode === 'contract';
	}

	get allowDouble(): boolean {
		return this.rate ? this.rate.allowDouble : true;
	}

	get singleAmount(): number {
		return this.rate?.amount ?? this.rules.defaultCreditAmount;
	}

	get singleInterest(): number {
		return this.rate?.interest ?? this.rules.defaultInterestAmount;
	}

	private baseRateFromRules() {
		return {
			amount: this.rules.defaultCreditAmount,
			interest: this.rules.defaultInterestAmount,
			allowDouble: true,
		};
	}

	private applyRate(rate: { amount: number; interest: number; allowDouble: boolean }) {
		this.rate = rate;
		if (!rate.allowDouble && this.selectedCreditOption === 'double') {
			this.selectedCreditOption = 'basic';
		}
		if (this.selectedCreditOption === 'manual') return;
		const double = this.selectedCreditOption === 'double';
		this.amount = double ? rate.amount * 2 : rate.amount;
		this.interest = double ? rate.interest * 2 : rate.interest;
	}

	fetchRateAndSolvency(playerStateIdx: number) {
		this.solvency = null;
		if (!this.data.gameStateId || playerStateIdx == null || playerStateIdx < 0) return;
		this.bankService.getRate(this.data.gameStateId, playerStateIdx).subscribe((res: any) => {
			this.solvency = res?.data?.solvency ?? null;
			const rate = res?.data?.rate;
			if (rate) this.applyRate(rate);
		});
	}

	onPlayerChange(player: any) {
		this.selectedPlayer = player;
		this.fetchRateAndSolvency(player?.idx);
	}

	cancel() {
		this.dialogRef.close();
	}

	decline() {
		this.dialogRef.close({ answer: this.ANSWER.DECLINE });
	}

	saveUserCredit() {
		if (this.mode === 'first-question') {
			this.dialogRef.close({
				answer:
					this.selectedCreditOption === 'double' ? this.ANSWER.ACCEPT_DOUBLE : this.ANSWER.ACCEPT_SINGLE,
			});
			return;
		}
		this.dialogRef.close({
			playerName: this.selectedPlayer?.avatar?.name,
			playerIdx: this.selectedPlayer?.idx ?? this.data.playerStateIdx ?? -1,
			amount: this.amount,
			interest: this.interest,
		});
	}

	onCreditOptionChange($event: MatRadioChange) {
		const rate = this.rate ?? this.baseRateFromRules();
		switch ($event.value) {
			case 'basic':
				this.amount = rate.amount;
				this.interest = rate.interest;
				break;
			case 'double':
				this.amount = rate.amount * 2;
				this.interest = rate.interest * 2;
				break;
			default:
				break;
		}
	}

	compareById(a: any, b: any): boolean {
		return a?.idx === b?.idx;
	}
}
