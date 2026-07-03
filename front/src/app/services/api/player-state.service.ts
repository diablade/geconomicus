import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, combineLatest, debounceTime, distinctUntilChanged, from, map, Observable } from 'rxjs';
import { GameState, Card, Credit } from '../../models/gameState';
import { Rules } from '../../models/rules';
import { environment } from '../../../environments/environment';
import { ERROR, ERROR_RELOAD, ErrorService } from '../error.service';
import { WebSocketService } from '../web-socket.service';
import { IO, GAME_STATUS, PLAYER_STATUS, CREDIT_STATUS, GAME_TYPE, ROOMS, GameType, PlayerStatus } from '@geco/shared';
import { BankService } from './bank.service';
import { DeckService } from './deck.service';
import { ThemesService } from '../themes.service';
import { Router } from '@angular/router';
import _ from 'lodash';
import { ShortCode } from 'src/app/models/shortCode';
import { SnackbarService } from '../snackbar.service';
import { I18nService } from '../i18n.service';
import { AudioService } from '../audio.service';
import { InformationDialogComponent } from 'src/app/dialogs/information-dialog/information-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from 'src/app/dialogs/confirm-dialog/confirm-dialog.component';
import { CongratsDialogComponent } from 'src/app/dialogs/congrats-dialog/congrats-dialog.component';

@Injectable({
	providedIn: 'root',
})
export class PlayerStateService {
	private typeMoneySubject = new BehaviorSubject<GameType>(GAME_TYPE.JUNE);
	typeMoney$ = this.typeMoneySubject.asObservable();
	private playerStatusSubject = new BehaviorSubject<PlayerStatus>(PLAYER_STATUS.ALIVE);
	playerStatus$ = this.playerStatusSubject.asObservable();
	playerConnection$ = inject(WebSocketService).connectionStatus$;

	private coinsSubject = new BehaviorSubject<number>(0);
	coins$ = this.coinsSubject.asObservable();
	private cardsSubject = new BehaviorSubject<Card[]>([]);
	rawCards$ = this.cardsSubject.asObservable();
	private actionTokensSubject = new BehaviorSubject<number>(1);
	actionTokens$ = this.actionTokensSubject.asObservable();
	private creditsSubject = new BehaviorSubject<Credit[]>([]);
	credits$ = this.creditsSubject.asObservable();

	private gameStateSubject = new BehaviorSubject<GameState>(new GameState());
	gameState$ = this.gameStateSubject.asObservable();
	private rulesSubject = new BehaviorSubject<Rules>(new Rules());
	rules$ = this.rulesSubject.asObservable();
	private avatarsSubject = new BehaviorSubject<{ idx: number; name: string; image: string }[]>([]);
	avatars$ = this.avatarsSubject.asObservable();

	private sessionId = '';
	private gameStateId = '';
	private avatarIdx = 0;
	private playerStateIdx = 0;

	private roomGameState = '';
	private roomPlayerState = '';

	private isProducing = false;
	public shortCode: ShortCode | undefined;

	typeTheme$ = inject(ThemesService).typeTheme$;

	cards$ = combineLatest({
		cards: this.rawCards$,
		typeTheme: this.typeTheme$,
	}).pipe(
		debounceTime(0),
		distinctUntilChanged((a, b) => {
			console.log('comparing', a, b);
			if (!_.isEqual(a.typeTheme, b.typeTheme)) {
				console.log('typeTheme changed', a.typeTheme, b.typeTheme);
				return false;
			}
			if (a.cards.length !== b.cards.length) {
				console.log('cards length changed', a.cards.length, b.cards.length);
				return false;
			}
			if (!_.isEqual(a.cards, b.cards)) {
				console.log('cards changed', a.cards, b.cards);
				return false;
			}
			console.log('no change');
			return true;
		}),
		map(({ cards, typeTheme }: { cards: Card[]; typeTheme: string }) => {
			let annotated;
            const countByResult = _.countBy(cards, (c: Card) => this.cardKeyCount(c));
            const keyDuplicates: string[] = [];

			if (typeTheme !== 'CARD') {
				annotated = _.orderBy(cards, ['weight', 'letter'], ['asc', 'asc']).map((c) => {
					const countKey = this.cardKeyCount(c);
					const count = countByResult[countKey] || 0;
					const existCountKey = keyDuplicates.find((k) => k === countKey);
					if (count >= 1 && !existCountKey) {
						keyDuplicates.push(countKey);
					}
					return { ...c, count };
				});
			} else {
				annotated = _.orderBy(cards, ['letter', 'weight'], ['asc', 'asc']).map((c) => {
					const countKey = this.cardKeyCount(c);
					const count = countByResult[countKey] || 0;
					const existCountKey = keyDuplicates.find((k) => k === countKey);
					let displayed = c.displayed;
					if (count > 1 && existCountKey) displayed = false;
					if (count >= 1 && !existCountKey) {
						keyDuplicates.push(countKey);
						displayed = true;
					}
					return { ...c, count, displayed };
				});
			}

			return _.orderBy(annotated, ['count', 'weight', 'letter'], ['desc', 'asc', 'asc']);
		})
	);

