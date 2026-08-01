import { Component, EventEmitter, Input, OnDestroy, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { AudioService } from '../../services/audio.service';

export interface OverlayPhase {
	icon: string;
	title?: string;
	text?: string;
	durationMs?: number;
	bg?: string;
	sound?: string;
	wheel?: boolean;
	dismissable?: boolean;
	button?: { labelKey: string };
}

export interface OverlayConfig {
	phases: OverlayPhase[];
	loop?: boolean;
}

@Component({
	selector: 'app-overlay',
	templateUrl: './overlay.component.html',
	styleUrls: ['./overlay.component.scss'],
})
export class OverlayComponent implements OnChanges, OnDestroy {
	@Input() config: OverlayConfig | null = null;
	@Output() done = new EventEmitter<void>();
	@Output() action = new EventEmitter<number>();

	private audioService = inject(AudioService);
	index = 0;
	private timer: any = null;

	get phase(): OverlayPhase | null {
		return this.config?.phases?.[this.index] ?? null;
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['config']) {
			this.restart();
		}
	}

	ngOnDestroy(): void {
		this.clearTimer();
	}

	private restart(): void {
		this.clearTimer();
		this.index = 0;
		if (this.config?.phases?.length) {
			this.enterPhase();
		}
	}

	private enterPhase(): void {
		const phase = this.phase;
		if (!phase) return;
		if (phase.sound) this.audioService.playSound(phase.sound);
		if (this.config?.loop) return;
		if (phase.durationMs && phase.durationMs > 0) {
			this.timer = setTimeout(() => this.advance(), phase.durationMs);
		}
	}

	private advance(): void {
		this.clearTimer();
		if (!this.config) return;
		if (this.index < this.config.phases.length - 1) {
			this.index++;
			this.enterPhase();
		} else {
			this.done.emit();
		}
	}

	onOverlayClick(): void {
		if (this.phase?.dismissable) this.advance();
	}

	onButton(event: Event): void {
		event.stopPropagation();
		this.action.emit(this.index);
	}

	trackByIndex = (): number => this.index;

	private clearTimer(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}
}
