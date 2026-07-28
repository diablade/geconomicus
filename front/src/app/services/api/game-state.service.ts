import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	BehaviorSubject,
	catchError,
	combineLatest,
	debounceTime,
	distinctUntilChanged,
	map,
	Observable,
	Subject,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { ERROR, ErrorService } from '../error.service';
import { GameState, PlayerState, Credit, ConnectionStatus } from '../../models/gameState';
import { Rules } from '../../models/rules';
import { Avatar } from '../../models/avatar';
import { Session } from '../../models/session';
import { WebSocketService } from '../web-socket.service';
import { IO, GAME_STATUS, PLAYER_STATUS, CREDIT_STATUS, ROOMS } from '@geco/shared';
import createCountdown from '../countDown';
import { SessionService } from './session.service';
import { BankService } from './bank.service';
import _ from 'lodash';
import { SnackbarService } from '../snackbar.service';
import { I18nService } from '../i18n.service';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

@Injectable({
	providedIn: 'root',
})
export class GameStateService {
	// Reactive state subjects
	private gameStateSubject = new BehaviorSubject<Partial<GameState>>({});
	gameState$ = this.gameStateSubject.asObservable();
	masterConnection$ = inject(WebSocketService).connectionStatus$;

	private rulesSubject = new BehaviorSubject<Rules>(new Rules());
	rules$ = this.rulesSubject.asObservable();

	private sessionSubject = new BehaviorSubject<Session>(new Session());
	session$ = this.sessionSubject.asObservable();

	private playersStatesSubject = new BehaviorSubject<PlayerState[]>([]);
	playersStates$ = this.playersStatesSubject.asObservable();

	private connectedPlayersSubject = new BehaviorSubject<ConnectionStatus[]>([]);
	connectedPlayers$ = this.connectedPlayersSubject.asObservable();

	playersAC$ = combineLatest({
		session: this.session$,
		playersStates: this.playersStates$,
		connectedPlayers: this.connectedPlayers$,
	}).pipe(
		debounceTime(0), // wait for simultaneous emissions to stabilize
		distinctUntilChanged((a, b) => {
			if (!_.isEqual(a.session.avatars, b.session.avatars)) {
				return false;
			}
			if (!_.isEqual(a.playersStates, b.playersStates)) {
				return false;
			}
			if (!_.isEqual(a.connectedPlayers, b.connectedPlayers)) {
				return false;
			}
			return true;
		}),
		map(({ playersStates, session, connectedPlayers }) =>
			playersStates.map((playerState: PlayerState) => ({
				...playerState,
				connection: connectedPlayers.find((c: ConnectionStatus) => c.idx === playerState.idx),
				avatar: session.avatars.find((a: Avatar) => a.idx === playerState.avatarIdx) ?? undefined,
			}))
		)
	);

	private creditsSubject = new BehaviorSubject<Credit[]>([]);
	credits$ = this.creditsSubject.asObservable();

	// Timer state
	private timerProgressSubject = new BehaviorSubject<number>(100);
	timerProgress$ = this.timerProgressSubject.asObservable();

	private minutesSubject = new BehaviorSubject<string>('00');
	minutes$ = this.minutesSubject.asObservable();

	private secondsSubject = new BehaviorSubject<string>('00');
	seconds$ = this.secondsSubject.asObservable();

	private timerTickSubject = new Subject<void>();
	timerTick$ = this.timerTickSubject.asObservable();

	// Emitted (to the animator cockpit) when a player dies and is reborn.
	private reincarnationSubject = new Subject<{ avatarIdx: number; oldPlayerStateIdx: number; newPlayerStateIdx: number }>();
	reincarnation$ = this.reincarnationSubject.asObservable();

	private sessionId = '';
	private gameStateId = '';
	private roomGameState = '';
	private roomMaster = '';
	private roomBank = '';

	private timer: any;

	getAvatar(playerStateIdx: number): Avatar | undefined {
		const session = this.sessionSubject.getValue();
		return session.avatars.find((avatar) => avatar.idx === playerStateIdx);
	}

