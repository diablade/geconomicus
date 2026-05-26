import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, combineLatest, debounceTime, distinctUntilChanged, map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ERROR, ErrorService } from '../error.service';
import { GameState, PlayerState, Credit, PlayerConnection } from '../../models/gameState';
import { Rules } from '../../models/rules';
import { Avatar } from '../../models/avatar';
import { Session } from '../../models/session';
import { WebSocketService } from '../web-socket.service';
import { IO, GAME_STATUS, PLAYER_STATUS, CREDIT_STATUS, ROOMS } from '@geco/shared';
import { SessionStorageService } from '../local-storage/session-storage.service';
import { StorageKey } from '../local-storage/storage-key.const';
import createCountdown from '../countDown';
import { SessionService } from './session.service';
import { BankService } from './bank.service';
import _ from 'lodash';
import { SnackbarService } from '../snackbar.service';
import { I18nService } from '../i18n.service';
import { MatDialog } from '@angular/material/dialog';

@Injectable({
	providedIn: 'root',
})
export class GameStateService {
	// Reactive state subjects
	private gameStateSubject = new BehaviorSubject<Partial<GameState>>({});
	gameState$ = this.gameStateSubject.asObservable();

	private rulesSubject = new BehaviorSubject<Rules>(new Rules());
	rules$ = this.rulesSubject.asObservable();

	private sessionSubject = new BehaviorSubject<Session>(new Session());
	session$ = this.sessionSubject.asObservable();

	private playersStatesSubject = new BehaviorSubject<PlayerState[]>([]);
	playersStates$ = this.playersStatesSubject.asObservable();

