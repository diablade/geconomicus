import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ERROR_RELOAD, ErrorService } from '../error.service';
import { Feedback } from '../../models/feedback';

/**
 * A stored survey answer (back/src/survey/survey.schema.js) =
 * Feedback dimensions + identification keys.
 */
export interface SurveyAnswer extends Feedback {
	_id: string;
	sessionId: string;
	gameStateId: string;
	avatarIdx: string;
	createdAt?: string;
}

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
			.post<any>(environment.API_HOST + environment.SURVEY.ADD_FEEDBACK, {
				sessionId,
				gameStateId,
				avatarIdx,
				...feedback,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.SEND_SURVEY')));
	}

	getPreviousFeedback(sessionId: string, gameStateId: string, avatarIdx: string) {
		return this.http
			.get<Feedback>(
				`${environment.API_HOST}${environment.SURVEY.GET_AVATAR_GAME_FEEDBACK}/${sessionId}/${gameStateId}/${avatarIdx}`
			)
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.GET_SURVEY')));
	}

	/**
	 * All answers of the session (both games) — results-compare fetches once
	 * and splits by gameStateId client-side.
	 * Back route (already existing): GET survey/session/:sessionId
	 * NOTE: surveyController.getBySessionId must return { data: SurveyAnswer[] }
	 * — TODO(back): confirm the response shape (align map() below otherwise).
	 */
	getBySessionId(sessionId: string): Observable<SurveyAnswer[]> {
		return this.http
			.get<{ data: SurveyAnswer[] }>(environment.API_HOST + environment.SURVEY.GET_BY_SESSION_ID + sessionId)
			.pipe(
				map((res) => (Array.isArray(res) ? (res as unknown as SurveyAnswer[]) : (res.data ?? []))),
				catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.GET_SURVEY'))
			);
	}

	getByGameStateId(gameStateId: string): Observable<SurveyAnswer[]> {
		return this.http
			.get<{ data: SurveyAnswer[] }>(environment.API_HOST + environment.SURVEY.GET_BY_GAME_STATE_ID + gameStateId)
			.pipe(
				map((res) => (Array.isArray(res) ? (res as unknown as SurveyAnswer[]) : (res.data ?? []))),
				catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.GET_SURVEY'))
			);
	}
}