	constructor(
		public http: HttpClient,
		private errorService: ErrorService,
		private wsService: WebSocketService,
		private snackbarService: SnackbarService,
		private i18n: I18nService,
		private dialog: MatDialog,
		private bankService: BankService,
		private router: Router,
		private sessionService: SessionService
	) {
		this.initializeTimer();
	}

	loadForMaster(sessionId: string, gameStateId: string, isBank = false): void {
		this.sessionId = sessionId;
		this.gameStateId = gameStateId;
		this.roomGameState = ROOMS.gameState(gameStateId);
		this.roomMaster = ROOMS.gameStateMaster(gameStateId);

		this.setupMasterSocketListeners();
		this.setupPlayersSocketListeners();
		if (isBank) {
			this.setupBankSocketListener();
			this.roomBank = ROOMS.gameStateBank(gameStateId);
		}

		// Singleton service: clear any timer left over from a previously-viewed game
		// so its stale countdown/interval never bleeds into this board.
		this.stopTimer();

		this.sessionService.initializeSocket(sessionId);
		this.get(gameStateId, true).subscribe((payload) => {
			this.gameStateSubject.next(payload.gameState);
			this.playersStatesSubject.next(payload.gameState.playersStates);
			this.connectedPlayersSubject.next(payload.connectedPlayers);
			this.rulesSubject.next(payload.rules);
			if (payload.session) {
				this.sessionSubject.next(payload.session);
			}
			if (payload.gameState.credits) {
				this.creditsSubject.next(payload.gameState.credits);
			}

			// Auto-resume, display paused timer, or fall back to the full round from rules.
			const remainingTime = payload.gameState.gameTimers?.remainingTime ?? 0;
			if (payload.gameState.status === GAME_STATUS.PLAYING && remainingTime > 0) {
				this.startTimer(remainingTime);
			} else if (remainingTime > 0) {
				this.setPausedTimer(remainingTime);
			} else {
				this.resetTimerToRules();
			}
		});
		if (this.wsService.isConnected()) {
			console.log('connected');
			this.joinRooms();
		} else {
			console.log('not connected');
		}
	}

	leaveRooms(): void {
		// The service is a singleton but its countdown belongs to the board being torn
		// down: stop it so no stale interval survives into the next game view.
		this.stopTimer();
		if (this.gameStateId) {
			this.wsService.leaveRoom(this.roomGameState);
			this.wsService.leaveRoom(this.roomMaster);
			if (this.roomBank) {
				this.wsService.leaveRoom(this.roomBank);
			}
		}
	}

	leaveBankRoom(): void {
		this.wsService.leaveRoom(this.roomBank);
	}

	private joinRooms(): void {
		console.log('joining rooms...');
		this.wsService.joinRoom(this.roomGameState);
		this.wsService.joinRoom(this.roomMaster);
		if (this.roomBank) {
			this.wsService.joinRoom(this.roomBank);
		}
	}

