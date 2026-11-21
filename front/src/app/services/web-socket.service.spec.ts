import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { WebSocketService } from './web-socket.service';
import { SnackbarService } from './snackbar.service';
import { LocalStorageService } from './local-storage/local-storage.service';

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

	it('should not reload after a short disconnection, even long after the socket connected', () => {
		const handlers: Record<string, (...args: any[]) => void> = {};
		const fakeSocket = {
			connected: true,
			on: (event: string, handler: any) => (handlers[event] = handler),
			io: { on: (event: string, handler: any) => (handlers['io:' + event] = handler) },
			emit: () => {},
			connect: () => {},
		};
		TestBed.inject(LocalStorageService).setItem('lastSocketConnected', (Date.now() - 60000).toString());
		spyOn(service.dialog, 'open').and.returnValue({ afterClosed: () => of(undefined) } as any);
		const showNotif = spyOn(TestBed.inject(SnackbarService), 'showNotif');
		(service as any).socket = fakeSocket;
		(service as any).setupConnectionListeners();

		handlers['disconnect']('transport close');
		handlers['io:reconnect'](1);

		expect(showNotif).toHaveBeenCalledTimes(1);
	});
});
