import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {

  private sounds: {[key: string]: HTMLAudioElement} = {};

  preloadSound(key: string, path: string) {
    this.sounds[key] = new Audio(path);
    this.sounds[key].load();
  }

  playSound(key: string) {
    if (this.sounds[key]) {
      this.sounds[key].play().catch(e => console.error(`Playback failed for ${key}:`, e));
      return;
    }
    this.preloadSound(key, "./assets/audios/" + key + ".mp3");
    this.playSound(key);
  }

  /** Play a sound on loop (e.g. the faulty-credit siren). Stop it with stopSound(key). */
  loopSound(key: string) {
    if (this.sounds[key]) {
      this.sounds[key].loop = true;
      this.sounds[key].currentTime = 0;
      this.sounds[key].play().catch(e => console.error(`Playback failed for ${key}:`, e));
      return;
    }
    this.preloadSound(key, "./assets/audios/" + key + ".mp3");
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
