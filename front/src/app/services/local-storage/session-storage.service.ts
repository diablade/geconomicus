import {Injectable} from '@angular/core';
import {StorageKey} from "./storage-key.const";
import * as _ from 'lodash';

@Injectable({
  providedIn: 'root'
})
export class SessionStorageService {

  getItem(key:string) {
    // @ts-ignore
    return JSON.parse(sessionStorage.getItem(this.formatKey(key)));
  }

  setItem(key: string, value: any) {
    sessionStorage.setItem(this.formatKey(key), JSON.stringify(value));
  }

  removeItem(key: string) {
    sessionStorage.removeItem(this.formatKey(key));
  }

  removeAllItem() {
    _.forEach(StorageKey, (key) => {
      this.removeItem(key)
    });
  }

  private formatKey(key:string) {
    return StorageKey.prefixItem + key;
  }
}
