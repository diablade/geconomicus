import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ERROR, ERROR_RELOAD, ErrorService } from '../error.service';
import { GameState, PlayerState } from '../../models/gameState';
import { Rules } from '../../models/rules';
import { Session } from '../../models/session';
import { WebSocketService } from '../web-socket.service';
import { IO, GAME_STATUS, PLAYER_STATUS, ROOMS } from '@geco/shared';
import { SessionStorageService } from '../local-storage/session-storage.service';
import { StorageKey } from '../local-storage/storage-key.const';
import createCountdown from '../countDown';
import { SessionService } from './session.service';

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

	private sessionId = '';
	private gameStateId = '';
	private roomGameState = '';
	private roomMaster = '';

	private timer: any;

	// Setters
	setGameState(gameState: GameState, connectedPlayers?: any) {
		this.gameStateSubject.next(gameState);
        if (connectedPlayers) {
            gameState.playersStates.forEach(playerState => {
                const connectStatus = connectedPlayers.find((connection: any) => connection.idx === playerState.idx);
                playerState.connected = connectStatus?.connected || false;
                playerState.lastSeen = connectStatus?.lastSeen || null;
            });
        }
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
		private sessionStorageService: SessionStorageService,
		private sessionService: SessionService
	) {
		this.initializeTimer();
	}

	loadForMaster(sessionId: string, gameStateId: string): void {
		this.sessionId = sessionId;
		this.gameStateId = gameStateId;
		this.roomGameState = ROOMS.gameState(gameStateId);
		this.roomMaster = ROOMS.gameStateMaster(gameStateId);

        this.sessionService.initializeSocket(sessionId);
		this.get(gameStateId, true).subscribe((payload) => {
			this.setGameState(payload.gameState, payload.connectedPlayers);
			this.setRules(payload.rules);
			if (payload.session) {
				this.setSession(payload.session);
			}
		});
		this.setupMasterSocketListeners();
		if (this.wsService.isConnected()) {
            console.log("connected");
			this.joinRooms();
		}
        console.log("not connected");
	}

	leaveRooms(): void {
		if (this.gameStateId) {
			this.wsService.leaveRoom(this.roomGameState);
			this.wsService.leaveRoom(this.roomMaster);
		}
	}

	private joinRooms(): void {
        console.log("joining rooms...");
		this.wsService.joinRoom(this.roomGameState);
		this.wsService.joinRoom(this.roomMaster);
	}

	private setupMasterSocketListeners(): void {
		console.log('setupMasterSocketListeners');
		this.wsService.on(IO.AVATAR.UPDATED, (player: PlayerState) => {
			// Avatar updated event — could refresh player list
		});

		this.wsService.on(IO.PLAYER.JOINED, (player: PlayerState) => {
			console.log('test joined ws:', player);
			const current = this.playersStatesSubject.getValue();
			this.playersStatesSubject.next([...current, player]);
		});

		this.wsService.on(IO.PLAYER.CONNECTED as any, (data) => {
            console.log("test connected ws:", data);
			this.updatePlayerConnectionStatus(data, true);
		});

		this.wsService.on(IO.PLAYER.DISCONNECTED as any, (data) => {
            console.log("test disconnected ws:", data);
			this.updatePlayerConnectionStatus(data, false);
		});

		this.wsService.on('connected', (data: any) => {
			console.log('connected, joining other rooms...', data);
			this.joinRooms();
		});

		// Handle reconnection - if we receive 'connected' event, check if we're still in rooms
		this.wsService.on('disconnect', () => {
			console.log('Master board disconnected, will reconnect...');
			// Schedule reconnection after a short delay
			setTimeout(() => {
				if (this.wsService.isConnected()) {
					console.log('Master board reconnecting to rooms...');
					this.joinRooms();
				}
			}, 2000); // Reconnect after 2 seconds
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

	offAll(): void {
		this.wsService.off(IO.AVATAR.UPDATED);
		this.wsService.off(IO.PLAYER.JOINED);
		this.wsService.off(IO.PLAYER.CONNECTED);
		this.wsService.off(IO.PLAYER.DISCONNECTED);
		this.wsService.off(IO.TIMER_LEFT);
		this.wsService.off(IO.GAME.STOPPED);
		this.wsService.off(IO.GAME.STARTED);
		this.wsService.off(IO.GAME.FINISHED);
		this.wsService.off(IO.GAME.DEATH_IS_COMING);
		this.wsService.off(IO.PLAYER.DIED);
	}

	create(sessionId: string, ruleIdx: number): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.CREATE, { sessionId, ruleIdx })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.GAME_NOT_FOUND')));
	}

	get(gameStateId: string, enriched: boolean): Observable<any> {
		return this.http
			.get<any>(environment.API_HOST + environment.GAME_STATE.GET + gameStateId + '?enriched=' + enriched)
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.GAME_NOT_FOUND')));
	}

	init(gameStateId: string): Observable<any> {
		return new Observable((observer) => {
			this.http
				.post<any>(environment.API_HOST + environment.GAME_STATE.INIT, { gameStateId })
				.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.DISTRIBUTE_CARDS')))
				.subscribe((data) => {
					if (data.status == 'done') {
						this.setGameState(data.gameState);
					}
					observer.next(data);
					observer.complete();
				});
		});
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
	 * Update player connection status.
	 */
	updatePlayerConnectionStatus(data: any, connected: boolean): void {
		const currentPlayers = this.playersStatesSubject.value;
		const updatedPlayers = currentPlayers.map((player) =>{
			return player.idx === data.playerStateIdx ? { ...player, connected } : player;
        });
		this.playersStatesSubject.next(updatedPlayers);
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