	private connectedPlayersSubject = new BehaviorSubject<PlayerConnection[]>([]);
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
				connection: connectedPlayers.find((c: PlayerConnection) => c.idx === playerState.idx),
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
		private sessionStorageService: SessionStorageService,
		private snackbarService: SnackbarService,
		private i18n: I18nService,
		private dialog: MatDialog,
		private bankService: BankService,
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
		});
		if (this.wsService.isConnected()) {
			console.log('connected');
			this.joinRooms();
		} else {
			console.log('not connected');
		}
	}

	leaveRooms(): void {
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
	}

	private setupPlayersSocketListeners(): void {
		console.log('setup Player SocketListeners');

		this.wsService.on(IO.PLAYER.DIED, (event: any) => {
			const currentStates = this.playersStatesSubject.getValue();
			const updated = currentStates.map((p) => {
				if (p.idx == event.receiver) {
					return { ...p, status: PLAYER_STATUS.DEAD };
				}
				return p;
			});
			this.playersStatesSubject.next(updated);

			const credits = this.creditsSubject.getValue();
			credits.map((c) => {
				if (c.playerStateIdx === event.receiver && c.status === CREDIT_STATUS.FAULT) {
					this.dialog.closeAll();
				}
				return c;
			});
		});

		this.wsService.on(IO.AVATAR.UPDATED, () => {
			// Avatar updated event — could refresh player list
			window.location.reload();
		});

		this.wsService.on(IO.PLAYER.CONNECTED, (data) => {
			console.log('room connected ws:', data);
			this.updatePlayerConnectionStatus(data, true);
		});

		this.wsService.on(IO.PLAYER.DISCONNECTED, (data) => {
			console.log('room disconnected ws:', data);
			this.updatePlayerConnectionStatus(data, false);
		});
	}

	private setupBankSocketListener(): void {
		console.log('setup Bank SocketListener');

		this.wsService.on(IO.CREDIT.STARTED, async () => {
			_.forEach(this.creditsSubject.getValue(), (c) => {
				if (c.status == CREDIT_STATUS.PAUSED || c.status == CREDIT_STATUS.IDLE) {
					c.status = CREDIT_STATUS.RUNNING;
				}
			});
		});
		this.wsService.on(IO.CREDIT.PROGRESS, async (data: any) => {
			_.forEach(this.creditsSubject.getValue(), (c) => {
				if (c.id == data.id) {
					c.status = CREDIT_STATUS.RUNNING;
					c.progress = data.progress;
				}
			});
		});
		this.wsService.on(IO.CREDIT.DONE, async (data: any) => {
			const currentStates = this.gameStateSubject.getValue();
			currentStates.currentMassMonetary = data.currentMassMonetary;
			currentStates.bankInterestEarned = data.bankInterestEarned;
			currentStates.bankMoneyLost = data.bankMoneyLost;
			currentStates.bankGoodsEarned = data.bankGoodsEarned;
			this.gameStateSubject.next(currentStates);

			const credits = this.creditsSubject.getValue();
			_.forEach(credits, (c) => {
				if (c.id == data.id) {
					c.status = data.status;
				}
			});
		});
		this.wsService.on(IO.CREDIT.TIMEOUT, async (data: any) => {
			_.forEach(this.creditsSubject.getValue(), (c) => {
				if (c.id == data.id) {
					c.status = data.status;
				}
			});
		});
		this.wsService.on(IO.CREDIT.PAYED_INTEREST, async (data: any) => {
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
		this.wsService.on(IO.CREDIT.FAULT, async (data: any) => {
			_.forEach(this.creditsSubject.getValue(), (c) => {
				if (c.playerStateIdx == data.playerStateIdx) {
					c.status = data.status;
				}
			});
			this.snackbarService.showError(this.i18n.instant('CREDIT.DEFAULT_CREDIT_MESSAGE'));
		});
		this.wsService.on(IO.PLAYER.PROGRESS_PRISON, async (data: any) => {
			_.forEach(this.gameStateSubject.getValue().playersStates, (p) => {
				if (p.idx == data.idx) {
					p.progressPrison = data.progress;
				}
			});
		});
		this.wsService.on(IO.PLAYER.PRISON_ENDED, async (data: any) => {
			this.snackbarService.showSuccess(this.i18n.instant('EVENTS.PRISON_ENDED'));
			_.forEach(this.gameStateSubject.getValue().playersStates, (p) => {
				if (p.idx == data.idx) {
					p.status = PLAYER_STATUS.ALIVE;
					p.progressPrison = 0;
				}
			});
		});
	}

	offAll(): void {
		this.wsService.off(IO.AVATAR.UPDATED);
		this.wsService.off(IO.PLAYER.CONNECTED);
		this.wsService.off(IO.PLAYER.DISCONNECTED);
		this.wsService.off(IO.TIMER_LEFT);
		this.wsService.off(IO.GAME.STOPPED);
		this.wsService.off(IO.GAME.STARTED);
		this.wsService.off(IO.GAME.FINISHED);
		this.wsService.off(IO.GAME.DEATH_IS_COMING);
		this.wsService.off(IO.PLAYER.DIED);
		this.wsService.off(IO.CREDIT.PAYED_INTEREST);
		this.wsService.off(IO.CREDIT.STARTED);
		this.wsService.off(IO.CREDIT.PROGRESS);
		this.wsService.off(IO.CREDIT.TIMEOUT);
		this.wsService.off(IO.CREDIT.FAULT);
		this.wsService.off(IO.CREDIT.DONE);
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
		const gameState = this.gameStateSubject.getValue();
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
					const rules = this.rulesSubject.getValue();
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
	updatePlayerConnectionStatus(data: any, isConnected: boolean): void {
		const currentConnections = this.connectedPlayersSubject.getValue();
		const updatedConnections = currentConnections.map((connection) => {
			return connection.idx === data.idx ? { ...connection, isConnected } : connection;
		});
		this.connectedPlayersSubject.next(updatedConnections);
	}

	/**
	 * Set initial timer based on rules.
	 */
	setInitialTimer(roundMinutes: number): void {
		if (roundMinutes > 0) {
			const minutes = roundMinutes > 9 ? roundMinutes.toString() : '0' + roundMinutes.toString();
			this.minutesSubject.next(minutes);

			const timerRemaining = this.sessionStorageService.getItem(StorageKey.timerRemaining);
			const gameState = this.gameStateSubject.getValue();

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
				gameState.currentMassMonetary = res.data.currentMassMonetary;
				this.gameStateSubject.next(gameState);
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

	seizureOnCredit(seizure: any, credit: Credit) {
		this.bankService.seizure(seizure, credit).subscribe((data: any) => {
			this.snackbarService.showSuccess(this.i18n.instant('DIALOG.SEIZURE.SUCCESS'));
			if (data) {
				// this.gameState.credits = _.map(this.gameState.credits, (c) => {
				// if (c.idx == data.credit.idx) {
				// return data.credit;
				// } else {
				// return c;
				// }
				// });
				// if (data.prisoner) {
				// this.prisoners.push(data.prisoner);
				// }
				// if (data.seizure) {
				// this.gameState.currentMassMonetary -= seizure.coins;
				// }
			}
		});
	}
}