	private setupMasterSocketListeners(): void {
		console.log('setup Master SocketListeners');

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

		this.wsService.on(IO.TIMER_LEFT, (millisecondsRemaining: number) => {
			this.handleTimerLeft(millisecondsRemaining);
			this.timerTickSubject.next();
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

		this.wsService.on(IO.GAME.RESUMED, () => {
			const currentState = this.gameStateSubject.getValue();
			this.gameStateSubject.next({ ...currentState, status: GAME_STATUS.PLAYING });
		});

		this.wsService.on(IO.GAME.PAUSED, () => {
			this.pauseTimer();
			const currentState = this.gameStateSubject.getValue();
			this.gameStateSubject.next({ ...currentState, status: GAME_STATUS.PAUSED });
		});

		this.wsService.on(IO.GAME.DEATH_IS_COMING, () => {
			// Death event — component handles dialog
		});

		this.wsService.on(IO.GAME.CURRENT_DU, (data) => {
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				currentGameState.currentDU = data.du;
				this.gameStateSubject.next(currentGameState);
			}
		});
	}

	private setupPlayersSocketListeners(): void {
		console.log('setup Player SocketListeners');

		this.wsService.on(IO.PLAYER.DIED, (event: any) => {
			const deadIdx = event.playerStateIdx ?? event.receiver;
			const currentStates = this.playersStatesSubject.getValue();
			const updated = currentStates.map((p) => {
				if (p.idx == deadIdx) {
					return { ...p, status: PLAYER_STATUS.DEAD };
				}
				return p;
			});
			this.playersStatesSubject.next(updated);

			const credits = this.creditsSubject.getValue();
			credits.map((c) => {
				if (c.playerStateIdx === deadIdx && c.status === CREDIT_STATUS.FAULT) {
					this.dialog.closeAll();
				}
				return c;
			});
		});

		this.wsService.on(IO.PLAYER.REINCARNATED, (event: any) => {
			// A life died and a new one was appended server-side: re-pull to add the new life
			// and reflect the shrunk death queue, then notify the cockpit for a snackbar.
			this.refreshMasterState();
			this.reincarnationSubject.next(event);
		});

		this.wsService.on(IO.AVATAR.UPDATED, () => {
			// Avatar updated event — could refresh player list
			window.location.reload();
		});
		this.wsService.on(IO.PLAYER.PROGRESS_PRISON, async (data: any) => {
			// Server sends { playerStateIdx, progress } every 5s (and once immediately on imprisonment).
			// Rebuild the array immutably + re-emit so playersAC$ (distinctUntilChanged) recomputes the
			// rows; also force the row into PRISON so the table reflects it live and after a refresh.
			const updated = this.playersStatesSubject.getValue().map((p) =>
				p.idx == data.playerStateIdx
					? { ...p, status: PLAYER_STATUS.PRISON, progressPrison: data.progress }
					: p
			);
			this.playersStatesSubject.next(updated);
		});
		this.wsService.on(IO.PLAYER.PRISON_ENDED, async (data: any) => {
			this.snackbarService.showSuccess(this.i18n.instant('EVENTS.PRISON_ENDED'));
			const updated = this.playersStatesSubject.getValue().map((p) =>
				p.idx == data.playerStateIdx ? { ...p, status: PLAYER_STATUS.ALIVE, progressPrison: 0 } : p
			);
			this.playersStatesSubject.next(updated);
		});
		this.wsService.on(IO.PLAYER.CONNECTED, (data) => {
			console.log('room connected ws:', data);
			this.updatePlayerConnectionStatus(data, true);
		});

		this.wsService.on(IO.PLAYER.DISCONNECTED, (data) => {
			console.log('room disconnected ws:', data);
			this.updatePlayerConnectionStatus(data, false);
		});

		this.wsService.on(IO.PLAYER.CONNECTIONS_SNAPSHOT, (snapshot: { idx: number; isConnected: boolean; lastSeen: Date }[]) => {
			console.log('connections snapshot ws:', snapshot);
			const current = this.connectedPlayersSubject.getValue();
			const updated = current.map((conn) => {
				const found = snapshot.find((s) => s.idx === conn.idx);
				return found ? { ...conn, isConnected: found.isConnected, lastSeen: found.lastSeen } : conn;
			});
			this.connectedPlayersSubject.next(updated);
		});
		this.wsService.on(IO.PLAYER.DISTRIB_DU, async (data: any) => {
			console.log('room distrib du ws:', data);
		});
	}

	private setupBankSocketListener(): void {
		console.log('setup Bank SocketListener');

		this.wsService.on(IO.GAME.DELETED, async (data: { gameStateId: string }) => {
			console.log('game deleted ws:', data);
			if (data.gameStateId === this.gameStateId) {
				//redirect to lobby session
				this.router.navigate(['/session', this.sessionId]);
			}
		});

		this.wsService.on(IO.CREDIT.STARTED, async (data: { id: string }) => {
			_.forEach(this.creditsSubject.getValue(), (c) => {
				if (c.id === data.id) {
					c.status = CREDIT_STATUS.RUNNING;
				}
			});
		});
		this.wsService.on(IO.CREDIT.PROGRESS, async (data: { id: string; remainingTime: number }) => {
			const updatedCredits = this.creditsSubject.getValue().map((c) => {
				if (c.id === data.id) {
					return { ...c, status: CREDIT_STATUS.RUNNING, remainingTime: data.remainingTime };
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
		});
		this.wsService.on(IO.CREDIT.DONE, async (data: any) => {
			const currentStates = this.gameStateSubject.getValue();
			currentStates.currentMassMonetary = data.currentMassMonetary;
			currentStates.bankInterestEarned = data.bankInterestEarned;
			currentStates.bankMoneyLost = data.bankMoneyLost;
			currentStates.bankMoneyDestroyed = data.bankMoneyDestroyed;
			currentStates.bankGoodsEarned = data.bankGoodsEarned;
			this.gameStateSubject.next(currentStates);

			const credits = this.creditsSubject.getValue();
			_.forEach(credits, (c) => {
				if (c.id == data.id) {
					c.status = data.status;
				}
			});
		});
		this.wsService.on(IO.CREDIT.EXTENDED, async (data: any) => {
			const currentStates = this.gameStateSubject.getValue();
			const credits = this.creditsSubject.getValue();
			_.forEach(credits, (c) => {
				if (c.id == data.id) {
					c.status = data.status;
					c.extended = data.extended;
					c.progress = 0;
					currentStates.currentMassMonetary = currentStates.currentMassMonetary
						? currentStates.currentMassMonetary - c.interest
						: currentStates.currentMassMonetary;
				}
			});
			this.creditsSubject.next(credits);
			this.gameStateSubject.next(currentStates);
		});
		this.wsService.on(IO.CREDIT.REQUEST, async (data: any) => {
			const credits = this.creditsSubject.getValue();
			_.forEach(credits, (c) => {
				if (c.id == data.credit.id) {
					c.status = data.credit.status;
					c.remainingTime = data.credit.remainingTime;
				}
			});
			this.creditsSubject.next(credits);
		});
		this.wsService.on(IO.CREDIT.FAULT, async (data: any) => {
			// Backend emits { credit } per faulted credit (same shape as the player room).
			// Rebuild immutably + zero the timer so the chip's progress bar clears and the
			// blinking FAULT state shows; emitting is what makes the table's rows$ recompute.
			const updatedCredits = this.creditsSubject.getValue().map((c) => {
				if (c.id === data.credit.id) {
					return { ...c, status: data.credit.status, remainingTime: 0, progress: 0 };
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
			this.snackbarService.showError(this.i18n.instant('CREDIT.DEFAULT_CREDIT_MESSAGE'));
		});
		this.wsService.on(IO.CREDIT.SEIZURE, async (data: any) => {
			// Manual seizure's animator-side state is already patched directly from the seize
			// dialog's own RPC response (seizureOnCredit) — this listener exists so Auto Seizure,
			// which has no initiating client to patch state, still updates the table for everyone
			// (docs/adr/0005-auto-seizure.md). Backend sends `credits` (a FIFO-resolved batch) or
			// `credit` (never both) — normalize either shape. Player PRISON status is not handled
			// here; it already arrives generically via IO.PLAYER.PROGRESS_PRISON.
			const resolvedCredits: Credit[] = data.credits ?? (data.credit ? [data.credit] : []);
			const resolvedIds = new Set(resolvedCredits.map((c) => c.id));
			const updatedCredits = this.creditsSubject.getValue().map((c) =>
				resolvedIds.has(c.id) ? { ...c, status: CREDIT_STATUS.DONE, remainingTime: 0, progress: 0 } : c
			);
			this.creditsSubject.next(updatedCredits);

			if (data.bankIndicators) {
				const currentStates = this.gameStateSubject.getValue();
				currentStates.currentMassMonetary = data.bankIndicators.currentMassMonetary;
				currentStates.bankInterestEarned = data.bankIndicators.bankInterestEarned;
				currentStates.bankMoneyLost = data.bankIndicators.bankMoneyLost;
				currentStates.bankMoneyDestroyed = data.bankIndicators.bankMoneyDestroyed;
				currentStates.bankGoodsEarned = data.bankIndicators.bankGoodsEarned;
				this.gameStateSubject.next(currentStates);
			}
		});
	}

	offAll(): void {
		// Don't remove handlers from the map - they need to persist for socket reconnection
		// Only remove from the actual socket
		this.wsService.off(IO.AVATAR.UPDATED);
		this.wsService.off(IO.PLAYER.CONNECTED);
		this.wsService.off(IO.PLAYER.DISCONNECTED);
		this.wsService.off(IO.PLAYER.CONNECTIONS_SNAPSHOT);
		this.wsService.off(IO.TIMER_LEFT);
		this.wsService.off(IO.GAME.STOPPED);
		this.wsService.off(IO.GAME.STARTED);
		this.wsService.off(IO.GAME.PAUSED);
		this.wsService.off(IO.GAME.DELETED);
		this.wsService.off(IO.GAME.CURRENT_DU);
		this.wsService.off(IO.GAME.DEATH_IS_COMING);
		this.wsService.off(IO.PLAYER.DIED);
		this.wsService.off(IO.PLAYER.REINCARNATED);
		this.wsService.off(IO.CREDIT.EXTENDED);
		this.wsService.off(IO.CREDIT.STARTED);
		this.wsService.off(IO.CREDIT.PROGRESS);
		this.wsService.off(IO.CREDIT.FAULT);
		this.wsService.off(IO.CREDIT.DONE);
		this.wsService.off(IO.CREDIT.SEIZURE);
		this.wsService.off(IO.PLAYER.PROGRESS_PRISON);
		this.wsService.off(IO.PLAYER.PRISON_ENDED);
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

	/**
	 * Re-pull the master's state (players, credits, deathQueue) without re-wiring sockets.
	 * Used after a reincarnation, which appends a new life and shrinks the death queue.
	 */
	refreshMasterState(): void {
		if (!this.gameStateId) return;
		this.get(this.gameStateId, true).subscribe((payload) => {
			if (!payload?.gameState) return;
			this.gameStateSubject.next(payload.gameState);
			this.playersStatesSubject.next(payload.gameState.playersStates);
			if (payload.connectedPlayers) this.connectedPlayersSubject.next(payload.connectedPlayers);
			if (payload.gameState.credits) this.creditsSubject.next(payload.gameState.credits);
		});
	}

	init(gameStateId: string): Observable<any> {
		return new Observable((observer) => {
			this.http
				.post<any>(environment.API_HOST + environment.GAME_STATE.INIT, { gameStateId })
				.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.DISTRIBUTE_CARDS')))
				.subscribe((data) => {
					if (data.status == 'done') {
						this.gameStateSubject.next(data.gameState);
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

	startGame(gameStateId: string): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.START, { gameStateId })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.START_ROUND')));
	}

	resumeGame(gameStateId: string): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.RESUME, { gameStateId })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.RESUME_GAME')));
	}

	pauseGame(gameStateId: string): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.PAUSE, { gameStateId })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.PAUSE_GAME')));
	}

	stopGame(gameStateId: string): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.STOP, { gameStateId })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.PAUSE_GAME')));
	}

	refreshPlayer(gameStateId: string, playerStateIdx: number): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.REFRESH_PLAYER, { gameStateId, playerStateIdx })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.REFRESH')));
	}

	refreshAllPlayers(gameStateId: string): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.REFRESH_ALL, { gameStateId })
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.REFRESH')));
	}

	/**
	 * Handle TIMER_LEFT socket event.
	 */
	private handleTimerLeft(millisRemaining: number): void {
		const gameState = this.gameStateSubject.getValue();
		if (millisRemaining && gameState.status === GAME_STATUS.PLAYING) {
			this.startTimer(millisRemaining);
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
					const rules = this.rulesSubject.getValue();
					const totalRoundSeconds = (rules.roundMinutes || 0) * 60;
					const secondsRemaining = s + m * 60;
					this.minutesSubject.next(mm);
					this.secondsSubject.next(ss);
					this.timerProgressSubject.next(totalRoundSeconds > 0 ? (secondsRemaining / totalRoundSeconds) * 100 : 0);
				},
				done: () => {
					// Timer done - component can subscribe to this event
				},
			}
		);
	}

