import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { catchError, Observable, throwError } from "rxjs";
import { Card, Credit, Game, Player } from "../models/game";
import { environment } from "../../environments/environment";
import { SnackbarService } from "./snackbar.service";
import { Router } from "@angular/router";

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

	constructor(public http: HttpClient, private router: Router, private snackbarService: SnackbarService) {
	}

	private handleError(error: HttpErrorResponse, whatToDo: string, whatToSay: string) {
		if (whatToSay) {
			this.snackbarService.showError(whatToSay);
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
				setTimeout(() => { }, 3000);
			}
			window.location.reload();
		}
		// Return an observable with a user-facing error message.
		return throwError(() => new Error('Something bad happened; please try again later.'));
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

	joinReincarnate(idGame: string, name: string, fromId: string | undefined): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN_REINCARNATE, { idGame, name, fromId })
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "impossible à rejoindre"))
			);
	}

	isReincarnated(idGame: string | undefined, fromId: string | undefined): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.IS_REINCARNATED, { idGame, fromId })
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "impossible à réincarner"))
			);
	}

	joinInGame(idGame: string, name: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN_IN_GAME, { idGame: idGame, name: name })
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "impossible à rejoindre"))
			);
	}

	createGame(body: any): Observable<Game> {
		return this.http.post<Game>(environment.API_HOST + environment.GAME.CREATE, body)
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "creation impossible"))
			);
	}

	getGame(idGame: string): Observable<Game> {
		return this.http.get<any>(environment.API_HOST + environment.GAME.GET + idGame)
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "partie indisponible"))
			);
	}

	getPlayer(idGame: string | undefined, idPlayer: string | undefined): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.PLAYER.GET + idGame + '/' + idPlayer)
			.pipe(
				catchError(err => this.handleError(err, this.REDIRECT_HOME, "joueur inexistant"))
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
				catchError(err => this.handleError(err, "", "modification impossible"))
			);
	}

	produce(idGame: string | undefined, idPlayer: string | undefined, cards: Card[]) {
		return this.http.post<Card[]>(environment.API_HOST + environment.PLAYER.PRODUCE, {
			idGame: idGame,
			idPlayer: idPlayer,
			cards: cards
		})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "échange impossible")
				)
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
				catchError(err => this.handleError(err, this.RELOAD, "suppression impossible")
				)
			);
	}

	startGame(game: Game) {
		return this.http.put<Game>(environment.API_HOST + environment.GAME.START, {
			idGame: game._id,
			typeMoney: game.typeMoney,
		})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "start game impossible"))
			);
	}

	resetGame(idGame: string) {
		return this.http.put<any>(environment.API_HOST + environment.GAME.RESET, { idGame: idGame })
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "reset game impossible"))
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
		return this.http.post<any>(environment.API_HOST + environment.GAME.START_ROUND, { idGame: idGame, round: round })
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "demarrer tour impossible"))
			);
	}

	stopRound(idGame: string, round: number) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.STOP_ROUND, { idGame: idGame, round: round })
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "stop tour impossible"))
			);
	}

	interRound(idGame: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.INTER_ROUND, { idGame: idGame })
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "inter tour impossible"))
			);
	}

	endGame(idGame: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.END, { idGame: idGame })
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "stop jeu impossible"))
			);
	}

	killUser(idPlayer: string, idGame: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.KILL_PLAYER, {
			idGame: idGame,
			idPlayer: idPlayer
		})
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "kill impossible")
				)
			);
	}

	updateGame(idGame: string, game: Game) {
		const allowedFields: {[key: string]: any} = {
			idGame,
			name: game.name,
			animator: game.animator,
			location: game.location,
			typeMoney: game.typeMoney,
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
			catchError(err => this.handleError(err, '', "Sauvegarde des options impossible"))
		);
	}

	getGames(): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.GAME.GETALL)
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "partie indisponible"))
			);
	}

	getFeedbacks(idGame: any): Observable<any> {
		return this.http.get<any>(environment.API_HOST + environment.GAME.GET_FEEDBACKS + idGame)
			.pipe(
				catchError(err => this.handleError(err, this.RELOAD, "feedbacks indisponible"))
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
			catchError(err => this.handleError(err, this.RELOAD, "Envoie du sondage impossible"))
		);
	}

	createCredit(data: any) {
		return this.http.post<Credit>(environment.API_HOST + environment.BANK.CREATE_CREDIT, data).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "creation du credit impossible"))
		);
	}

	getPlayerCredits(idGame: any, idPlayer: any) {
		return this.http.get<any>(environment.API_HOST + environment.BANK.GET_CREDITS + idGame + '/' + idPlayer).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "recuperation des credits impossible"))
		)
	}

	settleCredit(credit: Credit) {
		return this.http.post<Credit>(environment.API_HOST + environment.BANK.SETTLE_CREDIT, {
			credit: credit
		}).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "remboursement du credit impossible"))
		)
	}

	payInterest(credit: Credit) {
		return this.http.post<Credit>(environment.API_HOST + environment.BANK.PAY_INTEREST, { credit: credit }).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "paiement de l'interet impossible"))
		)
	}

	seizure(seizure: any, credit: Credit) {
		return this.http.post<any>(environment.API_HOST + environment.BANK.SEIZURE, {
			credit: credit,
			seizure: seizure
		}).pipe(
			catchError(err => this.handleError(err, this.RELOAD, "Saisie de biens impossible"))
		)
	}

	breakFree(idGame: string, idPlayerToFree: string) {
		return this.http.post<any>(environment.API_HOST + environment.BANK.BREAK_FREE, {
			idPlayerToFree, idGame
		}).pipe(
			catchError(err => this.handleError(err, this.RELOAD, " I can't break prison :/ "))
		)
	}

	deleteGame(idGame: string, password: string) {
		return this.http.post<any>(environment.API_HOST + environment.GAME.DELETE_GAME, {
			idGame, password
		}).pipe(
			catchError(err => this.handleError(err, "", " I can't delete"))
		)
	}
}
