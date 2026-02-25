import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, Observable } from 'rxjs';
import { Session } from '../../models/session';
import { environment } from '../../../environments/environment';
import { ERROR, ERROR_RELOAD, ErrorService, REDIRECT_HOME } from '../error.service';
import { Feedback } from '../../models/feedback';

@Injectable({
	providedIn: 'root',
})
export class SurveyService {
	constructor(
		public http: HttpClient,
		private errorService: ErrorService
	) {}

	sendFeedback(sessionId: string, gameStateId: string, avatarIdx: string, feedback: Feedback) {
		return this.http
			.post<any>(environment.API_HOST + environment.PLAYER.SURVEY, {
				sessionId,
				gameStateId,
				avatarIdx,
				feedback,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.SEND_SURVEY')));
	}
}