	/**
	 * Start the timer countdown.
	 */
	startTimer(remainingMs: number): void {
		if (remainingMs > 0) {
			const totalSeconds = Math.floor(remainingMs / 1000);
			this.timer.set({ h: 0, m: 0, s: totalSeconds });
			this.timer.reset();
			this.timer.start();
		}
	}

	/**
	 * Pause the timer.
	 */
	pauseTimer(): void {
		this.timer.stop();
	}

	/**
	 * Show the full round from the rules when the gameState has no timer yet
	 * (game not started / reset). Clears any running interval first.
	 */
	resetTimerToRules(): void {
		const rules = this.rulesSubject.getValue();
		const totalSeconds = (rules?.roundMinutes || 0) * 60;
		this.timer.stop();
		this.timer.set({ h: 0, m: 0, s: totalSeconds });
		this.timer.reset();
	}

	/**
	 * Set paused timer state.
	 */
	setPausedTimer(remainingMs: number): void {
		if (remainingMs > 0) {
			const totalSeconds = Math.floor(remainingMs / 1000);
			this.timer.set({ h: 0, m: 0, s: totalSeconds });
			this.timer.reset();
			// this.timer.stop();
		}
	}

	/**
	 * Stop the timer.
	 */
	stopTimer(): void {
		this.timer.stop();
		this.timer.reset();
		this.timer.set({ h: 0, m: 0, s: 0 });
		this.timerProgressSubject.next(0);
		this.minutesSubject.next('00');
		this.secondsSubject.next('00');
	}

