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
import { GameState, PlayerState, Credit, ConnectionStatus, Card } from '../../models/gameState';
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
	private roomTable = '';

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

	loadForMaster(sessionId: string, gameStateId: string, isTable = false): void {
		this.sessionId = sessionId;
		this.gameStateId = gameStateId;
		this.roomGameState = ROOMS.gameState(gameStateId);
		this.roomMaster = ROOMS.gameStateMaster(gameStateId);

		this.setupMasterSocketListeners();
		this.setupPlayersSocketListeners();
		if (isTable) {
			this.setupTableSocketListener();
			this.roomTable = ROOMS.gameStateTable(gameStateId);
		}

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
		this.stopTimer();
		if (this.gameStateId) {
			this.wsService.leaveRoom(this.roomGameState);
			this.wsService.leaveRoom(this.roomMaster);
			if (this.roomTable) {
				this.wsService.leaveRoom(this.roomTable);
			}
		}
	}

	leaveTableRoom(): void {
		this.wsService.leaveRoom(this.roomTable);
	}

	private joinRooms(): void {
		console.log('joining rooms...');
		this.wsService.joinRoom(this.roomGameState);
		this.wsService.joinRoom(this.roomMaster);
		if (this.roomTable) {
			this.wsService.joinRoom(this.roomTable);
		}
	}

	private setupMasterSocketListeners(): void {
		console.log('setup Master SocketListeners');

		this.wsService.on('connected', (data: any) => {
			console.log('connected, joining other rooms...', data);
			this.joinRooms();
		});

		this.wsService.on('disconnect', () => {
			console.log('Master board disconnected, will reconnect...');
			setTimeout(() => {
				if (this.wsService.isConnected()) {
					console.log('Master board reconnecting to rooms...');
					this.joinRooms();
					this.refreshMasterState();
				}
			}, 2000);
		});

		this.wsService.on(IO.GAME.DELETED, async (data: { gameStateId: string }) => {
			console.log('game deleted ws:', data);
			if (data.gameStateId === this.gameStateId) {
				this.router.navigate(['/session', this.sessionId]);
			}
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
				if (data.currentMassMonetary !== undefined) {
					currentGameState.currentMassMonetary = data.currentMassMonetary;
				}
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
					const snapshot: Partial<PlayerState> = { status: PLAYER_STATUS.DEAD };
					if (event.coinsLK !== undefined) snapshot.coins = event.coinsLK;
					if (event.cardsLK !== undefined) snapshot.cards = event.cardsLK;
					return { ...p, ...snapshot };
				}
				return p;
			});
			this.playersStatesSubject.next(updated);

			if (event.currentMassMonetary !== undefined) {
				const gs = this.gameStateSubject.getValue();
				gs.currentMassMonetary = event.currentMassMonetary;
				this.gameStateSubject.next(gs);
			}

			const credits = this.creditsSubject.getValue();
			credits.map((c) => {
				if (c.playerStateIdx === deadIdx && c.status === CREDIT_STATUS.FAULT) {
					this.dialog.closeAll();
				}
				return c;
			});
		});

		this.wsService.on(IO.PLAYER.REINCARNATED, (event: any) => {
			this.refreshMasterState();
			this.reincarnationSubject.next(event);
		});

		this.wsService.on(IO.CREDIT.NEW, (data: any) => {
			this.applyBankIndicators(data.bankIndicators);
			this.upsertCredit(data.credit);
		});

		this.wsService.on(IO.CREDIT.CANCELED, (data: any) => {
			this.applyBankIndicators(data.bankIndicators);
			this.upsertCredit(data.credit);
		});

		this.wsService.on(IO.CREDIT.FREE_MONEY, (data: any) => {
			this.applyBankIndicators(data.bankIndicators);
		});

		this.wsService.on(IO.CREDIT.QUESTION_ANSWERED, (data: any) => {
			const updated = this.playersStatesSubject
				.getValue()
				.map((p) =>
					p.idx == data.playerStateIdx ? { ...p, firstCreditAnswer: data.firstCreditAnswer } : p
				);
			this.playersStatesSubject.next(updated);

			if (data.currentMassMonetary !== undefined) {
				const gs = this.gameStateSubject.getValue();
				gs.currentMassMonetary = data.currentMassMonetary;
				this.gameStateSubject.next(gs);
			}
		});

		this.wsService.on(IO.AVATAR.UPDATED, (data: any) => {
			const s = this.sessionSubject.getValue();
			if (s && data?.updatedAvatar) {
				s.avatars = s.avatars.map((a: Avatar) => (a.idx === data.updatedAvatar.idx ? data.updatedAvatar : a));
				this.sessionSubject.next({ ...s });
			}
		});
		this.wsService.on(IO.PLAYER.PROGRESS_PRISON, async (data: any) => {
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
			const byIdx = new Map<number, ConnectionStatus>(
				this.connectedPlayersSubject.getValue().map((conn) => [conn.idx, conn])
			);
			(snapshot ?? []).forEach((s) => {
				const existing = byIdx.get(s.idx);
				byIdx.set(s.idx, {
					...(existing ?? new ConnectionStatus()),
					idx: s.idx,
					isConnected: s.isConnected,
					lastSeen: s.lastSeen ? new Date(s.lastSeen) : null,
				});
			});
			this.connectedPlayersSubject.next(Array.from(byIdx.values()));
		});
		this.wsService.on(IO.PLAYER.DISTRIB_DU, async (data: any) => {
			console.log('room distrib du ws:', data);
		});
	}

	private setupTableSocketListener(): void {
		console.log('setup Table SocketListener');

		this.wsService.on(IO.PLAYER.STATE_SYNC, (data: { players: Partial<PlayerState>[] }) => {
			const byIdx = new Map((data.players ?? []).map((p) => [p.idx, p]));
			const updated = this.playersStatesSubject.getValue().map((p) => {
				const row = byIdx.get(p.idx);
				return row ? { ...p, ...row } : p;
			});
			this.playersStatesSubject.next(updated);
		});

		this.wsService.on(IO.DECKS_STATE_SYNC, (data: { decks: { level: number; cards: Card[] }[] }) => {
			const gs = this.gameStateSubject.getValue();
			if (!gs.decks) return;
			const decks = [...gs.decks];
			(data.decks ?? []).forEach(({ level, cards }) => {
				decks[level] = cards;
			});
			this.gameStateSubject.next({ ...gs, decks });
		});

		this.wsService.on(IO.CREDIT.STARTED, async (data: { id: string }) => {
			const updated = this.creditsSubject.getValue().map((c) =>
				c.id === data.id ? { ...c, status: CREDIT_STATUS.RUNNING } : c
			);
			this.creditsSubject.next(updated);
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
			this.applyBankIndicators(data.bankIndicators);
			const updated = this.creditsSubject.getValue().map((c) =>
				c.id === data.credit.id
					? { ...c, status: data.credit.status, endAt: data.credit.endAt, remainingTime: 0 }
					: c
			);
			this.creditsSubject.next(updated);
		});
		this.wsService.on(IO.CREDIT.EXTENDED, async (data: any) => {
			this.applyBankIndicators(data.bankIndicators);
			const updated = this.creditsSubject.getValue().map((c) =>
				c.id === data.credit.id
					? {
							...c,
							status: data.credit.status,
							extended: data.credit.extended,
							remainingTime: data.credit.remainingTime,
							progress: 0,
					  }
					: c
			);
			this.creditsSubject.next(updated);
		});
		this.wsService.on(IO.CREDIT.REQUEST, async (data: any) => {
			const updated = this.creditsSubject.getValue().map((c) =>
				c.id === data.credit.id
					? { ...c, status: data.credit.status, remainingTime: data.credit.remainingTime }
					: c
			);
			this.creditsSubject.next(updated);
		});
		this.wsService.on(IO.CREDIT.FAULT, async (data: any) => {
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
			const resolvedCredits: Credit[] = data.credits ?? (data.credit ? [data.credit] : []);
			const resolvedIds = new Set(resolvedCredits.map((c) => c.id));
			const updatedCredits = this.creditsSubject.getValue().map((c) =>
				resolvedIds.has(c.id) ? { ...c, status: CREDIT_STATUS.DONE, remainingTime: 0, progress: 0 } : c
			);
			this.creditsSubject.next(updatedCredits);
			this.applyBankIndicators(data.bankIndicators);
		});
	}

	private upsertCredit(credit: Credit | undefined): void {
		if (!credit) return;
		const credits = this.creditsSubject.getValue();
		const known = credits.some((c) => c.id === credit.id);
		this.creditsSubject.next(
			known ? credits.map((c) => (c.id === credit.id ? credit : c)) : [...credits, credit]
		);
	}

	private applyBankIndicators(bi: any): void {
		if (!bi) return;
		const gs = this.gameStateSubject.getValue();
		gs.currentMassMonetary = bi.currentMassMonetary;
		gs.bankInterestEarned = bi.bankInterestEarned;
		gs.bankMoneyLost = bi.bankMoneyLost;
		gs.bankMoneyDestroyed = bi.bankMoneyDestroyed;
		gs.bankGoodsEarned = bi.bankGoodsEarned;
		this.gameStateSubject.next(gs);
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
		this.wsService.off(IO.CREDIT.QUESTION_ANSWERED);
		this.wsService.off(IO.CREDIT.NEW);
		this.wsService.off(IO.CREDIT.CANCELED);
		this.wsService.off(IO.CREDIT.FREE_MONEY);
		this.wsService.off(IO.CREDIT.EXTENDED);
		this.wsService.off(IO.CREDIT.STARTED);
		this.wsService.off(IO.CREDIT.PROGRESS);
		this.wsService.off(IO.CREDIT.FAULT);
		this.wsService.off(IO.CREDIT.DONE);
		this.wsService.off(IO.CREDIT.SEIZURE);
		this.wsService.off(IO.PLAYER.PROGRESS_PRISON);
		this.wsService.off(IO.PLAYER.PRISON_ENDED);
		this.wsService.off(IO.PLAYER.STATE_SYNC);
		this.wsService.off(IO.DECKS_STATE_SYNC);
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
	 * Update player connection status.
	 */
	updatePlayerConnectionStatus(data: any, isConnected: boolean): void {
		const currentConnections = this.connectedPlayersSubject.getValue();
		const known = currentConnections.some((connection) => connection.idx === data.idx);
		const lastSeen = data.lastSeen ? new Date(data.lastSeen) : new Date();
		const updatedConnections = known
			? currentConnections.map((connection) =>
					connection.idx === data.idx ? { ...connection, isConnected, lastSeen } : connection
			  )
			: [...currentConnections, { idx: data.idx, isConnected, lastSeen }];
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
				this.upsertCredit(res.data.credit);
				const gameState = this.gameStateSubject.getValue();
				// The backend nests this under bankIndicators — reading it flat always left it undefined.
				gameState.currentMassMonetary = res.data.bankIndicators?.currentMassMonetary;
				this.gameStateSubject.next(gameState);
				// Borrower's coins arrive via PLAYER_STATE_SYNC on the table room (ADR-0008).
			});
	}

	cancelCredit(credit: Credit) {
		this.bankService.cancelCredit(this.gameStateId, credit.id).subscribe((res: any) => {
			this.snackbarService.showSuccess(this.i18n.instant('CREDIT.CANCELED'));
			this.applyBankIndicators(res.data?.bankIndicators);
			this.upsertCredit(res.data?.credit);
		});
	}

	// Auto-bank: animator broadcasts the opening First Credit Question to all players.
	askFirstCreditQuestion(gameStateId: string) {
		return this.bankService.askFirstCreditQuestion(gameStateId);
	}

	markFirstCreditAsked(): void {
		this.gameStateSubject.next({ ...this.gameStateSubject.getValue(), firstCreditAsked: true });
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
				// Recipient's coins arrive via PLAYER_STATE_SYNC on the table room (ADR-0008).
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
				// The seized player's coins + cards arrive via PLAYER_STATE_SYNC on the table room (ADR-0008).

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
