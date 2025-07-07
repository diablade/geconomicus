import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders} from "@angular/common/http";
import {catchError, Observable, throwError} from "rxjs";
import {Card, Credit, Game, Player} from "../models/game";
import {environment} from "../../environments/environment";
import {SnackbarService} from "./snackbar.service";
import {Router} from "@angular/router";
import {I18nService} from "./i18n.service";

@Injectable({
	providedIn: 'root'
})
export class BackService {

	REDIRECT_HOME = "redirectHome";
	NOTIF = "notif";
	ERROR = "error";
	ERROR_RELOAD = "errorReload";
	ERROR_FORCE_RELOAD = "errorForceReload";
	httpOptions = {
		headers: new HttpHeaders({
			'Content-Type': 'application/json'
		})
	};

	constructor(public http: HttpClient, private router: Router, private snackbarService: SnackbarService, private i18nService: I18nService) {
	}

	private handleError(error: HttpErrorResponse, whatToDo: string, whatToSay: string) {
		console.log(error);

		// Try to get the error message from the response
		const errorMessage = error.error?.message || error.message || whatToSay;

		if (whatToDo == this.REDIRECT_HOME) {
			this.snackbarService.showNotif(this.i18nService.instant(whatToSay));
			setTimeout(() => {
				// Delay for 3 seconds before proceeding
			}, 3000);
			this.router.navigate([""]);
		} else if (whatToDo == this.ERROR_RELOAD) {
			this.snackbarService.showReload(this.i18nService.instant(whatToSay));
		} else if (whatToDo == this.ERROR_FORCE_RELOAD) {
			this.snackbarService.showForceReload(this.i18nService.instant(whatToSay));
		} else if (whatToDo == this.NOTIF) {
			this.snackbarService.showNotif(this.i18nService.instant(whatToSay));
		} else if (whatToDo == this.ERROR) {
			this.snackbarService.showError(this.i18nService.instant(whatToSay));
		}
		// Return an observable with a user-facing error message.
		return throwError(() => new Error(this.i18nService.instant("ERROR.GENERIC")));
	}