	/**
	 * Apply a local coins delta to one player row so the table view's balance stays live —
	 * bank actions (credit, free money, seizure) only broadcast to the player's own device
	 * (playerState room), not to the animator/table room, so the table must patch itself.
	 */
	private applyPlayerCoinsDelta(playerStateIdx: number, delta: number): void {
		const updated = this.playersStatesSubject
			.getValue()
			.map((p) => (p.idx === playerStateIdx ? { ...p, coins: (p.coins ?? 0) + delta } : p));
		this.playersStatesSubject.next(updated);
	}

	/**
	 * Update player connection status.
	 */
	updatePlayerConnectionStatus(data: any, isConnected: boolean): void {
		const currentConnections = this.connectedPlayersSubject.getValue();
		const updatedConnections = currentConnections.map((connection) => {
			return connection.idx === data.idx ? { ...connection, isConnected } : connection;
		});
		this.connectedPlayersSubject.next(updatedConnections);
	}

	createCredit(contrat: { playerIdx: number; amount: number; interest: number; playerName: string }): void {
		this.bankService
			.contractCredit({
				playerStateIdx: contrat.playerIdx,
				amount: contrat.amount,
				interest: contrat.interest,
				gameStateId: this.gameStateId,
			})
			.subscribe((res: any) => {
				this.snackbarService.showSuccess(
					this.i18n.instant('CONTRACT.CREDIT_SUCCESS', {
						player: contrat.playerName,
					})
				);
				const credits = this.creditsSubject.getValue();
				credits.push(res.data.credit);
				this.creditsSubject.next(credits);
				const gameState = this.gameStateSubject.getValue();
				// The backend nests this under bankIndicators — reading it flat always left it undefined.
				gameState.currentMassMonetary = res.data.bankIndicators?.currentMassMonetary;
				this.gameStateSubject.next(gameState);
				this.applyPlayerCoinsDelta(contrat.playerIdx, res.data.credit.amount);
			});
	}

