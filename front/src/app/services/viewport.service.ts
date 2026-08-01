import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ViewportService {
	private pendingFrame = 0;

	constructor() {
		this.publish();
		const schedulePublish = () => {
			cancelAnimationFrame(this.pendingFrame);
			this.pendingFrame = requestAnimationFrame(() => this.publish());
		};
		window.addEventListener('resize', schedulePublish);
		window.addEventListener('orientationchange', schedulePublish);
		window.visualViewport?.addEventListener('resize', schedulePublish);
		window.visualViewport?.addEventListener('scroll', schedulePublish);
	}

	private publish(): void {
		if (this.isTextEntryFocused()) return;
		const viewport = window.visualViewport;
		const width = viewport ? viewport.width : window.innerWidth;
		const height = viewport ? viewport.height : window.innerHeight;
		const rootStyle = document.documentElement.style;
		rootStyle.setProperty('--app-width', `${width}px`);
		rootStyle.setProperty('--app-height', `${height}px`);
	}

	private isTextEntryFocused(): boolean {
		const active = document.activeElement as HTMLElement | null;
		if (!active) return false;
		const tag = active.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable;
	}
}