	cardKeyCount(card: Card): string {
		return `${card.weight}-${card.letter}`;
	}

	constructor(
		private http: HttpClient,
		private dialog: MatDialog,
		private errorService: ErrorService,
		private wsService: WebSocketService,
		private audioService: AudioService,
		private bankService: BankService,
		private deckService: DeckService,
		private snackbarService: SnackbarService,
		private i18nService: I18nService,
		private themeService: ThemesService,
		private router: Router
	) {}

	loadPlayerState(sessionId: string, gameStateId: string, avatarIdx: number, playerStateIdx: number): void {
		this.offAll();
		this.sessionId = sessionId;
		this.gameStateId = gameStateId;
		this.avatarIdx = avatarIdx;
		this.playerStateIdx = playerStateIdx;
		this.roomGameState = ROOMS.gameState(gameStateId);
		this.roomPlayerState = ROOMS.playerState(gameStateId, playerStateIdx);
		this.http
			.get<any>(
				environment.API_HOST +
					environment.PLAYER_STATE.GET +
					sessionId +
					'/' +
					gameStateId +
					'/' +
					avatarIdx +
					'/' +
					playerStateIdx
			)
			.pipe(
				catchError((err) => {
					// Redirect to lobby-player on error
					this.errorService.handleError(err, ERROR, 'ERROR.GAME_NOT_FOUND');
					this.router.navigate(['/avatar', sessionId, avatarIdx]);
					return [];
				})
			)
			.subscribe((data) => {
				this.coinsSubject.next(data.playerState.coins);
				this.playerStatusSubject.next(data.playerState.status);
				this.typeMoneySubject.next(data.playerState.typeMoney);
				this.cardsSubject.next(data.playerState.cards);
				this.actionTokensSubject.next(data.playerState.actionTokens ?? 1);
				this.creditsSubject.next(data.credits);
				if (data.avatars) this.avatarsSubject.next(data.avatars);

				this.gameStateSubject.next(data.gameState);
				this.rulesSubject.next(data.rules);

				const requestingCredits = data.credits.filter((c: Credit) => c.status === CREDIT_STATUS.REQUESTING);
				for (const credit of requestingCredits) {
					this.confirmSettleOrExtend(credit);
				}
			});
		this.setupMiscSocketListeners();
		this.setupGameSocketListeners();
		this.setupPlayerSocketListeners();
		this.setupMoneySocketListeners();
		if (this.wsService.isConnected()) {
			this.joinRooms();
		}
	}

	leaveRooms(): void {
		if (this.gameStateId) {
			this.wsService.leaveRoom(this.roomGameState);
			this.wsService.leaveRoom(this.roomPlayerState);
		}
	}
	private joinRooms(): void {
		console.log('Joining game states rooms...');
		this.wsService.joinRoom(this.roomGameState);
		this.wsService.joinRoom(this.roomPlayerState);
	}
	getCurrency() {
		return this.i18nService.instant(
			this.gameStateSubject.value?.typeMoney === GAME_TYPE.DEBT ? 'CURRENCY.EURO' : 'CURRENCY.JUNE'
		);
	}
	private setupMiscSocketListeners(): void {
		this.wsService.on('connected', () => {
			// if avatarService is connected it should come here to connect other rooms
			console.log('Joining game states rooms...');
			this.joinRooms();
		});

		// Resync event
		this.wsService.on('resync', (data: any) => {
			if (data.needsResync) {
				console.log('Resync needed, reloading player state...');
				this.loadPlayerState(this.sessionId, this.gameStateId, this.avatarIdx, this.playerStateIdx);
			}
		});

		this.wsService.on(IO.REFRESH_FORCE, async (data: any, cb: (response: any) => void) => {
			cb?.({ status: 'ok', _ackId: data._ackId });
			this.loadPlayerState(this.sessionId, this.gameStateId, this.avatarIdx, this.playerStateIdx);
		});

		this.wsService.on(IO.SESSION.UPDATED_RULES, async (data: any) => {
			if (data) {
				window.location.reload();
			}
		});
	}
	private setupGameSocketListeners(): void {
		this.wsService.on(IO.GAME.STARTED, async () => {
			console.log('game started');
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				currentGameState.status = GAME_STATUS.PLAYING;
				this.gameStateSubject.next(currentGameState);
			}
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.status === CREDIT_STATUS.PAUSED || c.status === CREDIT_STATUS.IDLE) {
					c.status = CREDIT_STATUS.RUNNING;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
			this.snackbarService.showNotif(this.i18nService.instant('GAME.STARTED'));
		});

