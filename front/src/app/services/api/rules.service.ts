import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable } from 'rxjs';
import { Session } from '../../models/session';
import { environment } from '../../../environments/environment';
import { ERROR, ErrorService } from '../error.service';
import { Rules } from '../../models/rules';

@Injectable({
	providedIn: 'root',
})
export class RulesService {
	constructor(
		public http: HttpClient,
		private errorService: ErrorService
	) {}

	update(sessionId: string, updates: Partial<Rules>) {
		return this.http
			.put<any>(environment.API_HOST + environment.RULES.UPDATE, {
				sessionId,
				ruleIdx: updates.idx,
				updates,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.UPDATE')));
	}

	resetDefault(sessionId: string, ruleIdx: number) {
		return this.http
			.put<any>(environment.API_HOST + environment.RULES.DEFAULT, {
				sessionId,
				ruleIdx,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.DEFAULT')));
	}
}
