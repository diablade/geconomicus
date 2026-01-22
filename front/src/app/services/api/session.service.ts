import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {catchError, Observable} from "rxjs";
import {Session} from "../../models/session";
import {environment} from "../../../environments/environment";
import {ERROR, ErrorService, REDIRECT_HOME} from "../error.service";

@Injectable({
	providedIn: 'root'
})
export class SessionService {
	constructor(public http: HttpClient, private errorService: ErrorService) {
	}

	getAll(): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.SESSION.GET_ALL)
			.pipe(
				catchError(err => this.errorService.handleError(err, ERROR, 'ERROR.SESSION_NOT_FOUND'))
			);
	}

	getById(sessionId: string): Observable<Session> {
		return this.http.get<any>(environment.API_HOST + environment.SESSION.GET_BY_ID + sessionId)
			.pipe(
				catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.SESSION_NOT_FOUND'))
			);
	}

	getByShortId(shortId: string): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.SESSION.GET_BY_SHORT_ID + shortId)
			.pipe(
				catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.SESSION_NOT_FOUND'))
			);
	}

	create(name: string, location: string, animator: string, theme: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.SESSION.CREATE, {
			name,
			location,
			animator,
			theme,
		})
			.pipe(
				catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.CREATE'))
			);
	}

	update(sessionId: string, updates: Partial<Session>) {
		return this.http.post<any>(environment.API_HOST + environment.SESSION.UPDATE, {
			sessionId,
			updates
		})
			.pipe(
				catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.UPDATE'))
			);
	}

	delete(idSession: string, password: string) {
		return this.http.post<any>(environment.API_HOST + environment.SESSION.DELETE, {
			idSession, password
		}).pipe(
			catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.DELETE'))
		)
	}
}
