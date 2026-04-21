import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ERROR, ERROR_RELOAD, ErrorService } from '../error.service';
import { GameState, PlayerState } from '../../models/gameState';
import { Rules } from '../../models/rules';
import { Session } from '../../models/session';
import { WebSocketService } from '../web-socket.service';
import { IO, GAME_STATUS, PLAYER_STATUS } from '@geco/shared';
import { SessionStorageService } from '../local-storage/session-storage.service';
import { StorageKey } from '../local-storage/storage-key.const';
import createCountdown from '../countDown';

@Injectable({
	providedIn: 'root',
})
export class GameStateService {
	// Reactive state subjects
	private gameStateSubject = new BehaviorSubject<GameState>(new GameState());
	gameState$ = this.gameStateSubject.asObservable();

	private rulesSubject = new BehaviorSubject<Rules>(new Rules());
	rules$ = this.rulesSubject.asObservable();

	private sessionSubject = new BehaviorSubject<Session>(new Session());
	session$ = this.sessionSubject.asObservable();

	private playersStatesSubject = new BehaviorSubject<PlayerState[]>([]);
	playersStates$ = this.playersStatesSubject.asObservable();

	// Timer state
	private timerProgressSubject = new BehaviorSubject<number>(100);
	timerProgress$ = this.timerProgressSubject.asObservable();

	private minutesSubject = new BehaviorSubject<string>('00');
	minutes$ = this.minutesSubject.asObservable();

	private secondsSubject = new BehaviorSubject<string>('00');
	seconds$ = this.secondsSubject.asObservable();

	private sessionId: string = '';
	private gameStateId: string = '';
	private timer: any;

	// Setters
	setGameState(gameState: GameState) {
		this.gameStateSubject.next(gameState);
		this.playersStatesSubject.next(gameState.playersStates || []);
	}
	setRules(rules: Rules) {
		this.rulesSubject.next(rules);
	}
	setSession(session: Session) {
		this.sessionSubject.next(session);
	}
    // Getters
	getGameStateSnapshot(): GameState {
		return this.gameStateSubject.getValue();
	}
	getRulesSnapshot(): Rules {
		return this.rulesSubject.getValue();
	}
	getSessionSnapshot(): Session {
		return this.sessionSubject.getValue();
	}

	constructor(
		public http: HttpClient,
		private errorService: ErrorService,
		private wsService: WebSocketService,
		private sessionStorageService: SessionStorageService
	) {
		this.initializeTimer();
	}

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

