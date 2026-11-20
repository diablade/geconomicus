import { Directive, ElementRef, NgZone, OnDestroy, OnInit } from '@angular/core';
import { animate, hover, press } from 'motion';

@Directive({
	selector: '[data-pop]',
})
export class PopEffectDirective implements OnInit, OnDestroy {
	private stopListeners: (() => void)[] = [];

	constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

	/** Adds the Motion spring that grows the element on hover and squashes it on press. */
	ngOnInit(): void {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		const element = this.host.nativeElement;
		this.zone.runOutsideAngular(() => {
			this.stopListeners = [
				hover(element, () => {
					animate(element, { scale: 1.06 }, { type: 'spring', stiffness: 400, damping: 15 });
					return () => animate(element, { scale: 1 }, { type: 'spring', stiffness: 400, damping: 20 });
				}),
				press(element, () => {
					animate(element, { scale: 0.92 }, { type: 'spring', stiffness: 600, damping: 20 });
					return () => animate(element, { scale: 1 }, { type: 'spring', stiffness: 500, damping: 12 });
				}),
			];
		});
	}

	/** Removes the hover and press listeners. */
	ngOnDestroy(): void {
		this.stopListeners.forEach((stop) => stop());
	}
}
