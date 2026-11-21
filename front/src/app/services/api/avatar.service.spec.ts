import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { ASSIST_MODE } from '@geco/shared';

import { AvatarService } from './avatar.service';
import { WebSocketService } from '../web-socket.service';
import { ThemesService } from '../themes.service';
import { LocalStorageService } from '../local-storage/local-storage.service';
import { environment } from '../../../environments/environment';

describe('AvatarService', () => {
	let service: AvatarService;
	let http: HttpTestingController;
	let storage: LocalStorageService;
	const avatar = { idx: 2, name: 'Alice', image: '<svg></svg>', hairColor: 'ac6511' };
	const url = environment.API_HOST + environment.AVATAR.GET + 'sess1/2/true';

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [HttpClientTestingModule, MatDialogModule, MatSnackBarModule, TranslateModule.forRoot()],
			providers: [
				{ provide: WebSocketService, useValue: jasmine.createSpyObj('WebSocketService', ['initializeSocket', 'on']) },
				{ provide: ThemesService, useValue: { loadTheme: () => Promise.resolve() } },
			],
		});
		service = TestBed.inject(AvatarService);
		http = TestBed.inject(HttpTestingController);
		storage = TestBed.inject(LocalStorageService);
		storage.removeItem('session');
	});

	afterEach(() => storage.removeItem('session'));

	it('should remember the seat so the home page can offer to resume it', fakeAsync(() => {
		service.loadAvatar('sess1', 2, true).subscribe();
		http.expectOne(url).flush({ avatar, session: { name: 'Atelier', theme: 'default' } });
		flushMicrotasks();

		expect(storage.getItem('session')).toEqual({ sessionId: 'sess1', avatarIdx: 2, name: 'Atelier', player: avatar });
	}));

	it("should not remember the seat for an animator's assist tab", fakeAsync(() => {
		service.loadAvatar('sess1', 2, true, ASSIST_MODE.COEXIST).subscribe();
		http.expectOne(url).flush({ avatar, session: { name: 'Atelier', theme: 'default' } });
		flushMicrotasks();

		expect(storage.getItem('session')).toBeNull();
	}));
});