	cancelCredit(credit: Credit) {
		this.bankService.cancelCredit(this.gameStateId, credit.id).subscribe((res: any) => {
			this.snackbarService.showSuccess(this.i18n.instant('CREDIT.CANCELED'));
			const credits = this.creditsSubject.getValue();
			const updatedCredits = credits.map((c) => (c.id === credit.id ? res.data.credit : c));
			this.creditsSubject.next(updatedCredits);
		});
	}

	// Auto-bank: animator broadcasts the opening First Credit Question to all players.
	askFirstCreditQuestion(gameStateId: string) {
		return this.bankService.askFirstCreditQuestion(gameStateId);
	}

	giveFreeMoney(give: any) {
		this.bankService.giveFreeMoney(this.gameStateId, give.playerStateIdx, give.amount).subscribe((data: any) => {
			this.snackbarService.showSuccess(
				this.i18n.instant('FREEMONEY.SUCCESS', {
					playerName: give.playerName,
					amount: give.amount,
				})
			);
			if (data) {
				const gameState = this.gameStateSubject.getValue();
				gameState.currentMassMonetary = data.data.bankIndicators?.currentMassMonetary;
				this.gameStateSubject.next(gameState);
				this.applyPlayerCoinsDelta(give.playerStateIdx, give.amount);
			}
		});
	}

