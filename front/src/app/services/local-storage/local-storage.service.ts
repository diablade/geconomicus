import { Injectable } from '@angular/core';
import { StorageKey } from './storage-key.const';
import * as _ from 'lodash';

@Injectable({
	providedIn: 'root',
})
export class LocalStorageService {
	getItem(key: string) {
		const item = localStorage.getItem(this.formatKey(key));
		if (!item) {
			return null;
		}
		return JSON.parse(item);
	}

	setItem(key: string, value: any) {
		localStorage.setItem(this.formatKey(key), JSON.stringify(value));
	}

	removeItem(key: string) {
		localStorage.removeItem(this.formatKey(key));
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
