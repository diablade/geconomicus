import { Injectable } from '@angular/core';
import { StorageKey } from './storage-key.const';
import * as _ from 'lodash';

@Injectable({
	providedIn: 'root',
})
export class SessionStorageService {
	getItem(key: string) {
		const item = sessionStorage.getItem(this.formatKey(key));
		if (!item) {
			return null;
		}
		return JSON.parse(item);
	}

	setItem(key: string, value: any) {
		sessionStorage.setItem(this.formatKey(key), JSON.stringify(value));
	}

	removeItem(key: string) {
		sessionStorage.removeItem(this.formatKey(key));
	}

	removeAllItem() {
		_.forEach(StorageKey, (key) => {
			this.removeItem(key);
		});
	}

	private formatKey(key: string) {
		return StorageKey.prefixItem + key;
	}
}