	init(gameStateId: string): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.INIT, { gameStateId })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.DISTRIBUTE_CARDS')));
	}

	resetGame(gameStateId: string, sessionId: string, ruleIdx: number): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.RESET, { gameStateId, sessionId, ruleIdx })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.GAME_NOT_FOUND')));
	}

	startRound(gameStateId: string): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.START_ROUND, { gameStateId })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.START_ROUND')));
	}

	/**
	 * Load game state + rules + session into reactive subjects and initialise socket for master board.
	 */
	loadForMaster(sessionId: string, gameStateId: string): void {
		this.sessionId = sessionId;
		this.gameStateId = gameStateId;

		this.get(gameStateId, true).subscribe((payload) => {
			this.setGameState(payload.gameState);
			this.setRules(payload.rules);
			if (payload.session) {
				this.setSession(payload.session);
			}
			this.initializeMasterSocket(sessionId, gameStateId);
		});
	}

	/**
	 * Initialize socket connection for the master board.
	 */
	private initializeMasterSocket(sessionId: string, gameStateId: string): void {
		this.wsService.initializeSocket({
			publicChannel: gameStateId,
			privateChannel: `${gameStateId}:master`,
		});
		this.setupMasterSocketListeners();
	}

	private setupMasterSocketListeners(): void {
		this.wsService.on(IO.AVATAR.UPDATED, (player: PlayerState) => {
			// Avatar updated event — could refresh player list
		});

		this.wsService.on(IO.PLAYER.JOINED, (player: PlayerState) => {
			const current = this.playersStatesSubject.getValue();
			this.playersStatesSubject.next([...current, player]);
		});

		this.wsService.on('connected', (data: any) => {
			console.log('Master socket connected', data);
			this.wsService.joinRoom(this.gameStateId!);
			this.wsService.joinRoom(`${this.gameStateId}:master`);
		});

		this.wsService.on(IO.TIMER_LEFT, (minutesRemaining: number) => {
			this.handleTimerLeft(minutesRemaining);
		});

		this.wsService.on(IO.GAME.STOPPED, () => {
			this.stopTimer();
			const currentState = this.gameStateSubject.getValue();
			this.gameStateSubject.next({ ...currentState, status: GAME_STATUS.STOPPED });
		});

		this.wsService.on(IO.GAME.STARTED, () => {
			const currentState = this.gameStateSubject.getValue();
			this.gameStateSubject.next({ ...currentState, status: GAME_STATUS.PLAYING });
		});

		this.wsService.on(IO.GAME.FINISHED, () => {
			const currentState = this.gameStateSubject.getValue();
			this.gameStateSubject.next({ ...currentState, status: GAME_STATUS.FINISHED });
		});

		this.wsService.on(IO.GAME.DEATH_IS_COMING, () => {
			// Death event — component handles dialog
		});

		this.wsService.on(IO.PLAYER.DIED, (event: any) => {
			const currentStates = this.playersStatesSubject.getValue();
			const updated = currentStates.map((p) => {
				if (p.idx == event.receiver) {
					return { ...p, status: PLAYER_STATUS.DEAD };
				}
				return p;
			});
			this.playersStatesSubject.next(updated);
		});
	}

	/**
	 * Handle TIMER_LEFT socket event.
	 */
	private handleTimerLeft(minutesRemaining: number): void {
		this.sessionStorageService.setItem(StorageKey.timerRemaining, minutesRemaining * 60);
		const gameState = this.getGameStateSnapshot();
		if (minutesRemaining && gameState.status == GAME_STATUS.PLAYING) {
			this.timer.stop();
			this.timer.reset();
			this.timer.set({ h: 0, m: minutesRemaining, s: 0 });
			this.timer.start();
		}
	}

    /**
	 * Initialize the timer countdown.
	 */
	private initializeTimer(): void {
		this.timer = createCountdown(
			{ h: 0, m: 0, s: 0 },
			{
				listen: ({ hh, mm, ss, s, h, m }: any) => {
					const rules = this.getRulesSnapshot();
					const secondsRemaining = s + m * 60;
					this.minutesSubject.next(mm);
					this.secondsSubject.next(ss);
					this.timerProgressSubject.next((secondsRemaining / (rules.roundMinutes * 60)) * 100);
					this.sessionStorageService.setItem(StorageKey.timerRemaining, secondsRemaining);
				},
				done: () => {
					// Timer done - component can subscribe to this event
				},
			}
		);
	}

	/**
	 * Set initial timer based on rules.
	 */
	setInitialTimer(roundMinutes: number): void {
		if (roundMinutes > 0) {
			const minutes = roundMinutes > 9 ? roundMinutes.toString() : '0' + roundMinutes.toString();
			this.minutesSubject.next(minutes);

			const timerRemaining = this.sessionStorageService.getItem(StorageKey.timerRemaining);
			const gameState = this.getGameStateSnapshot();

			if (timerRemaining && gameState.status == GAME_STATUS.PLAYING) {
				this.timer.set({ h: 0, m: 0, s: timerRemaining });
				this.timer.start();
			} else {
				this.timer.set({ h: 0, m: roundMinutes, s: 0 });
			}
		}
	}

	/**
	 * Stop the timer.
	 */
	private stopTimer(): void {
		this.timer.stop();
		this.timer.reset();
		this.timer.set({ h: 0, m: 0, s: 0 });
		this.timerProgressSubject.next(0);
		this.sessionStorageService.removeItem(StorageKey.timerRemaining);
	}

	/**
	 * Get timer snapshot values.
	 */
	getTimerSnapshot(): { minutes: string; seconds: string; progress: number } {
		return {
			minutes: this.minutesSubject.getValue(),
			seconds: this.secondsSubject.getValue(),
			progress: this.timerProgressSubject.getValue(),
		};
	}
}
