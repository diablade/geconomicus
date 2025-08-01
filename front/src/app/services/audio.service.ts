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

    }else{
      this.preloadSound(key, "./assets/audios/" + key + ".mp3");
      this.playSound(key);
    }
  }
}
