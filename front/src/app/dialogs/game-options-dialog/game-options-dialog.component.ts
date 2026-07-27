import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GAME_TYPE, BANK_PROFILE, BankProfile, RATE_SCHEDULE_PRESETS } from '@geco/shared';
import { I18nService } from '../../services/i18n.service';
import { getActionIcon, Rules } from 'src/app/models/rules';

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
	protected readonly BANK_PROFILE = BANK_PROFILE;
	playersLength: any;
	devMode= false;

	constructor(
		private i18n: I18nService,
		public dialogRef: MatDialogRef<GameOptionsDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any
	) {
		this.i18n.loadNamespace('option');
		this.i18n.loadNamespace('action');
		this.rules = data.rules;
		// Older game rules predate the auto-bank schema — backfill so the editor binds safely.
		if (!this.rules.rateSchedule || this.rules.rateSchedule.length === 0) {
			this.rules.rateSchedule = RATE_SCHEDULE_PRESETS.normal.map((t) => ({ ...t }));
		}
		if (!this.rules.bankProfile) {
			this.rules.bankProfile = BANK_PROFILE.NORMAL;
		}
		this.playersLength = data.playersLength;
		this.devMode = data.devMode;
		//TODO return object should be only modified Partial rules, not all rules
	}

	getTranslate(key: string): string {
		return this.i18n.instant(key);
	}

	// Auto-bank: switching to a preset overwrites the schedule; custom leaves it editable.
	onProfileChange(profile: BankProfile) {
		this.rules.bankProfile = profile;
		if (profile === BANK_PROFILE.NORMAL) {
			this.rules.rateSchedule = RATE_SCHEDULE_PRESETS.normal.map((t) => ({ ...t }));
		} else if (profile === BANK_PROFILE.AGGRESSIVE) {
			this.rules.rateSchedule = RATE_SCHEDULE_PRESETS.aggressive.map((t) => ({ ...t }));
		}
	}

	addTier() {
		this.rules.rateSchedule = [
			...this.rules.rateSchedule,
			{
				threshold: 0,
				amount: this.rules.defaultCreditAmount,
				interest: this.rules.defaultInterestAmount,
				allowDouble: true,
			},
		];
	}

	removeTier(i: number) {
		this.rules.rateSchedule = this.rules.rateSchedule.filter((_, idx) => idx !== i);
	}

	getActionIcon = getActionIcon;
}
