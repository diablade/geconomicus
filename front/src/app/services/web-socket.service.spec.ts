import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';

import { WebSocketService } from './web-socket.service';

describe('WebSocketService', () => {
	let service: WebSocketService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [
				HttpClientTestingModule,
				MatDialogModule,
				MatSnackBarModule,
				NoopAnimationsModule,
				TranslateModule.forRoot(),
			],
		});
		service = TestBed.inject(WebSocketService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should report disconnected before any socket is initialized', () => {
		expect(service.isConnected()).toBe(false);
	});
});