	join(idGame: string, name: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN, {
			idGame: idGame,
			name: name,
		})
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, ''))
			);
	}

	getIdGameByShortId(shortId: string): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.GAME.GET_BY_SHORT_ID + shortId)
			.pipe(
				catchError(err => this.handleError(err, this.ERROR, "ERROR.GAME_UNAVAILABLE"))
			);
	}

	joinReincarnate(idGame: string, name: string, fromId: string | undefined): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN_REINCARNATE, {idGame, name, fromId})
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "ERROR.JOIN_REINCARNATE"))
			);
	}

	isReincarnated(idGame: string | undefined, fromId: string | undefined): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.IS_REINCARNATED, {idGame, fromId})
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "ERROR.REINCARNATE"))
			);
	}

	joinInGame(idGame: string, name: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN_IN_GAME, {idGame: idGame, name: name})
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "ERROR.JOIN"))
			);
	}

	createGame(body: any): Observable<Game> {
		return this.http.post<Game>(environment.API_HOST + environment.GAME.CREATE, body)
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "ERROR.CREATE"))
			);
	}

	getGame(idGame: string): Observable<Game> {
		return this.http.get<any>(environment.API_HOST + environment.GAME.GET + idGame)
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.GAME_UNAVAILABLE"))
			);
	}

	newGameFromCopy(idGame: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.GAME.COPY_GAME, {idGame: idGame})
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.NEW_GAME_FROM_COPY"))
			);
	}

	getPlayer(idGame: string | undefined, idPlayer: string | undefined): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.PLAYER.GET + idGame + '/' + idPlayer)
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.PLAYER_NOT_FOUND"))
			);
	}

	refreshForcePlayer(idGame: string, idPlayer: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.REFRESH_PLAYER, {idGame: idGame, idPlayer: idPlayer})
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_FORCE_RELOAD, "ERROR.REFRESH_FORCE_PLAYER"))
			);
	}

	updatePlayer(idGame: string | undefined, player: Player) {
		const newPlayer = {
			_id: player._id,
			idGame: idGame,
			name: player.name,
			image: player.image || '',
			eyes: player.eyes || '',
			eyebrows: player.eyebrows || '',
			earrings: player.earrings || '',
			features: player.features || '',
			hair: player.hair || '',
			glasses: player.glasses || '',
			mouth: player.mouth || '',
			skinColor: player.skinColor || '',
			hairColor: player.hairColor || '',
			boardConf: player.boardConf || '',
			boardColor: player.boardColor || ''
		};
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.UPDATE, newPlayer)
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.UPDATE"))
			);
	}

	produce(idGame: string | undefined, idPlayer: string | undefined, cards: Card[]) {
		return this.http.post<Card[]>(environment.API_HOST + environment.PLAYER.PRODUCE, {
			idGame: idGame,
			idPlayer: idPlayer,
			cards: cards.map(card => ({
				_id: card._id,
				letter: card.letter,
				color: card.color,
				weight: card.weight,
				price: card.price
			}))
		})
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.EXCHANGE"))
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
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.DELETE"))
			);
	}

	startGame(game: Game) {
		return this.http.put<Game>(environment.API_HOST + environment.GAME.START, {
			idGame: game._id,
			typeMoney: game.typeMoney,
		})
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.START_GAME"))
			);
	}

	resetGame(idGame: string) {
		return this.http.put<any>(environment.API_HOST + environment.GAME.RESET, {idGame: idGame})
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.RESET_GAME"))
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
				catchError(err => this.handleError(err, this.ERROR_FORCE_RELOAD, "ERROR.TRANSACTION"))
			);
	}

	startRound(idGame: string, round: number) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.START_ROUND, {idGame: idGame, round: round})
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.START_ROUND"))
			);
	}

	stopRound(idGame: string, round: number) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.STOP_ROUND, {idGame: idGame, round: round})
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.STOP_ROUND"))
			);
	}

	interRound(idGame: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.INTER_ROUND, {idGame: idGame})
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.INTER_ROUND"))
			);
	}

	endGame(idGame: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.END, {idGame: idGame})
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.END_GAME"))
			);
	}

	killUser(idPlayer: string, idGame: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.KILL_PLAYER, {
			idGame: idGame,
			idPlayer: idPlayer
		})
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.KILL"))
			);
	}

	updateGame(idGame: string, game: Game) {
		const allowedFields: { [key: string]: any } = {
			idGame,
			name: game.name,
			animator: game.animator,
			location: game.location,
			typeMoney: game.typeMoney,
			modeNewCard: game.modeNewCard,
			surveyEnabled: game.surveyEnabled,
			devMode: game.devMode,
			autoDeath: game.autoDeath,
			deathPassTimer: game.deathPassTimer,
			priceWeight1: game.priceWeight1,
			priceWeight2: game.priceWeight2,
			priceWeight3: game.priceWeight3,
			priceWeight4: game.priceWeight4,
			roundMax: game.roundMax,
			roundMinutes: game.roundMinutes,
			amountCardsForProd: game.amountCardsForProd,
			distribInitCards: game.distribInitCards,
			generateLettersAuto: game.generateLettersAuto,
			generateLettersInDeck: game.generateLettersInDeck,
			generatedIdenticalCards: game.generatedIdenticalCards,

			// June options
			tauxCroissance: game.tauxCroissance,
			inequalityStart: game.inequalityStart,
			startAmountCoins: game.startAmountCoins,
			pctPoor: game.pctPoor,
			pctRich: game.pctRich,

			// Debt options
			defaultCreditAmount: game.defaultCreditAmount,
			defaultInterestAmount: game.defaultInterestAmount,
			timerCredit: game.timerCredit,
			timerPrison: game.timerPrison,
			manualBank: game.manualBank,
			seizureType: game.seizureType,
			seizureCosts: game.seizureCosts,
			seizureDecote: game.seizureDecote
		};

		// Remove any undefined fields
		Object.keys(allowedFields).forEach(key =>
			allowedFields[key] === undefined && delete allowedFields[key]
		);

		return this.http.put<Game>(environment.API_HOST + environment.GAME.UPDATE,
			allowedFields
		).pipe(
			catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.SAVE_OPTIONS"))
		);
	}

	getGames(): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.GAME.GETALL)
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.GAME_UNAVAILABLE"))
			);
	}

	getFeedbacks(idGame: any): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.GAME.GET_FEEDBACKS + idGame)
			.pipe(
				catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.FEEDBACKS_UNAVAILABLE"))
			);
	}

	sendFeedback(idGame: any, idPlayer: any, individualCollective: number, greedyGenerous: number, irritableTolerant: number, depressedHappy: number, competitiveCooperative: number, dependantAutonomous: number, anxiousConfident: number, insatisfiedAccomplished: number, agressiveAvenant: number) {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.SURVEY, {
			idGame,
			idPlayer,
			individualCollective,
			greedyGenerous,
			irritableTolerant,
			depressedHappy,
			competitiveCooperative,
			dependantAutonomous,
			anxiousConfident,
			insatisfiedAccomplished,
			agressiveAvenant
		}).pipe(
			catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.SEND_SURVEY"))
		);
	}

	createCredit(data: any) {
		return this.http.post<Credit>(environment.API_HOST + environment.BANK.CREATE_CREDIT, data).pipe(
			catchError(err => this.handleError(err, this.ERROR_FORCE_RELOAD, "ERROR.CREATE_CREDIT"))
		);
	}

	getPlayerCredits(idGame: any, idPlayer: any) {
		return this.http.get<any>(environment.API_HOST + environment.BANK.GET_CREDITS + idGame + '/' + idPlayer).pipe(
			catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.GET_CREDITS"))
		)
	}

	settleCredit(credit: Credit) {
		return this.http.post<Credit>(environment.API_HOST + environment.BANK.SETTLE_CREDIT, {
			idCredit: credit._id,
			idGame: credit.idGame,
			idPlayer: credit.idPlayer
		}).pipe(
			catchError(err => this.handleError(err, this.ERROR_FORCE_RELOAD, "ERROR.REPAY_CREDIT"))
		)
	}

	payInterest(credit: Credit) {
		return this.http.post<Credit>(environment.API_HOST + environment.BANK.PAY_INTEREST, {
			idCredit: credit._id,
			idGame: credit.idGame,
			idPlayer: credit.idPlayer
		}).pipe(
			catchError(err => this.handleError(err, this.ERROR_FORCE_RELOAD, "ERROR.PAY_INTEREST"))
		)
	}

	seizure(seizure: any, credit: Credit) {
		return this.http.post<any>(environment.API_HOST + environment.BANK.SEIZURE, {
			idCredit: credit._id,
			idGame: credit.idGame,
			idPlayer: credit.idPlayer,
			seizure: seizure
		}).pipe(
			catchError(err => this.handleError(err, this.ERROR_FORCE_RELOAD, "ERROR.SEIZURE"))
		)
	}

	breakFree(idGame: string, idPlayerToFree: string) {
		return this.http.post<any>(environment.API_HOST + environment.BANK.BREAK_FREE, {
			idPlayerToFree, idGame
		}).pipe(
			catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.BREAK_PRISON"))
		)
	}

	deleteGame(idGame: string, password: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.DELETE_GAME, {
			idGame, password
		}).pipe(
			catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.DELETE_GAME"))
		)
	}

	refreshForceAllPlayers(idGame: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.REFRESH_FORCE_ALL_PLAYERS, {
			idGame
		}).pipe(
			catchError(err => this.handleError(err, this.ERROR_RELOAD, "ERROR.REFRESH_FORCE_ALL_PLAYERS"))
		)
	}
}
