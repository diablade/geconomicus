import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable, of } from 'rxjs';
import { Session } from '../../models/session';
import { environment } from '../../../environments/environment';
import { ERROR, ErrorService, REDIRECT_HOME } from '../error.service';
import { WebSocketService } from '../web-socket.service';
import { IO, ROOMS } from '@geco/shared';

@Injectable({
	providedIn: 'root',
})
export class SessionService {
	private sessionSubject = new BehaviorSubject<Session | null>(null);
	session$ = this.sessionSubject.asObservable();

	setSession(session: Session) {
		this.sessionSubject.next(session);
	}

	constructor(
		public http: HttpClient,
		private wsService: WebSocketService,
		private errorService: ErrorService
	) {}

    loadSession(sessionId: string): Observable<Session> {
        this.setupSocketListeners();
        this.initializeSocket(sessionId);
        return new Observable((observer: any) => {
            this.http
                .get<any>(environment.API_HOST + environment.SESSION.GET_BY_ID + sessionId)
                .pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.SESSION_NOT_FOUND')))
                .subscribe((data) => {
                            if (data) {
                                this.sessionSubject.next(data);
                                if (data.session) {
                                    this.sessionSubject.next(data.session);
                                }
                            } else {
                                this.sessionSubject.next(data);
                            }
                            observer.next({ success: true, data });
                            observer.complete();
                        });
                });
    }

	initializeSocket(sessionId: string): void {
        this.wsService.initializeSocket({
            publicChannel: ROOMS.session(sessionId),
			privateChannel: ROOMS.lobbyMaster(sessionId),
		});
	}

	private readonly onAvatarNew = (data: any) => {
		const currentSession = this.sessionSubject.getValue();
		const avatar = data?.avatar;
		if (!currentSession || !avatar) {
			return;
		}
		const known = currentSession.avatars.some((p) => p.idx === avatar.idx);
		currentSession.avatars = known
			? currentSession.avatars.map((p) => (p.idx === avatar.idx ? avatar : p))
			: [...currentSession.avatars, avatar];
		this.sessionSubject.next({ ...currentSession });
	};

	private readonly onAvatarUpdated = (data: any) => {
		const currentSession = this.sessionSubject.getValue();
		const updatedAvatar = data?.updatedAvatar;
		if (!currentSession || !updatedAvatar) {
			return;
		}
		currentSession.avatars = currentSession.avatars.map((p) => (p.idx === updatedAvatar.idx ? updatedAvatar : p));
		this.sessionSubject.next({ ...currentSession });
	};

	private readonly onAvatarDeleted = (data: any) => {
		const currentSession = this.sessionSubject.getValue();
		if (!currentSession) {
			return;
		}
		const deletedIdx = Number(data?.avatarIdx);
		currentSession.avatars = currentSession.avatars.filter((p) => Number(p.idx) !== deletedIdx);
		this.sessionSubject.next({ ...currentSession });
	};

	setupSocketListeners(): void {
		this.wsService.on(IO.AVATAR.NEW, this.onAvatarNew);
		this.wsService.on(IO.AVATAR.UPDATED, this.onAvatarUpdated);
		this.wsService.on(IO.AVATAR.DELETED, this.onAvatarDeleted);
	}


	getAll(): Observable<any> {
		return this.http
			.get<any>(environment.API_HOST + environment.SESSION.GET_ALL)
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.SESSION_NOT_FOUND')));
	}

	/** Plain fetch of one session (with populated gamesRules) — no socket setup. */
	getById(sessionId: string): Observable<Session> {
		return this.http
			.get<Session>(environment.API_HOST + environment.SESSION.GET_BY_ID + sessionId)
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.SESSION_NOT_FOUND')));
	}

	getByShortId(shortId: string): Observable<any> {
		return this.http
			.get<any>(environment.API_HOST + environment.SESSION.GET_BY_SHORT_ID + shortId)
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.SESSION_NOT_FOUND')));
	}

	lookupByShortId(shortId: string): Observable<any | null> {
		return this.http
			.get<any>(environment.API_HOST + environment.SESSION.GET_BY_SHORT_ID + shortId)
			.pipe(catchError(() => of(null)));
	}

	create(name: string, location: string, animator: string, theme: string): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.SESSION.CREATE, {
				name,
				location,
				animator,
				theme,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.CREATE')));
	}

	start(sessionId: string): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.SESSION.START, {
				sessionId,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.START')));
	}

	/** Puts a started session back to OPEN so new players can join again. */
	reopen(sessionId: string): Observable<any> {
		return new Observable((observer: any) => {
			this.http
				.post<any>(environment.API_HOST + environment.SESSION.REOPEN, { sessionId })
				.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.UPDATE')))
				.subscribe((data) => {
					let currentSession = this.sessionSubject.value;
					if (currentSession) {
						currentSession = { ...currentSession, ...data };
						this.sessionSubject.next(currentSession);
					}
					observer.next({ success: true, data });
					observer.complete();
				});
		});
	}

	update(sessionId: string, updates: Partial<Session>) {
        return new Observable((observer: any) => {
		this.http
			.put<any>(environment.API_HOST + environment.SESSION.UPDATE, {
				sessionId,
				updates,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.UPDATE')))
			.subscribe((data) => {
				let currentSession = this.sessionSubject.value;
				if (currentSession) {
					currentSession = { ...currentSession, ...data };
					this.sessionSubject.next(currentSession);
				}
				observer.next({ success: true, data });
				observer.complete();
			});
		});
	}

	delete(sessionId: string, password: string) {
		return this.http
			.post<any>(environment.API_HOST + environment.SESSION.DELETE, {
				sessionId,
				password,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.DELETE')));
	}

	join(sessionId: string, name: string): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.AVATAR.JOIN, {
				name,
				sessionId,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.CREATE')));
	}

	deleteAvatar(sessionId: string, avatarIdx: number): void {
		this.http
			.delete<any>(environment.API_HOST + environment.AVATAR.DELETE + '/' + sessionId + '/' + avatarIdx)
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.DELETE')))
			.subscribe(() => {
				// Avatar deleted successfully
				// TODO: Update session locally
				// this.session.avatars = this.session.avatars.filter((p: Avatar) => p.idx !== player.idx);
				// this.snackbarService.showSuccess(
				//     this.i18nService.instant('MASTER.DELETE_PLAYER_SUCCESS', { player: player.name })
				// );
			});
	}

	killGame(sessionId: string, gameStateId: string, ruleIdx: number): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.SESSION.KILL_GAME, { gameStateId, sessionId, ruleIdx })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.GAME_NOT_FOUND')));
	}

	allowRedoSurvey(sessionId: string, avatarIdx: number): Observable<void> {
		return this.http
			.post<void>(environment.API_HOST + environment.SURVEY.ALLOW_REDO_SURVEY, { sessionId, avatarIdx })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.ALLOW_REDO_SURVEY')));
	}
}
