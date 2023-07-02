import {Injectable} from '@angular/core';
import {StorageKey} from './storage-key.const';
import * as _ from 'lodash';
import {BehaviorSubject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  // Observable source
  private _timerRemaining = new BehaviorSubject<any>(this.getTimerRemaining());
  // Observable stream
  timerRemaining = this._timerRemaining.asObservable();

  constructor() {
  }

  getTimerRemaining() {
    return this.getItem("timerRemaining");
  }
  setTimerRemaining(timer: number) {
    this.setItem("timerRemaining", timer);
    this._timerRemaining.next(this.getTimerRemaining());
  }

  removeRemaining() {
    this.removeItem("timerRemaining");
  }

  getItem(key: string) {
    // @ts-ignore
    return JSON.parse(localStorage.getItem(this.formatKey(key)));
  }

  setItem(key: string, value: any) {
    localStorage.setItem(this.formatKey(key), JSON.stringify(value));
  }

  removeItem(key: string) {
    localStorage.removeItem(this.formatKey(key));
  }

  removeAllItem() {
    _.forEach(StorageKey, (key) => {
      this.removeItem(key)
    });
  }

  private formatKey(key: string) {
    return StorageKey.prefixItem + key;
  }
}
