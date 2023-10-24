import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders} from "@angular/common/http";
import {catchError, Observable, throwError} from "rxjs";
import {Card, Game, Player} from "../models/game";
import {environment} from "../../environments/environment";
import {SnackbarService} from "./snackbar.service";
import {Router} from "@angular/router";

// import {retry} from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class BackService {

  REDIRECT_HOME: string = "redirectHome";

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(public http: HttpClient, private router: Router, private snackbarService: SnackbarService) {
  }

  private handleError(error: HttpErrorResponse, whatToDo: string, whatToSay: string) {
    this.snackbarService.showError(whatToSay);
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error(
        `Backend returned code ${error.status}, body was: `, error.error);
    }
    if (whatToDo == this.REDIRECT_HOME) {
      this.router.navigate([""]);
    }
    // Return an observable with a user-facing error message.
    return throwError(() => new Error('Something bad happened; please try again later.'));
  }

  /**
   * join party
   */
  public join(idGame: string, name: string, reincarnate: string|undefined): Observable<any> {
    return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN, {idGame: idGame, name: name, reincarnate:reincarnate})
      .pipe(
        catchError(err => this.handleError(err, this.REDIRECT_HOME, "impossible à rejoindre"))
      );
  }

  /**
   * join reincarnate party
   */
  public joinReincarnate(idGame: string, name: string): Observable<any> {
    return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN_REINCARNATE, {idGame: idGame, name: name})
      .pipe(
        catchError(err => this.handleError(err, this.REDIRECT_HOME, "impossible à rejoindre"))
      );
  }

  /**
   * join in game party
   */
  public joinInGame(idGame: string, name: string): Observable<any> {
    return this.http.post<any>(environment.API_HOST + environment.PLAYER.JOIN_IN_GAME, {idGame: idGame, name: name})
      .pipe(
        catchError(err => this.handleError(err, this.REDIRECT_HOME, "impossible à rejoindre"))
      );
  }

  /**
   * Create game
   */
  public createGame(body: any): Observable<Game> {
    return this.http.post<Game>(environment.API_HOST + environment.GAME.CREATE, body)
      .pipe(
        catchError(err => this.handleError(err, this.REDIRECT_HOME, "creation impossible"))
      );
  }

  getGame(idGame: String): Observable<Game> {
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
    const newPlayer = {...player, idGame: idGame};
    return this.http.post<any>(environment.API_HOST + environment.PLAYER.UPDATE, newPlayer)
      .pipe(
        catchError(err => this.handleError(err, "", "modification impossible"))
      );
  }

  produceFromSquare(idGame: string | undefined, idPlayer: string | undefined, cards: Card[]) {
    return this.http.post<Card[]>(environment.API_HOST + environment.PLAYER.PRODUCE, {
      idGame: idGame,
      idPlayer: idPlayer,
      cards: cards
    })
      .pipe(
        catchError(err => this.handleError(err, "", "échange impossible")
          //TODO ré actualise
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
        catchError(err => this.handleError(err, "", "suppression impossible")
          //TODO ré actualise
        )
      );
  }

  startGame(game: Game) {
    return this.http.put<Game>(environment.API_HOST + environment.GAME.START, {
      idGame: game._id,
      priceWeight1: game.priceWeight1,
      priceWeight2: game.priceWeight2,
      priceWeight3: game.priceWeight3,
      priceWeight4: game.priceWeight4,
      tauxCroissance: game.tauxCroissance,
      startAmountCoins: game.startAmountCoins,
      inequalityStart: game.inequalityStart,
      round: game.round,
      typeMoney: game.typeMoney,
      roundMax: game.roundMax,
      roundMinutes: game.roundMinutes
    })
      .pipe(
        catchError(err => this.handleError(err, "", "start game impossible"))
      );
  }

  resetGame(idGame: string) {
    return this.http.put<any>(environment.API_HOST + environment.GAME.RESET, {idGame: idGame})
      .pipe(
        catchError(err => this.handleError(err, "", "reset game impossible"))
      );
  }

  transaction(body: {
    idGame: string | undefined;
    idBuyer: string | undefined;
    idSeller: string | undefined;
    idCard: any
  }) {
    console.log(body);
    return this.http.post<any>(environment.API_HOST + environment.PLAYER.TRANSACTION, body)
      .pipe(
        catchError(err => this.handleError(err, "", err))
      );
  }

  startRound(idGame: string) {
    return this.http.post<any>(environment.API_HOST + environment.GAME.START_ROUND, {idGame: idGame})
      .pipe(
        catchError(err => this.handleError(err, "", "demarrer tour impossible"))
      );
  }

  stopRound(idGame: string, round:number) {
    return this.http.post<any>(environment.API_HOST + environment.GAME.STOP_ROUND, {idGame: idGame, round:round})
      .pipe(
        catchError(err => this.handleError(err, "", "stop tour impossible"))
      );
  }

  interRound(idGame: string) {
    return this.http.post<any>(environment.API_HOST + environment.GAME.INTER_ROUND, {idGame: idGame})
      .pipe(
        catchError(err => this.handleError(err, "", "inter tour impossible"))
      );
  }

  stopGame(idGame: string) {
    return this.http.post<any>(environment.API_HOST + environment.GAME.STOP, {idGame: idGame})
      .pipe(
        catchError(err => this.handleError(err, "", "stop jeu impossible"))
      );
  }

  // getEvents(idGame: string) {
  //   return this.http.get<any>(environment.API_HOST + environment.GAME.EVENTS+ idGame)
  //     .pipe(
  //       catchError(err => this.handleError(err, this.REDIRECT_HOME, "partie indisponible"))
  //     );
  // }
  killUser(idPlayer: string, idGame: string) {
    return this.http.post<any>(environment.API_HOST + environment.GAME.KILL_PLAYER, {
      idGame: idGame,
      idPlayer: idPlayer
    })
      .pipe(
        catchError(err => this.handleError(err, "", "kill impossible")
          //TODO ré actualise
        )
      );
  }
}
