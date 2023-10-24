import {Injectable} from '@angular/core';
import {StorageKey} from './storage-key.const';
import * as _ from 'lodash';
import {BehaviorSubject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {

  constructor() {
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
