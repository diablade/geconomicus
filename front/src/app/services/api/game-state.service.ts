import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ERROR, ERROR_RELOAD, ErrorService} from '../error.service';
import { GameState } from '../../models/gameState';

@Injectable({
	providedIn: 'root',
})
export class GameStateService {
    gameStateSubject = new BehaviorSubject<GameState>(new GameState());
    gameState$ = this.gameStateSubject.asObservable();

	constructor(
		public http: HttpClient,
		private errorService: ErrorService
	) {}

	create(sessionId: string, ruleIdx: number): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.CREATE, { sessionId, ruleIdx })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.GAME_NOT_FOUND')));
	}

	get(gameStateId: string, enriched: boolean): Observable<any> {
		return this.http
			.get<any>(environment.API_HOST + environment.GAME_STATE.GET + gameStateId + '?enriched=' + enriched)
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.PLAYER_NOT_FOUND')));
	}

    resetGame(gameStateId: string, sessionId: string, ruleIdx: number): Observable<any> {
        return this.http
            .post<any>(environment.API_HOST + environment.GAME_STATE.RESET, { gameStateId, sessionId, ruleIdx })
            .pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.GAME_NOT_FOUND')));
    }

	//enter

	// in playerService :
	//transaction
	//produce
	//...
}
