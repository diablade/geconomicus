import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ERROR, ERROR_RELOAD, ErrorService } from '../error.service';
import { Credit, GameState } from 'src/app/models/gameState';

@Injectable({
	providedIn: 'root',
})
export class BankService {
	private playerCreditsSubject = new BehaviorSubject<Credit[]>([]);
	playerCredits$ = this.playerCreditsSubject.asObservable();

	setPlayerCredits(credits: Credit[]) {
		this.playerCreditsSubject.next(credits);
	}

	constructor(
		public http: HttpClient,
		private errorService: ErrorService
	) {}

	contractCredit(contract: any): Observable<any> {
		return this.http.post(environment.API_HOST + environment.BANK_STATE.CREATE_CREDIT, contract).pipe(
			catchError((error) => {
				this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.CONTRACT');
				throw error;
			})
		);
	}

	cancelCredit(gameStateId: string, creditId: string): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK_STATE.CANCEL_CREDIT, { gameStateId, creditId })
			.pipe(
				catchError((error) => {
					this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.CANCEL_CREDIT');
					throw error;
				})
			);
	}

	loadPlayerCredits(playerIdx: string): Observable<any> {
		return this.http.post(environment.API_HOST + environment.BANK.GET_CREDITS, { playerIdx }).pipe(
			catchError((error) => {
				this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.GET_CREDITS');
				throw error;
			})
		);
	}

	seizure(gameStateId: string, creditId: string, playerStateIdx: number, seizure: any): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK_STATE.SEIZURE, {
				gameStateId,
				creditId,
				playerStateIdx,
				seizure,
			})
			.pipe(
				catchError((error) => {
					this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.SEIZURE');
					throw error;
				})
			);
	}

	prisonBreak(gameStateId: string, playerStateIdx: number): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK_STATE.PRISON_BREAK, { gameStateId, playerStateIdx })
			.pipe(
				catchError((error) => {
					this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.PRISON_BREAK');
					throw error;
				})
			);
	}

	settleCredit(gameStateId: string, playerStateIdx: number, creditId: string): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK_STATE.SETTLE_CREDIT, { gameStateId, playerStateIdx, creditId })
			.pipe(
				catchError((error) => this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.SETTLE_CREDIT'))
			);
	}

	extendCredit(gameStateId: string, playerStateIdx: number, creditId: string): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK_STATE.EXTEND_CREDIT, { gameStateId, playerStateIdx, creditId })
			.pipe(catchError((error) => this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.EXTEND_CREDIT')));
	}

	// Auto-bank: read the current effective rate for the chip (no quote-lock).
	getRate(gameStateId: string, playerStateIdx: number): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK_STATE.GET_RATE, { gameStateId, playerStateIdx })
			.pipe(catchError((error) => this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.GET_RATE')));
	}

	// Auto-bank: self-service credit request. The client sends the exact amount+interest
	// it displayed (the contract; ×2 already baked in); the server checks solvency only.
	requestCredit(gameStateId: string, playerStateIdx: number, amount: number, interest: number): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK_STATE.REQUEST_CREDIT, { gameStateId, playerStateIdx, amount, interest })
			.pipe(catchError((error) => this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.REQUEST_CREDIT')));
	}

	// Auto-bank: animator broadcasts the opening First Credit Question to all players.
	askFirstCreditQuestion(gameStateId: string): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK_STATE.ASK_FIRST_CREDIT, { gameStateId })
			.pipe(catchError((error) => this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.ASK_FIRST_CREDIT')));
	}

	// Auto-bank: a player answers the First Credit Question (accept-single/double/decline).
	answerFirstCredit(gameStateId: string, playerStateIdx: number, answer: string): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK_STATE.ANSWER_FIRST_CREDIT, {
				gameStateId,
				playerStateIdx,
				answer,
			})
			.pipe(catchError((error) => this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.ANSWER_FIRST_CREDIT')));
	}

	giveFreeMoney(gameStateId: string, playerStateIdx: number, amount: number): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK_STATE.GIVE_FREE_MONEY, {
				gameStateId,
				playerStateIdx,
				amount,
			})
			.pipe(
				catchError((error) => {
					this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.GIVE_FREE_MONEY');
					throw error;
				})
			);
	}
}
