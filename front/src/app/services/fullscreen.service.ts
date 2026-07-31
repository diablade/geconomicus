import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FullscreenService {
	get supported(): boolean {
		const element = document.documentElement as any;
		return !!(
			element.requestFullscreen ||
			element.webkitRequestFullscreen ||
			element.mozRequestFullScreen ||
			element.msRequestFullscreen
		);
	}

	get active(): boolean {
		const doc = document as any;
		return !!(
			doc.fullscreenElement ||
			doc.webkitFullscreenElement ||
			doc.mozFullScreenElement ||
			doc.msFullscreenElement
		);
	}

	toggle(): void {
		if (this.active) {
			this.exit();
		} else {
			this.enter();
		}
	}

	private enter(): void {
		const element = document.documentElement as any;
		const request =
			element.requestFullscreen ||
			element.webkitRequestFullscreen ||
			element.mozRequestFullScreen ||
			element.msRequestFullscreen;
		request?.call(element);
	}

	private exit(): void {
		const doc = document as any;
		const cancel = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
		cancel?.call(doc);
	}
}
