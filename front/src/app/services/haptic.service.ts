import { Injectable } from '@angular/core';

export type HapticTier = 'tick' | 'attention' | 'error' | 'alert';

export const HAPTIC_TIERS: HapticTier[] = ['tick', 'attention', 'error', 'alert'];

@Injectable({
	providedIn: 'root',
})
export class HapticService {
	hapticsEnabled = true;

	private readonly supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

	private readonly patterns: Record<HapticTier, number | number[]> = {
		tick: 13,
		attention: [0, 40, 50, 40],
		error: 240,
		alert: [0, 120, 60, 120, 60, 120, 60, 120, 60, 120, 60, 120, 60, 120],
	};

	private readonly keyTiers: Record<string, HapticTier> = {
		request: 'attention',
		nudge: 'attention',
		notif1: 'attention',
		notif2: 'attention',
		error: 'error',
		glitch: 'error',
		buzzer: 'alert',
		prison: 'alert',
		dead: 'alert',
		iamdeath: 'alert',
		interest: 'alert',
		police: 'alert',
		police2: 'alert',
		high_alarm: 'alert',
	};

	vibrateForKey(key: string): void {
		this.vibrate(this.keyTiers[key] ?? 'tick');
	}

	vibrate(tier: HapticTier): void {
		if (!this.hapticsEnabled || !this.supported) {
			return;
		}
		try {
			navigator.vibrate(this.patterns[tier]);
		} catch {
			return;
		}
	}
}
