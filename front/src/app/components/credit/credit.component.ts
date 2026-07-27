import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { faCircleInfo, faCommentsDollar, faSackDollar } from '@fortawesome/free-solid-svg-icons';
import { Credit } from '../../models/gameState';
import { CREDIT_STATUS } from '@geco/shared';
import { Avatar } from 'src/app/models/avatar';

/** Below this remaining time a RUNNING credit's label becomes a per-second countdown. */
const FINAL_MS = 60_000;

@Component({
	selector: 'app-credit',
	templateUrl: './credit.component.html',
	styleUrls: ['./credit.component.scss'],
})
export class CreditComponent implements OnChanges, OnDestroy {
	protected readonly CREDIT_IDLE = CREDIT_STATUS.IDLE;
	protected readonly CREDIT_DONE = CREDIT_STATUS.DONE;
	protected readonly CREDIT_PAUSED = CREDIT_STATUS.PAUSED;
	protected readonly DEFAULT_CREDIT = CREDIT_STATUS.FAULT;
	protected readonly REQUEST_CREDIT = CREDIT_STATUS.REQUESTING;
	protected readonly RUNNING_CREDIT = CREDIT_STATUS.RUNNING;
	protected readonly CREDIT_CANCELED = CREDIT_STATUS.CANCELED;
	faSackDollar = faSackDollar;
	faCommentsDollar = faCommentsDollar;
	faCircleInfo = faCircleInfo;

	/** Seconds shown in the final-minute countdown label; null outside the final minute. */
	countdownSeconds: number | null = null;
	/** Flipped each tick to restart the label's pulse animation. */
	pulseToggle = false;
	private ticker: ReturnType<typeof setInterval> | undefined;

	@Input() credit!: Credit;
	@Input() contractor: Avatar | undefined = new Avatar();

	@Input() duration = 0;
	@Input() bankOption = false;
	@Input() small = false;
	/** When true, suppress every action button — used by the credit-chip detail popover. */
	@Input() readOnly = false;
	@Output() actionBtn = new EventEmitter<string>();

	ngOnChanges() {
		this.syncCountdown();
	}

	ngOnDestroy() {
		this.stopTicker();
	}

	get progress(): number {
		if (this.credit?.remainingTime > 0 && this.duration > 0) {
			const durationMs = this.duration * 60 * 1000;
			return ((durationMs - this.credit.remainingTime) / durationMs) * 100;
		}
		return 0;
	}

	get inFinalMinute(): boolean {
		return (
			this.credit?.status === this.RUNNING_CREDIT &&
			this.credit.remainingTime > 0 &&
			this.credit.remainingTime <= FINAL_MS
		);
	}

	private syncCountdown() {
		if (this.inFinalMinute) {
			this.countdownSeconds = Math.min(60, Math.ceil(this.credit.remainingTime / 1000));
			this.startTicker();
		} else {
			this.stopTicker();
			this.countdownSeconds = null;
		}
	}

	private startTicker() {
		if (this.ticker) return;
		this.ticker = setInterval(() => {
			if (!this.inFinalMinute || this.countdownSeconds == null || this.countdownSeconds <= 0) {
				this.stopTicker();
				return;
			}
			this.countdownSeconds--;
			this.pulseToggle = !this.pulseToggle; // swap keyframe → restart the pulse
		}, 1000);
	}

	private stopTicker() {
		if (this.ticker) {
			clearInterval(this.ticker);
			this.ticker = undefined;
		}
	}

	actionBtnClick(action: string) {
		this.actionBtn.emit(action);
	}

	getStatus(status: string) {
		switch (status) {
			case this.CREDIT_IDLE:
				return 'CREDIT.IDLE';
			case this.CREDIT_PAUSED:
				return 'CREDIT.PAUSED';
			case this.CREDIT_CANCELED:
				return 'CREDIT.CANCELED';
			case this.RUNNING_CREDIT:
				return 'CREDIT.RUNNING';
			case this.REQUEST_CREDIT:
				return 'CREDIT.REQUEST';
			case this.DEFAULT_CREDIT:
				return 'CREDIT.DEFAULT';
			case this.CREDIT_DONE:
				return 'CREDIT.DONE';
			default:
				return 'error';
		}
	}

	getStatusColor(progress: number) {
		if (progress < 50) {
			return '#28a745';
		} else if (progress < 75) {
			return '#ffc107';
		} else {
			return '#dc3545';
		}
	}
}
