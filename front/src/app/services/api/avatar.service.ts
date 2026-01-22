import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {catchError, Observable} from "rxjs";
import {Avatar} from "../../models/avatar";
import {environment} from "../../../environments/environment";
import {ERROR_RELOAD, ErrorService, REDIRECT_HOME} from "../error.service";

@Injectable({
	providedIn: 'root'
})
export class AvatarService {
	constructor(public http: HttpClient, private errorService: ErrorService) {
	}

	getAvatar(sessionId: string, avatarId: string): Observable<Avatar> {
		return this.http.get<any>(environment.API_HOST + environment.AVATAR.GET + sessionId + '/' + avatarId)
			.pipe(
				catchError(err => this.errorService.handleError(err, ERROR_RELOAD, "ERROR.PLAYER_NOT_FOUND"))
			);
	}

	join(sessionId: string, name: string): Observable<Avatar> {
		return this.http.post<any>(environment.API_HOST + environment.AVATAR.JOIN, {
			name,
			sessionId
		})
			.pipe(
				catchError(err => this.errorService.handleError(err, REDIRECT_HOME, 'ERROR.CREATE'))
			);
	}

	updateAvatar(sessionId: string, avatarId: string, updates: Partial<Avatar>): Observable<Avatar> {
		return this.http.post<any>(environment.API_HOST + environment.AVATAR.UPDATE, {
			avatarId,
			sessionId,
			updates
		})
			.pipe(
				catchError(err => this.errorService.handleError(err, ERROR_RELOAD, "ERROR.UPDATE"))
			);
	}

	deleteAvatar(avatarId: string, sessionId: string): Observable<any> {
		return this.http.delete<any>(environment.API_HOST + environment.AVATAR.DELETE, {
			body: {
				avatarId,
				sessionId
			}
		})
			.pipe(
				catchError(err => this.errorService.handleError(err, ERROR_RELOAD, "ERROR.DELETE"))
			);
	}
}
