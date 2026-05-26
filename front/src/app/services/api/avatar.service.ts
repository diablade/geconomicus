import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { Avatar } from '../../models/avatar';
import { Session } from '../../models/session';
import { environment } from '../../../environments/environment';
import { ERROR, ERROR_RELOAD, ErrorService } from '../error.service';
import { WebSocketService } from '../web-socket.service';
import { ThemesService } from '../themes.service';
import { IO, ROOMS } from '@geco/shared';

@Injectable({
	providedIn: 'root',
})
export class AvatarService {
	private avatarSubject = new BehaviorSubject<Avatar | undefined>(undefined);
	avatar$ = this.avatarSubject.asObservable();
	private sessionSubject = new BehaviorSubject<Session | null>(null);
	session$ = this.sessionSubject.asObservable();
	private sessionId: string | undefined;
	private avatarIdx: number | undefined;

	constructor(
		public http: HttpClient,
		private errorService: ErrorService,
		private wsService: WebSocketService,
		private themesService: ThemesService
	) {}

	loadAvatar(sessionId: string, avatarIdx: number, fetchSession = false): Observable<any> {
		return new Observable((observer: any) => {
			this.http
				.get<any>(environment.API_HOST + environment.AVATAR.GET + sessionId + '/' + avatarIdx + '/' + fetchSession)
				.pipe(catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.PLAYER_NOT_FOUND')))
				.subscribe((data) => {
					if (fetchSession && data.avatar) {
                        this.themesService.loadTheme(data.session.theme);
						this.avatarSubject.next(data.avatar);
						if (data.session) {
							this.sessionSubject.next(data.session);
						}
					} else {
						this.avatarSubject.next(data);
					}
					observer.next({ success: true, data: fetchSession ? data.avatar : data });
					observer.complete();
				});
			if (sessionId !== this.sessionId || avatarIdx !== this.avatarIdx) {
				this.initializeSocket(sessionId, avatarIdx);
			}
		});
	}

	initializeSocket(sessionId: string, avatarIdx: number): void {
		this.sessionId = sessionId;
		this.avatarIdx = avatarIdx;
		this.wsService.initializeSocket({
			publicChannel: ROOMS.session(sessionId),
			privateChannel: ROOMS.lobbyAvatar(sessionId, avatarIdx),
		});
		this.setupSocketListeners();
	}

	private setupSocketListeners(): void {
		// Avatar events
		this.wsService.on(IO.AVATAR.UPDATED, (data: any) => {
			if (data.idx == this.avatarIdx) {
				this.avatarSubject.next(data);
			}
		});

		// Session events
		this.wsService.on(IO.SESSION.STARTED, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', avatarIdx: this.avatarIdx, _ackId: data._ackId });
			const currentSession = this.sessionSubject.getValue();
			if (currentSession) {
				this.sessionSubject.next({
					...currentSession,
					gamesRules: data.gamesRules,
				});
			}
		});

		this.wsService.on(IO.SESSION.UPDATED, (data: any) => {
			const currentSession = this.sessionSubject.getValue();
			if (currentSession) {
				this.sessionSubject.next({
					...currentSession,
					...data,
				});
			}
		});

		// Game events
		this.wsService.on(IO.GAME.DELETED, (data: any) => {
			const currentSession = this.sessionSubject.getValue();
			if (currentSession) {
				this.sessionSubject.next({
					...currentSession,
					gamesRules: currentSession.gamesRules.map((rules: any) => {
						if (rules.gameStateId === data.gameStateId) {
							rules.gameStatus = data.gameStatus;
							rules.gameStateId = "";
						}
						return rules;
					}),
				});
			}
		});

		this.wsService.on(IO.GAME.CREATED, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', avatarIdx: this.avatarIdx, _ackId: data._ackId });
			const currentSession = this.sessionSubject.getValue();
			if (currentSession) {
				this.sessionSubject.next({
					...currentSession,
					gamesRules: currentSession.gamesRules.map((rules: any) => {
						if (rules.idx === data.idx) {
							rules.gameStateId = data.gameStateId;
							rules.typeMoney = data.typeMoney;
							rules.gameStatus = data.gameStatus;
						}
						return rules;
					}),
				});
			}
		});

		this.wsService.on(IO.REFRESH_FORCE, async (data: any) => {
			window.location.reload();
		});
	}


	updateAvatar(
		sessionId: string,
		avatarIdx: number,
		updates: Partial<Avatar>,
		sendRefresh = false
	): Observable<any> {
		return new Observable((observer: any) => {
			try {
				this.http
					.put<any>(environment.API_HOST + environment.AVATAR.UPDATE, {
						sessionId,
						avatarIdx,
						updates,
						sendRefresh,
					})
					.pipe(catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.UPDATE')))
					.subscribe((updatedAvatar) => {
						this.avatarSubject.next(updatedAvatar);
						if (sendRefresh) {
							this.refreshForceAvatar(sessionId, avatarIdx);
						}
						observer.next({ success: true, data: updatedAvatar });
						observer.complete();
					});
			} catch (e) {
				observer.next({ success: false, error: 'parse_error' });
				observer.complete();
			}
		});
	}

	getCurrentPlayerStateIdx(sessionId: string, gameStateId: string, avatarIdx: number): Observable<any> {
		return this.http
			.get<any>(
				environment.API_HOST +
					environment.PLAYER_STATE.GET_PLAYER_CURRENT_STATE_IDX +
					sessionId +
					'/' +
					gameStateId +
					'/' +
					avatarIdx
			)
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.PLAYER_NOT_FOUND')));
	}

	refreshForceAvatar(sessionId: string, avatarIdx: number): void {
		this.http
			.post<any>(environment.API_HOST + environment.AVATAR.REFRESH, {
				sessionId,
				avatarIdx,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.REFRESH')))
			.subscribe(() => {
				// Refresh is successful, no need to update avatar subject
				// The actual avatar update will come through WebSocket events
			});
	}

}
