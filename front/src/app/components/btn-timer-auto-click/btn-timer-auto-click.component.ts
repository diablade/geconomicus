import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';

@Component({
	selector: 'button-timer',
	templateUrl: './btn-timer-auto-click.component.html',
	styleUrls: ['./btn-timer-auto-click.component.scss']
})
export class BtnTimerAutoClickComponent implements OnInit, OnDestroy {
	@Input() label = "X";
	@Input() secondsTimer = 5;
	// timeLeft: number = 5;
	progress = 0;
	timer: any;
	@Output() timerEnd = new EventEmitter<any>();

	ngOnInit() {
		this.startTimer();
	}

	// Called when user manually clicks
	click() {
		this.stopTimer();
		this.timerEnd.emit(this.label);
	}

	// Helper method to stop the timer
	private stopTimer() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	startTimer() {
		// Clear any existing timer before starting a new one
		this.stopTimer();

		this.progress = 0;
		const interval = 100; // milliseconds
		const totalSeconds = this.secondsTimer;

		if (totalSeconds > 0) {
			const totalIterations = (totalSeconds * 1000) / interval;
			let iteration = 0;

			// Store the timer ID returned by setInterval
			this.timer = setInterval(() => {
				iteration++;
				this.progress = (iteration / totalIterations) * 100;

				if (iteration >= totalIterations) {
					this.stopTimer();
					this.timerEnd.emit(this.label);
				}
			}, interval);
		}
	}

	ngOnDestroy() {
		this.timer = null;
	}
}