		this.wsService.on(IO.GAME.PAUSED, async () => {
			console.log('game paused');
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				currentGameState.status = GAME_STATUS.PAUSED;
				this.gameStateSubject.next(currentGameState);
			}
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.status === CREDIT_STATUS.RUNNING) {
					c.status = CREDIT_STATUS.PAUSED;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
			this.snackbarService.showNotif(this.i18nService.instant('GAME.PAUSED'));
		});

		this.wsService.on(IO.GAME.RESUMED, async () => {
			console.log('game resumed');
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				currentGameState.status = GAME_STATUS.PLAYING;
				this.gameStateSubject.next(currentGameState);
			}
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.status === CREDIT_STATUS.PAUSED) {
					c.status = CREDIT_STATUS.RUNNING;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
			this.snackbarService.showNotif(this.i18nService.instant('GAME.RESUMED'));
		});

		this.wsService.on(IO.GAME.STOPPED, async () => {
			console.log('game stopped');
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				currentGameState.status = GAME_STATUS.STOPPED;
				this.gameStateSubject.next(currentGameState);
			}
			this.dialog
				.open(InformationDialogComponent, {
					data: {
						title: this.i18nService.instant('EVENTS.GAME_ENDED'),
						message: this.i18nService.instant('EVENTS.GAME_ENDED_MESSAGE'),
						message2: this.i18nService.instant('EVENTS.SURVEY_MESSAGE'),
						disableClose: true,
					},
				})
				.afterClosed()
				.subscribe(() => {
					this.router.navigate(['/survey', this.sessionId, this.gameStateId, this.avatarIdx, 'false']);
				});
		});

		this.wsService.on(IO.GAME.DELETED, async (data: any) => {
			console.log('game deleted', data);
			if (data.gameStateId == this.gameStateId) {
				//redirect to lobby
				this.router.navigate(['/avatar', this.sessionId, this.avatarIdx]);
			}
		});

		this.wsService.on(IO.GAME.RESET, async (data: any) => {
			// Handle game reset
			window.location.reload();
		});

		this.wsService.on(IO.GAME.FIRST_DU, async (data: any) => {
			console.log('first du', data);
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				currentGameState.currentDU = data.du;
				this.gameStateSubject.next(currentGameState);
			}
		});
	}
	private setupPlayerSocketListeners(): void {
		this.wsService.on(IO.PLAYER.INIT, async (data: any, cb: (response: any) => void) => {
			console.log('PLAYER.INIT', data);
			cb?.({ status: 'ok', _ackId: data._ackId });
			this.coinsSubject.next(data.playerState.coins);
			this.cardsSubject.next(data.playerState.cards);

			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				this.gameStateSubject.next({ ...currentGameState, status: data.status, currentDU: data.currentDU });
			}
			if (currentGameState?.typeMoney === GAME_TYPE.JUNE) {
				this.audioService.playSound('du');
			} else {
				this.audioService.playSound('cardFlipBack');
			}
			this.dialog.open(InformationDialogComponent, {
				data: {
					message: this.i18nService.instant(
						currentGameState.typeMoney === GAME_TYPE.DEBT ? 'PLAYER.INIT_DEBT' : 'PLAYER.INIT',
						{
							cardsLength: data.playerState.cards.length,
							coins: data.playerState.coins,
							currency: this.getCurrency(),
						}
					),
				},
			});
		});

		this.wsService.on(IO.PLAYER.DISTRIB_DU, (data: any, cb: (response: any) => void) => {
			console.log('distrib du', data);
			if (cb) {
				cb?.({ status: 'ok', _ackId: data._ackId });
			}
			this.coinsSubject.next(data.coinsLK);
			this.audioService.playSound('du');

			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				currentGameState.currentDU = data.du;
				this.gameStateSubject.next(currentGameState);
			}
		});

		this.wsService.on(IO.PLAYER.PROGRESS_PRISON, async (data: any) => {
			// Handle prison progress - emit event for component to handle timer
		});

		this.wsService.on(IO.PLAYER.PRISON_ENDED, async (data: any, cb: (response: any) => void) => {
			console.log('prison ended', data);
			cb?.({ status: 'ok', _ackId: data._ackId });
			this.cardsSubject.next(data.cards);
			this.playerStatusSubject.next(PLAYER_STATUS.ALIVE);
		});

		this.wsService.on(IO.PLAYER.DIED, async () => {
			this.playerStatusSubject.next(PLAYER_STATUS.DEAD);
		});
	}
	private setupMoneySocketListeners(): void {
		this.wsService.on(IO.SHORT_CODE.BROADCAST, (data: any) => {
			console.log('ShortCode Broadcast', data);
			if (this.shortCode && this.shortCode.code === data.code && this.gameStateId === data.gameStateId) {
				console.log('ShortCode Broadcast confirming ownership ', data);
				this.wsService.emit(IO.SHORT_CODE.CONFIRMED, {
					...data,
					sellerIdx: this.playerStateIdx,
					payload: this.shortCode.payload,
				});
			}
		});

		this.wsService.on(IO.SHORT_CODE.CONFIRMED, async (data: any) => {
			console.log('ShortCodeConfirmed', data);
			if (data && data.payload) {
				this.buy(data.payload).subscribe({
					next: (result) => {
						if (result.success) {
							console.log('ShortCodeConfirmed - Buy successful');
							this.audioService.playSound('cardFlipBack');
						} else {
							console.log('ShortCodeConfirmed - Buy failed', result.error);
							this.snackbarService.showNotif(this.i18nService.instant(result.error || 'ERROR.UNKNOWN'));
							this.audioService.playSound('error');
						}
					},
					error: (error) => {
						console.log('ShortCodeConfirmed - Buy error', error);
						this.audioService.playSound('error');
					},
				});
			}
		});

		this.wsService.on(IO.PLAYER.TRANSACTION_DONE, async (data: any, cb: (response: any) => void) => {
			console.log('transaction done', data);
			cb?.({ status: 'ok', _ackId: data._ackId });
			if (Number(this.playerStateIdx) === Number(data.sellerIdx)) {
				this.coinsSubject.next(data.coinsLK);
				const updatedCards = this.cardsSubject.getValue().filter((c: Card) => c.key !== data.cardKey);
				this.cardsSubject.next(updatedCards);
			}
		});

		// Action events
		this.wsService.on(IO.PLAYER.ACTION_DONE, async (data: any, cb: (response: any) => void) => {
			cb?.({ status: 'ok', _ackId: data._ackId });
			// card arriving (give / ong)
            const avatar = this.avatarsSubject.getValue().find(a => a.idx==data.fromAvatarIdx);
			if (data.card) {
				const cards = this.cardsSubject.getValue();
				this.cardsSubject.next([...cards, data.card]);
				this.dialog.open(InformationDialogComponent, {
					data: {
						message: this.i18nService.instant('ACTION.RECEIVED_GIVE', { fromName: avatar?.name }),
					},
				});
			}
			if (data.cards) {
				const cards = this.cardsSubject.getValue();
				this.cardsSubject.next([...cards, ...data.cards]);
				this.dialog.open(InformationDialogComponent, {
					data: {
						message: this.i18nService.instant('ACTION.RECEIVED_ONG', {
							fromName: avatar?.name,
							count: data.cards.length,
						}),
					},
				});
			}
		});

		this.wsService.on(IO.PLAYER.ACTION_ROBBED, async (data: any, cb: (response: any) => void) => {
			cb?.({ status: 'ok', _ackId: data._ackId });
			// Remove stolen card(s) from local state
			const stolenKeys: string[] = data.card ? [data.card.key] : (data.cards || []).map((c: Card) => c.key);
			const updatedCards = this.cardsSubject.getValue().filter((c: Card) => !stolenKeys.includes(c.key));
			this.cardsSubject.next(updatedCards);
			if (!data.silent) {
				const msgKey = data.actionKey === 'war' ? 'ACTION.ROBBED_WAR' : 'ACTION.ROBBED_STEAL';
				this.dialog.open(InformationDialogComponent, {
					data: { message: this.i18nService.instant(msgKey) },
				});
			}
		});

		// Credit events
		this.wsService.on(IO.CREDIT.NEW, async (data: any, cb: (response: any) => void) => {
			console.log('new credit', data);
			cb?.({ status: 'ok', _ackId: data._ackId });
			const currentCredits = this.creditsSubject.getValue();
			currentCredits.push(data.credit);
			this.creditsSubject.next(currentCredits);
			this.coinsSubject.next(data.coinsLK);
			this.audioService.playSound('coins');

			this.dialog.open(InformationDialogComponent, {
				data: {
					message: this.i18nService.instant('CREDIT.NEW', {
						amount: data.credit.amount,
						interest: data.credit.interest,
					}),
				},
			});
		});

		this.wsService.on(IO.CREDIT.FREE_MONEY, async (data: any, cb: (response: any) => void) => {
			console.log('free money', data);
			cb?.({ status: 'ok', _ackId: data._ackId });
			this.coinsSubject.next(data.coinsLK);
			this.audioService.playSound('coins');
			this.dialog.open(InformationDialogComponent, {
				data: {
					message: this.i18nService.instant('CREDIT.FREE_MONEY', { amount: data.amount }),
				},
			});
		});

		this.wsService.on(
			IO.CREDIT.CANCELED,
			async (data: { credit: Credit; coinsLK: number; _ackId: any }, cb: (response: any) => void) => {
				console.log('credit canceled', data);
				cb?.({ status: 'ok', _ackId: data._ackId });
				const currentCredits = this.creditsSubject.getValue();
				const updatedCredits = currentCredits.map((credit) => {
					if (credit.id === data.credit.id) {
						credit.status = data.credit.status;
					}
					return credit;
				});
				this.creditsSubject.next(updatedCredits);
				this.coinsSubject.next(data.coinsLK);
				this.audioService.playSound('interest');

				this.dialog.open(InformationDialogComponent, {
					data: {
						message: this.i18nService.instant('CREDIT.CANCEL_SUCCESS', { amount: data.credit.amount }),
					},
				});
			}
		);

		this.wsService.on(IO.CREDIT.STARTED, async (data: { id: string }) => {
			const currentCredits = this.creditsSubject.getValue();
			_.forEach(currentCredits, (c) => {
				if (c.id === data.id) {
					c.status = CREDIT_STATUS.RUNNING;
				}
			});
			this.creditsSubject.next(currentCredits);
		});

		this.wsService.on(IO.CREDIT.PROGRESS, async (data: { id: string; remainingTime: number }) => {
			const updatedCredits = this.creditsSubject.getValue().map((c) => {
				if (c.id === data.id) {
					return { ...c, status: CREDIT_STATUS.RUNNING, remainingTime: data.remainingTime };
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
			//TODO if progress is 80% give warning to player
		});

		this.wsService.on(IO.CREDIT.FAULT, async (data: any, cb: (response: any) => void) => {
			cb?.({ status: 'ok', _ackId: data._ackId });
			const updatedCredits = this.creditsSubject.getValue().map((c) => {
				if (c.id === data.credit.id) {
					c.status = data.credit.status;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
		});

		this.wsService.on(IO.CREDIT.DONE, async (data: any, cb: (response: any) => void) => {
			cb?.({ status: 'ok', _ackId: data._ackId });
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.id === data.credit.id) {
					c.status = data.credit.status;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
			this.coinsSubject.next(data.coinsLK);
		});

		this.wsService.on(IO.CREDIT.SEIZURE, async (data: any, cb: (response: any) => void) => {
			cb?.({ status: 'ok', _ackId: data._ackId });
			const updatedCards = this.cardsSubject
				.getValue()
				.filter((c) => !data.seizure.cards.some((sc: any) => sc.key === c.key));
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.id === data.credit.id) {
					c.status = data.credit.status;
				}
				return c;
			});

			this.cardsSubject.next(updatedCards);
			this.creditsSubject.next(updatedCredits);
			this.coinsSubject.next(data.coinsLK);
		});

		this.wsService.on(IO.CREDIT.EXTENDED, async (data: any, cb: (response: any) => void) => {
			cb?.({ status: 'ok', _ackId: data._ackId });
			this.coinsSubject.next(data.coinsLK);
			this.dialog.open(InformationDialogComponent, {
				data: {
					title: this.i18nService.instant('DIALOG.CREDIT_EXTENDED.TITLE'),
					message: this.i18nService.instant('DIALOG.CREDIT_EXTENDED.MESSAGE', {
						amount: data.credit.amount + data.credit.interest,
						interest: data.credit.interest,
					}),
				},
			});
		});

		this.wsService.on(IO.CREDIT.REQUEST, async (data: any, cb: (response: any) => void) => {
			cb?.({ status: 'ok', _ackId: data._ackId });
			this.coinsSubject.next(data.coinsLK);
			this.confirmSettleOrExtend(data.credit);
		});
	}

	// Remove all event listeners to prevent memory leaks
	offAll(): void {
		// playerState service events
		this.wsService.off('connected');
		this.wsService.off('resync');
		this.wsService.off(IO.PLAYER.INIT);
		this.wsService.off(IO.PLAYER.DIED);
		this.wsService.off(IO.PLAYER.PROGRESS_PRISON);
		this.wsService.off(IO.PLAYER.PRISON_ENDED);
		this.wsService.off(IO.PLAYER.DISTRIB_DU);
		this.wsService.off(IO.GAME.STARTED);
		this.wsService.off(IO.GAME.PAUSED);
		this.wsService.off(IO.GAME.RESUMED);
		this.wsService.off(IO.GAME.STOPPED);
		this.wsService.off(IO.GAME.DELETED);
		this.wsService.off(IO.GAME.RESET);
		this.wsService.off(IO.GAME.FIRST_DU);
		this.wsService.off(IO.SESSION.UPDATED_RULES);
		this.wsService.off(IO.REFRESH_FORCE);
		this.wsService.off(IO.PLAYER.TRANSACTION_DONE);
		this.wsService.off(IO.PLAYER.ACTION_DONE);
		this.wsService.off(IO.PLAYER.ACTION_ROBBED);
		this.wsService.off(IO.CREDIT.NEW);
		this.wsService.off(IO.CREDIT.FREE_MONEY);
		this.wsService.off(IO.CREDIT.CANCELED);
		this.wsService.off(IO.CREDIT.STARTED);
		this.wsService.off(IO.CREDIT.PROGRESS);
		this.wsService.off(IO.CREDIT.FAULT);
		this.wsService.off(IO.CREDIT.DONE);
		this.wsService.off(IO.CREDIT.SEIZURE);
		this.wsService.off(IO.CREDIT.EXTENDED);
		this.wsService.off(IO.SHORT_CODE.BROADCAST);
		this.wsService.off(IO.SHORT_CODE.CONFIRMED);
	}

	confirmSettleOrExtend(credit: Credit) {
		const confDialogRef = this.dialog.open(ConfirmDialogComponent, {
			disableClose: true,
			data: {
				title: this.i18nService.instant('DIALOG.CREDIT_SETTLE_EXTEND.TITLE'),
				message: this.i18nService.instant('DIALOG.CREDIT_SETTLE_EXTEND.MESSAGE', {
					amount: credit.amount + credit.interest,
				}),
				message2: this.i18nService.instant('DIALOG.CREDIT_SETTLE_EXTEND.MESSAGE2', {
					interest: credit.interest,
				}),
				labelBtnConfirm: this.i18nService.instant('DIALOG.CREDIT_SETTLE_EXTEND.BTN_EXTEND'),
				labelBtnCancel: this.i18nService.instant('DIALOG.CREDIT_SETTLE_EXTEND.BTN_SETTLE'),
				requestBeep: true,
				styleBtnConfirm: 'primary',
				styleBtnCancel: 'warn',
			},
		});
		confDialogRef.afterClosed().subscribe((result) => {
			if (result && result == 'btnConfirm') {
				this.extendCredit(credit);
			} else if (result && result === 'btnCancel') {
				this.settleCredit(credit);
			}
		});
	}

	transaction(gameStateId: string, buyerIdx: string, sellerIdx: any, cardKey: any): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.PLAYER_STATE.TRANSACTION, {
				gameStateId,
				buyerIdx,
				sellerIdx,
				cardKey,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.TRANSACTION')));
	}

	sendBuyingShortCode(code: string): void {
		console.log('emit buying ShortCode', code);
		if (!this.gameStateId || !this.playerStateIdx) {
			this.snackbarService.showError(this.i18nService.instant('ERROR.ID_PLAYER_MISSING'));
			return;
		}
		this.wsService.emit(IO.SHORT_CODE.EMIT, {
			code,
			buyerIdx: this.playerStateIdx,
			buyerAvatarIdx: this.avatarIdx,
			gameStateId: this.gameStateId,
		});
	}

	buy(dataRaw: string): Observable<{ success: boolean; error?: string; data?: any }> {
		return new Observable((observer) => {
			try {
				const data = JSON.parse(dataRaw);
				const gameState = this.gameStateSubject.getValue();
				const coins = this.coinsSubject.getValue();
				const rules = this.rulesSubject.getValue();

				const cost = rules.typeMoney === GAME_TYPE.JUNE ? (data.p * gameState.currentDU).toFixed(2) : data.p;

				if (this.gameStateId && data.g && this.gameStateId !== data.g) {
					observer.next({ success: false, error: 'ERROR.WRONG_GAME' });
					observer.complete();
					return;
				}

				if (coins < parseFloat(cost.toString())) {
					observer.next({ success: false, error: 'ERROR.INSUFFICIENT_FUNDS' });
					observer.complete();
					return;
				}

				this.transaction(this.gameStateId, this.playerStateIdx.toString(), data.o, data.k).subscribe({
					next: (data) => {
						if (data?.buyedCard) {
							const cards = this.cardsSubject.getValue();
							this.cardsSubject.next([...cards, data.buyedCard]);
							this.coinsSubject.next(data.coinsLK);
							observer.next({ success: true, data: data });
						} else {
							observer.next({ success: false, error: 'PLAYER.NO_CARD_RECEIVED' });
						}
						observer.complete();
					},
					error: (error) => {
						observer.next({ success: false, error });
						observer.complete();
					},
				});
			} catch (e) {
				observer.next({ success: false, error: 'parse_error' });
				observer.complete();
			}
		});
	}

	settleCredit(credit: Credit): void {
		if (
			this.gameStateSubject.getValue().status !== GAME_STATUS.PLAYING &&
			this.gameStateSubject.getValue().status !== GAME_STATUS.PAUSED &&
			this.playerStatusSubject.getValue() !== PLAYER_STATUS.ALIVE
		) {
			this.snackbarService.showError(this.i18nService.instant('PLAYER.NOT_ALIVE_OR_GAME_NOT_PLAYING'));
			return;
		}

		const coins = this.coinsSubject.getValue();
		if (coins < credit.amount + credit.interest) {
			this.snackbarService.showError(this.i18nService.instant('PLAYER.INSUFFICIENT_FUNDS'));
			return;
		}

		this.bankService.settleCredit(this.gameStateId, this.playerStateIdx, credit.id).subscribe({
			next: (data) => {
				if (data) {
					const currentCredits = this.creditsSubject.getValue();
					const updatedCredits = currentCredits.map((c) => {
						if (c.id === data.id) {
							c.status = data.status;
							c.remainingTime = data.remainingTime;
						}
						return c;
					});
					this.creditsSubject.next(updatedCredits);
					this.coinsSubject.next(data.coinsLK);
					this.snackbarService.showSuccess(this.i18nService.instant('CREDIT.CREDIT_SETTLED'));
					this.audioService.playSound('interest');
				} else {
					this.snackbarService.showError(this.i18nService.instant('PLAYER.SETTLE_FAILED'));
				}
			},
			error: (err) => {
				this.snackbarService.showError(this.i18nService.instant(err.error || 'ERROR.UNKNOWN'));
				this.audioService.playSound('error');
			},
		});
	}

	extendCredit(credit: Credit): void {
		if (
			this.gameStateSubject.getValue().status !== GAME_STATUS.PLAYING &&
			this.gameStateSubject.getValue().status !== GAME_STATUS.PAUSED &&
			this.playerStatusSubject.getValue() !== PLAYER_STATUS.ALIVE
		) {
			this.snackbarService.showError(this.i18nService.instant('PLAYER.NOT_ALIVE_OR_GAME_NOT_PLAYING'));
			return;
		}

		const coins = this.coinsSubject.getValue();
		if (coins < credit.interest) {
			this.snackbarService.showError(this.i18nService.instant('PLAYER.INSUFFICIENT_FUNDS'));
			return;
		}

		this.bankService.extendCredit(this.gameStateId, this.playerStateIdx, credit.id).subscribe({
			next: (response) => {
				if (response) {
					const currentCredits = this.creditsSubject.getValue();
					const updatedCredits = currentCredits.map((c) => {
						if (c.id === response.data.credit.id) {
							c.status = response.data.credit.status;
							c.remainingTime = response.data.credit.remainingTime;
						}
						return c;
					});
					this.creditsSubject.next(updatedCredits);
					this.coinsSubject.next(response.data.coinsLK);
					this.snackbarService.showSuccess(this.i18nService.instant('CREDIT.EXTENDED'));
					this.audioService.playSound('interest');
				} else {
					this.snackbarService.showError(this.i18nService.instant('PLAYER.EXTEND_FAILED'));
				}
			},
			error: (err) => {
				this.snackbarService.showError(this.i18nService.instant(err.error || 'ERROR.UNKNOWN'));
				this.audioService.playSound('error');
			},
		});
	}

	produce(letter: string, weight: number): void {
		const rules = this.rulesSubject.getValue();
		const cards = this.cardsSubject.getValue();
		if (!rules || !cards) {
			this.snackbarService.showError(this.i18nService.instant('PLAYER.INVALID_STATE'));
			return;
		}

		if (this.playerStatusSubject.getValue() !== PLAYER_STATUS.ALIVE) {
			this.snackbarService.showError(this.i18nService.instant('PLAYER.NOT_ALIVE'));
			return;
		}
		if (this.gameStateSubject.getValue().status !== GAME_STATUS.PLAYING) {
			this.snackbarService.showError(this.i18nService.instant('PLAYER.GAME_NOT_PLAYING'));
			return;
		}

		const identicalCards = cards.filter((c) => c.letter === letter && c.weight === weight);

		if (identicalCards.length < rules.amountCardsForProd) {
			this.snackbarService.showError(this.i18nService.instant('PLAYER.INSUFFICIENT_CARDS'));
			return;
		}

		const cardsForProd = identicalCards.slice(0, rules.amountCardsForProd);
		const gameStateId = this.gameStateId;

		if (!gameStateId || !this.playerStateIdx) {
			this.snackbarService.showError(this.i18nService.instant('PLAYER.INVALID_IDS'));
			return;
		}

		this.isProducing = true;
		this.deckService.produce(gameStateId, this.playerStateIdx.toString(), cardsForProd).subscribe({
			next: (result: any) => {
				if (result.status === 'ok') {
					this.showProduction(result.producedCard, result.newCard);
					this.cardsSubject.next(result.cardsLK);
					if (result.result?.actionTokens != null) {
						this.actionTokensSubject.next(result.result.actionTokens);
					}
				} else {
					this.snackbarService.showError(this.i18nService.instant(result.error || 'ERROR.UNKNOWN'));
					this.audioService.playSound('error');
				}
				this.isProducing = false;
			},
			error: (err) => {
				this.snackbarService.showError(this.i18nService.instant(err.error || 'ERROR.UNKNOWN'));
				this.audioService.playSound('error');
				this.isProducing = false;
			},
		});
	}

	refreshActionResult(result: { actionKey: string; result: any }) {
		if (!result?.result) return;
		if (result.result.cardsLK != null) {
			this.cardsSubject.next(result.result.cardsLK);
		}
		if (result.result.actionTokens != null) {
			this.actionTokensSubject.next(result.result.actionTokens);
		}
	}

	showProduction(producedCard: Card, newCards: Card[]) {
		this.dialog.open(CongratsDialogComponent, {
			hasBackdrop: true,
			backdropClass: 'bgBlur',
			data: {
				text:
					producedCard.weight > 2
						? this.i18nService.instant('EVENTS.TECHNOLOGY')
						: this.i18nService.instant('EVENTS.GIFT'),
				producedCard,
				newCards,
				theme: this.themeService.getCurrentTheme(),
			},
			width: '10px',
			height: '10px',
		});
	}
}
