import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ERROR_RELOAD, ErrorService } from '../error.service';
import { GecoEventV2 } from '../../models/geco-event';

/**
 * ─── EventService (front) ────────────────────────────────────────────────────
 * Fetches the raw, time-ordered event stream. ALL filtering (game / type /
 * emitter / receiver) is done client-side — see models/geco-event.ts.
 *
 * Back endpoints (already existing in back/src/event/event.routes.js):
 *   GET events/session/:sessionId   → { data: GecoEventV2[] }  (sorted by at asc)
 *   GET events/game/:gameStateId    → { count, data: GecoEventV2[] }
 *
 * TODO(front/env): add to environment*.ts:
 *   EVENT: {
 *       GET_BY_SESSION_ID: 'events/session/',
 *       GET_BY_GAME_STATE_ID: 'events/game/',
 *   },
 * TODO(back): verify the router mount path in back/src/app.js is 'events/'
 * (align the env value with whatever prefix app.js uses).
 */
@Injectable({
	providedIn: 'root',
})
export class EventService {
	constructor(
		public http: HttpClient,
		private errorService: ErrorService
	) {}

	/** Whole session (both games) — the results-compare view uses this one. */
	getBySessionId(sessionId: string): Observable<GecoEventV2[]> {
		return this.http
			.get<{ data: GecoEventV2[] }>(environment.API_HOST + environment.EVENT.GET_BY_SESSION_ID + sessionId)
			.pipe(
				map((res) => res.data ?? []),
				catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.GET_EVENTS'))
			);
	}

	getByGameStateId(gameStateId: string): Observable<GecoEventV2[]> {
		return this.http
			.get<{ count: number; data: GecoEventV2[] }>(
				environment.API_HOST + environment.EVENT.GET_BY_GAME_STATE_ID + gameStateId
			)
			.pipe(
				map((res) => res.data ?? []),
				catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.GET_EVENTS'))
			);
	}

	// NOTE(live): while a game is running, the back already emits IO.EVENT into
	// the room `gs:{gameStateId}:results` (see player.state.service.js). The
	// results-compare view is a post-game view, so polling/refetch on
	// IO.GAME.STOPPED is enough — wire it through WebSocketService if live
	// updating becomes a requirement.
}
