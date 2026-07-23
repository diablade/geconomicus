import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CREDIT_STATUS } from '@geco/shared';
import { Credit } from '../../models/gameState';
import { Avatar } from '../../models/avatar';

/**
 * Compact inline rendering of one Credit in the table view's per-player credits column.
 * Owns the credit status -> colour/label mapping and the time-remaining progress math
 * (previously duplicated across table-board and app-credit).
 *
 * Two modes:
 *  - active  : pill with amount+interest, status label and a thin progress bar.
 *              Click opens the actions menu (Cancel / Seize when FAULT / Details).
 *  - closed  : greyed, icon-only. Click reveals the detail popover.
 */
@Component({
	selector: 'app-credit-chip',
	templateUrl: './credit-chip.component.html',
	styleUrls: ['./credit-chip.component.scss'],
})
export class CreditChipComponent implements OnChanges {
	protected readonly RUNNING = CREDIT_STATUS.RUNNING;
	protected readonly REQUESTING = CREDIT_STATUS.REQUESTING;
	protected readonly PAUSED = CREDIT_STATUS.PAUSED;
	protected readonly IDLE = CREDIT_STATUS.IDLE;
	protected readonly FAULT = CREDIT_STATUS.FAULT;
	protected readonly DONE = CREDIT_STATUS.DONE;
	protected readonly CANCELED = CREDIT_STATUS.CANCELED;

	@Input() credit!: Credit;
	@Input() duration = 0;
	@Input() contractor: Avatar | undefined;

	/** Emitted when the animator picks an action from the chip menu ('cancel' | 'seize'). */
	@Output() action = new EventEmitter<{ action: string; credit: Credit }>();

	progress = 0;

	ngOnChanges(): void {
		if (this.credit && this.credit.remainingTime > 0 && this.duration > 0) {
			const durationMs = this.duration * 60 * 1000;
			this.progress = ((durationMs - this.credit.remainingTime) / durationMs) * 100;
		} else {
			this.progress = 0;
		}
	}

	get isClosed(): boolean {
		return this.credit.status === this.DONE || this.credit.status === this.CANCELED;
	}

	get isFault(): boolean {
		return this.credit.status === this.FAULT;
	}

	statusClass(): string {
		switch (this.credit.status) {
			case this.RUNNING:
				return 'running';
			case this.REQUESTING:
				return 'requesting';
			case this.PAUSED:
			case this.IDLE:
				return 'paused';
			case this.FAULT:
				return 'fault';
			case this.CANCELED:
				return 'canceled';
			case this.DONE:
				return 'credit-done';
			default:
				return 'running';
		}
	}

	statusLabel(): string {
		switch (this.credit.status) {
			case this.RUNNING:
				return 'TABLE.CREDIT_RUNNING';
			case this.REQUESTING:
				return 'TABLE.CREDIT_REQUESTING';
			case this.PAUSED:
				return 'TABLE.CREDIT_PAUSED';
			case this.IDLE:
				return 'TABLE.CREDIT_IDLE';
			case this.FAULT:
				return 'TABLE.CREDIT_FAULT';
			case this.CANCELED:
				return 'TABLE.CREDIT_CANCELED';
			case this.DONE:
				return 'TABLE.CREDIT_DONE';
			default:
				return this.credit.status;
		}
	}

	progressColor(): string {
		if (this.progress < 50) {
			return '#28a745';
		} else if (this.progress < 75) {
			return '#ffc107';
		}
		return '#dc3545';
	}

	emit(action: string): void {
		this.action.emit({ action, credit: this.credit });
	}
}
