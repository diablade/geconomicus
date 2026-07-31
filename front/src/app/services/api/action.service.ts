import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
	providedIn: 'root',
})
export class ActionService {
	constructor(private http: HttpClient) {}

	getTargetCards(gameStateId: string, targetIdx: number): Observable<{ cards: any[] }> {
		return this.http.post<{ cards: any[] }>(environment.API_HOST + environment.ACTION.GET_TARGET_CARDS, {
			gameStateId,
			targetIdx,
		});
	}

	getAvailablePlayers(gameStateId: string, excludeIdx: number): Observable<{ players: any[] }> {
		return this.http.post<{ players: any[] }>(environment.API_HOST + environment.ACTION.AVAILABLE_PLAYERS, {
			gameStateId,
			excludeIdx,
		});
	}

	whoHaveCard(gameStateId: string, playerStateIdx: number, cardKey: string): Observable<{ status: string; avatarIdx?: number; actionTokens: number }> {
		return this.http.post<{ status: string; avatarIdx?: number; actionTokens: number }>(
			environment.API_HOST + environment.ACTION.WHO_HAVE_CARD,
			{ gameStateId, playerStateIdx, cardKey }
		);
	}

	give(gameStateId: string, giverIdx: number, receiverIdx: number, cardKey: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.ACTION.GIVE, {
			gameStateId,
			giverIdx,
			receiverIdx,
			cardKey,
		});
	}

	steal(gameStateId: string, stealerIdx: number, victimIdx: number, cardKey: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.ACTION.STEAL, {
			gameStateId,
			stealerIdx,
			victimIdx,
			cardKey,
		});
	}

	silentSteal(gameStateId: string, stealerIdx: number, victimIdx: number, cardKey: string): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.ACTION.SILENT_STEAL, {
			gameStateId,
			stealerIdx,
			victimIdx,
			cardKey,
		});
	}

	association(gameStateId: string, giverIdx: number, cardKeys: string[], targetIdxs: number[]): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.ACTION.ASSOCIATION, {
			gameStateId,
			giverIdx,
			cardKeys,
			targetIdxs,
		});
	}

	war(gameStateId: string, attackerIdx: number, victim1Idx: number, victim2Idx: number): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.ACTION.WAR, {
			gameStateId,
			attackerIdx,
			victim1Idx,
			victim2Idx,
		});
	}

	ong(gameStateId: string, giverIdx: number, cardKeys: string[], manualTargetIdxs?: number[]): Observable<any> {
		return this.http.post<any>(environment.API_HOST + environment.ACTION.ONG, {
			gameStateId,
			giverIdx,
			cardKeys,
			...(manualTargetIdxs ? { manualTargetIdxs } : {}),
		});
	}
}
