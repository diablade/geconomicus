import {Injectable} from '@angular/core';
import {LocalStorageService} from './local-storage/local-storage.service';
import {SessionStorageService} from './local-storage/session-storage.service';

@Injectable({
	providedIn: 'root'
})
export class ClearAppService {

	constructor(
		private localStorageService: LocalStorageService,
		private sessionStorageService: SessionStorageService) {
	}

	clearApp() {
		this.sessionStorageService.removeAllItem();
		this.localStorageService.removeAllItem();
	}
}
