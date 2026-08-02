import { Injectable, inject } from '@angular/core';
import { HapticService } from './haptic.service';

@Injectable({
	providedIn: 'root',
})
export class AudioService {
	private haptic = inject(HapticService);
	private sounds: { [key: string]: HTMLAudioElement } = {};

	preloadSound(key: string, path: string) {
		this.sounds[key] = new Audio(path);
		this.sounds[key].load();
	}

	playSound(key: string, haptic = true) {
		if (haptic) {
			this.haptic.vibrateForKey(key);
		}
		if (this.sounds[key]) {
			this.sounds[key].play().catch((e) => console.error(`Playback failed for ${key}:`, e));
			return;
		}
		this.preloadSound(key, './assets/audios/' + key + '.mp3');
		this.playSound(key, false);
	}

	playSequence(keys: string[]) {
		const [key, ...rest] = keys;
		if (!key) {
			return;
		}
		if (!this.sounds[key]) {
			this.preloadSound(key, './assets/audios/' + key + '.mp3');
		}
		const sound = this.sounds[key];
		sound.onended = () => {
			sound.onended = null;
			this.playSequence(rest);
		};
		sound.currentTime = 0;
		sound.play().catch((e) => {
			sound.onended = null;
			console.error(`Playback failed for ${key}:`, e);
			this.playSequence(rest);
		});
	}

	/** Play a sound on loop (e.g. the faulty-credit siren). Stop it with stopSound(key). */
	loopSound(key: string) {
		if (this.sounds[key]) {
			this.sounds[key].loop = true;
			this.sounds[key].currentTime = 0;
			this.sounds[key].play().catch((e) => console.error(`Playback failed for ${key}:`, e));
			return;
		}
		this.preloadSound(key, './assets/audios/' + key + '.mp3');
		this.loopSound(key);
	}

	stopSound(key: string) {
		const sound = this.sounds[key];
		if (sound) {
			sound.pause();
			sound.loop = false;
			sound.currentTime = 0;
		}
	}
}
