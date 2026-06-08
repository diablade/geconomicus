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

	seizure(seizure: any, credit: any): Observable<any> {
		return this.http.post(environment.API_HOST + environment.BANK.SEIZURE, { seizure, credit }).pipe(
			catchError((error) => {
				this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.SEIZURE');
				throw error;
			})
		);
	}

	breakFree(playerIdx: string): Observable<any> {
		return this.http.post(environment.API_HOST + environment.BANK.BREAK_FREE, { playerIdx }).pipe(
			catchError((error) => {
				this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.BREAK_FREE');
				throw error;
			})
		);
	}

	settleCredit(credit: Credit): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK.SETTLE_CREDIT, { credit })
			.pipe(
				catchError((error) => this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.SETTLE_CREDIT'))
			);
	}

	payInterest(credit: Credit): Observable<any> {
		return this.http
			.post(environment.API_HOST + environment.BANK.PAY_INTEREST, { credit })
			.pipe(catchError((error) => this.errorService.handleError(error, ERROR_RELOAD, 'ERROR.BANK.PAY_INTEREST')));
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
