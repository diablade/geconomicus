import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ERROR, ERROR_RELOAD, ErrorService } from '../error.service';
import { Credit } from 'src/app/models/gameState';
import { Card } from 'src/app/models/gameState';

@Injectable({
	providedIn: 'root',
})
export class DeckService {
	constructor(
		public http: HttpClient,
		private errorService: ErrorService
	) {}

	whoHaveCard(idGame: string | undefined, ingredientKey: string) {
		return this.http.get<any>(environment.API_HOST + environment.GAME.WHO_HAVE_CARD + idGame + '/' + ingredientKey).pipe(
			catchError(err => this.errorService.handleError(err, ERROR_RELOAD, "ERROR.FINDING_CARD"))
		)
	}

	produce(gameStateId: string | undefined, playerStateIdx: string | undefined, cards: Card[]): Observable<Card[]> {
		return this.http.post<Card[]>(environment.API_HOST + environment.PLAYER.PRODUCE, {
			gameStateId,
			playerStateIdx,
			cards: cards.map(card => ({
				key: card.key,
				letter: card.letter,
				color: card.color,
				weight: card.weight,
				price: card.price
			}))
		}).pipe(catchError(err => this.errorService.handleError(err, ERROR_RELOAD, "ERROR.EXCHANGE")));
	}
}

