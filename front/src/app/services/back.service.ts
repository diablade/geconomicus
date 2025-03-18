import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders} from "@angular/common/http";
import {catchError, Observable, throwError} from "rxjs";
import {Card, Credit, Game, Player} from "../models/game";
import {environment} from "../../environments/environment";
import {SnackbarService} from "./snackbar.service";
import {Router} from "@angular/router";
import { I18nService } from "./i18n.service";

@Injectable({
	providedIn: 'root'
})
export class BackService {

	REDIRECT_HOME = "redirectHome";
	RELOAD = "reload";

	httpOptions = {
		headers: new HttpHeaders({
			'Content-Type': 'application/json'
		})
	};

	constructor(public http: HttpClient, private router: Router, private snackbarService: SnackbarService, private i18nService: I18nService) {
	}

	private handleError(error: HttpErrorResponse, whatToDo: string, whatToSay: string) {
		if (whatToSay) {
			this.snackbarService.showError(this.i18nService.instant(whatToSay));
		} else {
			this.snackbarService.showError(error.error.message);
		}
		if (error.status === 0) {
			console.error('An error occurred:', error.error);
		} else {
			console.error(`Backend returned code ${error.status}, body was: `, error.error);
		}
		if (whatToDo == this.REDIRECT_HOME) {
			this.router.navigate([""]);
		} else if (whatToDo == this.RELOAD) {
			if (whatToSay) {
				setTimeout(() => {}, 3000);
			}
			window.location.reload();
		}
		// Return an observable with a user-facing error message.
		return throwError(() => new Error(this.i18nService.instant("ERROR.GENERIC")));
	}

