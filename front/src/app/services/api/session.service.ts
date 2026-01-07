import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { catchError, Observable } from "rxjs";
import { Session } from "../../models/session";
import { environment } from "../../../environments/environment";
import { ErrorService, REDIRECT_HOME } from "../error.service";

@Injectable({
	providedIn: 'root'
})
export class SessionService {
	httpOptions = {
		headers: new HttpHeaders({
			'Content-Type': 'application/json'
		})
	};

	constructor(public http: HttpClient, private errorService: ErrorService) { }

	getAllSessions(): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.SESSION.GET_ALL)
			.pipe(
				catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.SESSION_NOT_FOUND'))
			);
	}

	getSessionById(sessionId: string): Observable<Session> {
		return this.http.get<any>(environment.API_HOST + environment.SESSION.GET_BY_ID + sessionId)
			.pipe(
				catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.SESSION_NOT_FOUND'))
			);
	}

	getSessionByShortId(shortId: string): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.SESSION.GET_BY_SHORT_ID + shortId)
			.pipe(
				catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.SESSION_NOT_FOUND'))
			);
	}

	createSession(gameName: string, location: string, animator: string, theme: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.SESSION.CREATE, {
			gameName,
			location,
			animator,
			theme,
		})
			.pipe(
				catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.CREATE'))
			);
	}

	updateSession(sessionId: string, updates: Partial<Session>) {
		return this.http.post<any>(environment.API_HOST + environment.SESSION.UPDATE, {
			sessionId,
			updates
		})
			.pipe(
				catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.UPDATE'))
			);
	}

	deleteSession(idSession: string, password: string) {
		return this.http.post<any>(environment.API_HOST + environment.SESSION.DELETE, {
			idSession, password
		}).pipe(
			catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.DELETE'))
		)
	}
}
