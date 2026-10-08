import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { animations } from '../../services/animations';
import { AudioService } from '../../services/audio.service';
import createCountdown from '../../services/countDown';

@Component({
	selector: 'app-prison',
	templateUrl: './prison.component.html',
	styleUrls: ['./prison.component.scss'],
	animations,
})
export class PrisonComponent implements OnInit, OnDestroy {
	minutesPrison = 0;
	secondsPrison = 0;
	prisonProgress = 0;
	private prisonTotalMs = 0;
	private audioService = inject(AudioService);



	ngOnInit(): void {
		this.audioService.playSound('buzzer');
		this.audioService.playSound('prison');
	}

	@Input() set prison(value: { remainingTime: number; totalTime: number; paused?: boolean } | null) {
		if (value) {
			this.sync(value.remainingTime, value.totalTime, !!value.paused);
		} else {
			this.prisonTimer.stop();
		}
	}

	private prisonTimer = createCountdown(
		{ h: 0, m: 0, s: 0 },
		{
			listen: ({ s, h, m }) => {
				this.minutesPrison = m;
				this.secondsPrison = s;
				const remainingSec = h * 3600 + m * 60 + s;
				const totalSec = this.prisonTotalMs / 1000;
				this.prisonProgress = totalSec > 0 ? Math.max(0, Math.min(100, (remainingSec / totalSec) * 100)) : 0;
			},
			done: () => {
				this.minutesPrison = 0;
				this.secondsPrison = 0;
				this.prisonProgress = 0;
			},
		}
	);

	private sync(remainingTime: number, totalTime: number, paused: boolean): void {
		this.prisonTotalMs = totalTime || remainingTime;
		const remainingSec = Math.max(0, Math.round(remainingTime / 1000));
		this.prisonTimer.set({ h: 0, m: 0, s: remainingSec });
		this.prisonTimer.reset();
		if (!paused) {
			this.prisonTimer.start();
		}
	}

	ngOnDestroy(): void {
		this.prisonTimer.stop();
	}
}