	/**
	 * join party
	 */
	public join(idGame: string, name: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN, {
				idGame: idGame,
				name: name,
			})
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, ''))
			);
	}

	/**
	 * join reincarnate party
	 */
	public joinReincarnate(idGame: string, name: string, fromId: string | undefined): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN_REINCARNATE, {idGame, name, fromId})
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "ERROR.JOIN_REINCARNATE"))
			);
	}

	/**
	 * is already reincarnated ?
	 */
	public isReincarnated(idGame: string | undefined, fromId: string | undefined): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.IS_REINCARNATED, {idGame, fromId})
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "ERROR.REINCARNATE"))
			);
	}

	/**
	 * join in game party
	 */
	public joinInGame(idGame: string, name: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN_IN_GAME, {idGame: idGame, name: name})
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "ERROR.JOIN"))
			);
	}

	/**
	 * Create game
	 */
	public createGame(body: any): Observable<Game> {
		return this.http.post<Game>(environment.API_HOST + environment.GAME.CREATE, body)
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "ERROR.CREATE"))
			);
	}

	getGame(idGame: string): Observable<Game> {
		return this.http.get<any>(environment.API_HOST + environment.GAME.GET + idGame)
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "ERROR.GAME_UNAVAILABLE"))
			);
	}

	getPlayer(idGame: string | undefined, idPlayer: string | undefined): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.PLAYER.GET + idGame + '/' + idPlayer)
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "ERROR.PLAYER_NOT_FOUND"))
			);
	}

	updatePlayer(idGame: string | undefined, player: Player) {
		const newPlayer = {...player, idGame: idGame};
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.UPDATE, newPlayer)
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.UPDATE"))
			);
	}

	produce(idGame: string | undefined, idPlayer: string | undefined, cards: Card[]) {
		return this.http.post<Card[]>(environment.API_HOST + environment.PLAYER.PRODUCE, {
				idGame: idGame,
				idPlayer: idPlayer,
				cards: cards
			})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.EXCHANGE"))
			);
	}

	deleteUser(idPlayer: string, idGame: string) {
		return this.http.delete<Game>(environment.API_HOST + environment.GAME.DELETE_PLAYER, {
				body: {
					idGame: idGame,
					idPlayer: idPlayer
				}
			})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.DELETE"))
			);
	}

	startGame(game: Game) {
		return this.http.put<Game>(environment.API_HOST + environment.GAME.START, {
				idGame: game._id,
				typeMoney: game.typeMoney,
			})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.START_GAME"))
			);
	}

	resetGame(idGame: string) {
		return this.http.put<any>(environment.API_HOST + environment.GAME.RESET, {idGame: idGame})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.RESET_GAME"))
			);
	}

	transaction(idGame: string | undefined, idBuyer: string | undefined, idSeller: any, idCard: any) {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.TRANSACTION, {
				idGame,
				idBuyer,
				idSeller,
				idCard
			})
			.pipe(
				catchError(err => this.handleError(err, "", ""))
			);
	}

	startRound(idGame: string, round: number) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.START_ROUND, {idGame: idGame, round: round})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.START_ROUND"))
			);
	}

	stopRound(idGame: string, round: number) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.STOP_ROUND, {idGame: idGame, round: round})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.STOP_ROUND"))
			);
	}

	interRound(idGame: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.INTER_ROUND, {idGame: idGame})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.INTER_ROUND"))
			);
	}

	endGame(idGame: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.END, {idGame: idGame})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.END_GAME"))
			);
	}

	killUser(idPlayer: string, idGame: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.KILL_PLAYER, {
				idGame: idGame,
				idPlayer: idPlayer
			})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.KILL"))
			);
	}

	updateGame(idGame: string, results: any) {
		results.idGame = idGame;
		return this.http.put<Game>(environment.API_HOST + environment.GAME.UPDATE,
			results
		).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "ERROR.SAVE_OPTIONS"))
		);
	}

	getGames(): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.GAME.GETALL)
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.GAME_UNAVAILABLE"))
			);
	}

	getFeedbacks(idGame: any): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.GAME.GET_FEEDBACKS + idGame)
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "ERROR.FEEDBACKS_UNAVAILABLE"))
			);
	}

	sendFeedback(idGame: any, idPlayer: any, individualCollective: number, greedyGenerous: number, irritableTolerant: number, depressedHappy: number, competitiveCooperative: number, dependantAutonomous: number, anxiousConfident: number, aloneIntegrated: number, agressiveAvenant: number) {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.SURVEY + idGame + '/' + idPlayer, {
			idGame,
			idPlayer,
			individualCollective,
			greedyGenerous,
			irritableTolerant,
			depressedHappy,
			competitiveCooperative,
			dependantAutonomous,
			anxiousConfident,
			aloneIntegrated,
			agressiveAvenant
		}).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "ERROR.SEND_SURVEY"))
		);
	}

	createCredit(data: any) {
		return this.http.post<Credit>(environment.API_HOST + environment.BANK.CREATE_CREDIT, data).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "ERROR.CREATE_CREDIT"))
		);
	}

	getPlayerCredits(idGame: any, idPlayer: any) {
		return this.http.get<any>(environment.API_HOST + environment.BANK.GET_CREDITS + idGame + '/' + idPlayer).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "ERROR.GET_CREDITS"))
		)
	}

	settleCredit(credit: Credit) {
		return this.http.post<Credit>(environment.API_HOST + environment.BANK.SETTLE_CREDIT, {
			credit: credit
		}).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "ERROR.REPAY_CREDIT"))
		)
	}

	payInterest(credit: Credit) {
		return this.http.post<Credit>(environment.API_HOST + environment.BANK.PAY_INTEREST, {credit: credit}).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "ERROR.PAY_INTEREST"))
		)
	}

	seizure(seizure: any, credit: Credit) {
		return this.http.post<any>(environment.API_HOST + environment.BANK.SEIZURE, {
			credit: credit,
			seizure: seizure
		}).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "ERROR.SEIZURE"))
		)
	}

	breakFree(idGame: string, idPlayerToFree: string) {
		return this.http.post<any>(environment.API_HOST + environment.BANK.BREAK_FREE, {
			idPlayerToFree, idGame
		}).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "ERROR.BREAK_PRISON"))
		)
	}

	deleteGame(idGame: string, password: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.DELETE_GAME, {
			idGame, password
		}).pipe(
			catchError(err => this.handleError(err, "", "ERROR.DELETE_GAME"))
		)
	}
}