	seizureOnCredit(seizure: any, credit: Credit) {
		const playerStateIdx = credit.playerStateIdx;
		this.bankService.seizure(this.gameStateId, credit.id, playerStateIdx, seizure).subscribe((data: any) => {
			this.snackbarService.showSuccess(this.i18n.instant('DIALOG.SEIZURE.SUCCESS'));
			if (data?.data) {
				const response = data.data;
				// Update credit status to DONE
				const currentGameState = this.gameStateSubject.value;
				if (currentGameState.credits) {
					const creditIdx = currentGameState.credits.findIndex((c) => c.id === credit.id);
					if (creditIdx >= 0) {
						currentGameState.credits[creditIdx].status = CREDIT_STATUS.DONE;
						currentGameState.credits[creditIdx].endAt = new Date();
					}
				}
				// Update mass monetary
				if (currentGameState.currentMassMonetary && response.seizure) {
					currentGameState.currentMassMonetary -= response.seizure.coins;
				}
				this.gameStateSubject.next(currentGameState);
				if (response.seizure) {
					this.applyPlayerCoinsDelta(playerStateIdx, -response.seizure.coins);
				}

				// The table view's credit column reads from creditsSubject, not gameState.credits —
				// without this the credit kept showing its pre-seizure (warning/fault) status.
				const updatedCredits = this.creditsSubject.getValue().map((c) =>
					c.id === credit.id ? { ...c, status: CREDIT_STATUS.DONE, endAt: new Date() } : c
				);
				this.creditsSubject.next(updatedCredits);
			}
		});
	}

    prisonBreak(playerStateIdx: number){
        this.bankService.prisonBreak(this.gameStateId, playerStateIdx).subscribe(() => {
			this.snackbarService.showSuccess(this.i18n.instant('EVENTS.BREAK_FREE'));
		});
    }

	creditForAll() {
		this.http
			.post<any>(environment.API_HOST + environment.BANK_STATE.CREDIT_FOR_ALL, {
				gameStateId: this.gameStateId,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.BANK.CONTRACT')))
			.subscribe((res: any) => {
				this.snackbarService.showSuccess(this.i18n.instant('BANK.CREDIT_FOR_ALL_SUCCESS'));
				if (res?.data) {
					const credits = this.creditsSubject.getValue();
					const byId = new Map(credits.map((c) => [c.id, c]));
					(res.data.credits ?? []).forEach((c: Credit) => byId.set(c.id, c));
					this.creditsSubject.next(Array.from(byId.values()));
					if (res.data.currentMassMonetary !== undefined) {
						const gameState = this.gameStateSubject.getValue();
						gameState.currentMassMonetary = res.data.currentMassMonetary;
						this.gameStateSubject.next(gameState);
					}
				}
			});
	}

	killPlayer(playerStateIdx: number) {
		this.http
			.post<any>(environment.API_HOST + environment.GAME_STATE.KILL_PLAYER, {
				gameStateId: this.gameStateId,
				playerStateIdx,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR, 'ERROR.KILL_PLAYER')))
			.subscribe(() => {
				// IO.PLAYER.DIED socket (master room) updates the player list live.
				this.snackbarService.showSuccess(this.i18n.instant('MASTER.KILL_SUCCESS'));
			});
	}
}
