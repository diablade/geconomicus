import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { PlayerState, GameState, Card, Credit } from '../../models/gameState';
import { Rules } from '../../models/rules';
import { environment } from '../../../environments/environment';
import { ERROR, ERROR_RELOAD, ErrorService } from '../error.service';
import { WebSocketService } from '../web-socket.service';
import { IO, GAME_STATUS, PLAYER_STATUS, CREDIT_STATUS, GAME_TYPE, ROOMS } from '@geco/shared';
import { BankService } from './bank.service';
import { DeckService } from './deck.service';
import { Router } from '@angular/router';
import _ from 'lodash';
import { ShortCode } from 'src/app/models/shortCode';
import { SnackbarService } from '../snackbar.service';
import { I18nService } from '../i18n.service';
import { AudioService } from '../audio.service';
import { InformationDialogComponent } from 'src/app/dialogs/information-dialog/information-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Injectable({
	providedIn: 'root',
})
export class PlayerStateService {
	private playerStateSubject = new BehaviorSubject<PlayerState>(new PlayerState());
	playerState$ = this.playerStateSubject.asObservable();
	private gameStateSubject = new BehaviorSubject<GameState>(new GameState());
	gameState$ = this.gameStateSubject.asObservable();
	private rulesSubject = new BehaviorSubject<Rules>(new Rules());
	rules$ = this.rulesSubject.asObservable();
	private cardsSubject = new BehaviorSubject<Card[]>([]);
	cards$ = this.cardsSubject.asObservable();
	private creditsSubject = new BehaviorSubject<Credit[]>([]);
	credits$ = this.creditsSubject.asObservable();
	private defaultCreditSubject = new BehaviorSubject<boolean>(false);
	defaultCredit$ = this.defaultCreditSubject.asObservable();

	private sessionId: string = '';
	private gameStateId: string = '';
	private avatarIdx: number = 0;
	private playerStateIdx: number = 0;

	private roomGameState: string = '';
	private roomPlayerState: string = '';

	public shortCode: ShortCode | undefined;

	setPlayerState(playerState: PlayerState) {
		this.playerStateSubject.next(playerState);
	}
	setGameState(gameState: GameState) {
		this.gameStateSubject.next(gameState);
	}
	setRules(rules: Rules) {
		this.rulesSubject.next(rules);
	}
	setCredits(credits: Credit[]) {
		this.creditsSubject.next(credits);
	}
	setDefaultCredit(defaultCredit: boolean) {
		this.defaultCreditSubject.next(defaultCredit);
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
		private router: Router
	) {}

	loadPlayerState(sessionId: string, gameStateId: string, avatarIdx: number, playerStateIdx: number): void {
		this.sessionId = sessionId;
		this.gameStateId = gameStateId;
		this.avatarIdx = avatarIdx;
		this.playerStateIdx = playerStateIdx;
		this.roomGameState = ROOMS.gameState(gameStateId);
		this.roomPlayerState = ROOMS.playerState(gameStateId,avatarIdx,playerStateIdx);
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
				this.setPlayerState(data.playerState);
				this.setGameState(data.gameState);
				this.setRules(data.rules);
				this.setCredits(data.credits);
				this.setDefaultCredit(data.defaultCredit);
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
		this.wsService.joinRoom(this.roomGameState);
		this.wsService.joinRoom(this.roomPlayerState);
	}
    getCurrency() {
        return this.i18nService.instant(this.gameStateSubject.value?.typeMoney === GAME_TYPE.DEBT ? 'CURRENCY.EURO' : 'CURRENCY.JUNE');
    }
	private setupMiscSocketListeners(): void {
		this.wsService.on('connected', () => {
			// if avatarService is connected it should come here to connect other rooms
			console.log('Joining game states rooms...');
			this.joinRooms();
		});

		this.wsService.on('reconnected', () => {
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
			cb({ status: 'ok', _ackId: data._ackId });
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
		});

		this.wsService.on(IO.GAME.STOPPED, async () => {
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				currentGameState.status = GAME_STATUS.STOPPED;
				this.gameStateSubject.next(currentGameState);
			}
		});

		this.wsService.on(IO.GAME.FINISHED, (data: any) => {
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				currentGameState.status = GAME_STATUS.FINISHED;
				this.gameStateSubject.next(currentGameState);
			}
		});

		this.wsService.on(IO.GAME.DELETED, async (data: any) => {
			if (data.gameStateId == this.gameStateId) {
				//redirect to lobby
				this.router.navigate(['/avatar', this.sessionId, this.avatarIdx]);
			}
		});

		this.wsService.on(IO.GAME.DISTRIB_DU, (data: any, cb: (response: any) => void) => {
			if (cb) {
				cb({ status: 'ok', _ackId: data._ackId });
			}
			const currentPlayerState = this.playerStateSubject.getValue();
			if (currentPlayerState) {
				currentPlayerState.coins += data.du;
				this.playerStateSubject.next(currentPlayerState);
			}
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				currentGameState.currentDU = data.du;
				this.gameStateSubject.next(currentGameState);
			}
		});

		this.wsService.on(IO.GAME.RESET, async (data: any) => {
			// Handle game reset
			window.location.reload();
		});

		this.wsService.on(IO.GAME.FIRST_DU, async (data: any) => {
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
			cb({ status: 'ok', _ackId: data._ackId });
			const currentPlayerState = this.playerStateSubject.getValue();
			if (currentPlayerState) {
				this.playerStateSubject.next({ ...currentPlayerState, ...data.playerState });
			}
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
					text: this.i18nService.instant("PLAYER.INIT", { cardsLength: data.playerState.cards.length, coins: data.playerState.coins, currency: this.getCurrency() })
				},
			});
		});

		// Prison events
		this.wsService.on(IO.PLAYER.PROGRESS_PRISON, async (data: any) => {
			// Handle prison progress - emit event for component to handle timer
		});

		this.wsService.on(IO.PLAYER.PRISON_ENDED, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', _ackId: data._ackId });
			if (data && data.cards) {
				const currentPlayerState = this.playerStateSubject.getValue();
				if (currentPlayerState) {
					currentPlayerState.cards = data.cards;
					currentPlayerState.status = PLAYER_STATUS.ALIVE;
					this.playerStateSubject.next({ ...currentPlayerState });
				}
			}
		});

		this.wsService.on(IO.PLAYER.DIED, async () => {
			const currentPlayerState = this.playerStateSubject.getValue();
			if (currentPlayerState) {
				currentPlayerState.status = PLAYER_STATUS.DEAD;
				this.playerStateSubject.next(currentPlayerState);
			}
		});
	}
	private setupMoneySocketListeners(): void {
		this.wsService.on(IO.SHORT_CODE.BROADCAST, (data: any) => {
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
			cb({ status: 'ok', _ackId: data._ackId });
			const currentPlayerState = this.playerStateSubject.getValue();
			if (currentPlayerState?.idx === Number(data.sellerIdx)) {
				this.setPlayerState({
					...currentPlayerState,
					coins: data.coinsAfter,
					cards: currentPlayerState.cards.filter((c: any) => c.key !== data.cardKey),
				});
			}
		});

		// Credit events
		this.wsService.on(IO.CREDIT.NEW, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', _ackId: data._ackId });
			const currentCredits = this.creditsSubject.getValue();
			currentCredits.push(data.credit);
			this.creditsSubject.next(currentCredits);
			const currentPlayerState = this.playerStateSubject.getValue();
			if (currentPlayerState) {
				currentPlayerState.coins += data.credit.amount;
				this.playerStateSubject.next(currentPlayerState);
			}
			this.dialog.open(InformationDialogComponent, {
				data: {
					text: this.i18nService.instant("CREDIT.NEW_CREDIT", {amount: data.credit.amount})
				},
			});
		});

		this.wsService.on(IO.CREDIT.TIMEOUT, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', _ackId: data._ackId });
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.idx === data.credit.idx) {
					c.status = data.credit.status;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
		});

		this.wsService.on(IO.CREDIT.STARTED, async () => {
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.status === CREDIT_STATUS.PAUSED) {
					c.status = CREDIT_STATUS.RUNNING;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
		});

		this.wsService.on(IO.CREDIT.PROGRESS, async (data: any) => {
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.idx === data.id) {
					c.status = CREDIT_STATUS.RUNNING;
					c.progress = data.progress;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
		});

		this.wsService.on(IO.CREDIT.DEFAULT, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', _ackId: data._ackId });
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.idx === data.credit.idx) {
					c.status = data.credit.status;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
			this.setDefaultCredit(true);
		});

		this.wsService.on(IO.CREDIT.DONE, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', _ackId: data._ackId });
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.idx === data.credit.idx) {
					c.status = CREDIT_STATUS.DONE;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
		});

		this.wsService.on(IO.CREDIT.SEIZURE, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', _ackId: data._ackId });
			const currentCards = this.cardsSubject.getValue();
			const updatedCards = currentCards.filter((c) => !data.seizure.cards.some((sc: any) => sc.key === c.key));
			const currentCredits = this.creditsSubject.getValue();
			const updatedCredits = currentCredits.map((c) => {
				if (c.idx === data.credit.idx) {
					c.status = CREDIT_STATUS.DONE;
				}
				return c;
			});
			this.creditsSubject.next(updatedCredits);
			const currentPlayerState = this.playerStateSubject.getValue();
			if (currentPlayerState) {
				currentPlayerState.coins -= data.seizure.coins;
				this.playerStateSubject.next(currentPlayerState);
			}
			this.setDefaultCredit(false);
		});
	}

	// Remove all event listeners to prevent memory leaks
	offAll(): void {
		// playerState service events
		this.wsService.off('resync');
		this.wsService.off(IO.PLAYER.INIT);
		this.wsService.off(IO.PLAYER.DIED);
		this.wsService.off(IO.PLAYER.PROGRESS_PRISON);
		this.wsService.off(IO.PLAYER.PRISON_ENDED);
		this.wsService.off(IO.GAME.STARTED);
		this.wsService.off(IO.GAME.STOPPED);
		this.wsService.off(IO.GAME.FINISHED);
		this.wsService.off(IO.GAME.DELETED);
		this.wsService.off(IO.GAME.DISTRIB_DU);
		this.wsService.off(IO.GAME.RESET);
		this.wsService.off(IO.GAME.FIRST_DU);
		this.wsService.off(IO.SESSION.UPDATED_RULES);
		this.wsService.off(IO.REFRESH_FORCE);
		this.wsService.off(IO.TRANSACTION_DONE);
		this.wsService.off(IO.CREDIT.NEW);
		this.wsService.off(IO.CREDIT.TIMEOUT);
		this.wsService.off(IO.CREDIT.STARTED);
		this.wsService.off(IO.CREDIT.PROGRESS);
		this.wsService.off(IO.CREDIT.DEFAULT);
		this.wsService.off(IO.CREDIT.DONE);
		this.wsService.off(IO.CREDIT.SEIZURE);
		this.wsService.off(IO.SHORT_CODE.BROADCAST);
		this.wsService.off(IO.SHORT_CODE.CONFIRMED);
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
		if (!this.gameStateId || !this.playerStateIdx) {
			this.snackbarService.showError(this.i18nService.instant('ERROR.ID_PLAYER_MISSING'));
			return;
		}
		this.wsService.emit(IO.SHORT_CODE.EMIT, {
			code,
			buyerIdx: this.playerStateIdx!,
			buyerAvatarIdx: this.avatarIdx,
			gameStateId: this.gameStateId!,
		});
	}

	buy(dataRaw: string): Observable<{ success: boolean; error?: string; data?: any }> {
		console.log('here.?');
		return new Observable((observer) => {
			try {
				const data = JSON.parse(dataRaw);
				const gameState = this.gameStateSubject.getValue();
				const playerState = this.playerStateSubject.getValue();
				const rules = this.rulesSubject.getValue();

				const cost = rules.typeMoney === GAME_TYPE.JUNE ? (data.p * gameState.currentDU).toFixed(2) : data.p;

				if (this.gameStateId && data.g && this.gameStateId !== data.g) {
					observer.next({ success: false, error: 'ERROR.WRONG_GAME' });
					observer.complete();
					return;
				}

				if (!playerState || playerState.coins < parseFloat(cost.toString())) {
					observer.next({ success: false, error: 'ERROR.INSUFFICIENT_FUNDS' });
					observer.complete();
					return;
				}

				this.transaction(this.gameStateId!, playerState!.idx.toString(), data.o, data.k).subscribe({
					next: (data) => {
						if (data?.buyedCard) {
							let playerState = this.playerStateSubject.getValue();
							if (playerState) {
								playerState.cards.push(data.buyedCard);
								playerState.coins = data.coinsAfter;
								this.setPlayerState({ ...playerState });
							}
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

	settleCredit(credit: Credit): Observable<{ success: boolean; error?: string; data?: any }> {
		return new Observable((observer) => {
			const playerState = this.playerStateSubject.getValue();

			if (!playerState || playerState.coins < credit.amount + credit.interest) {
				observer.next({ success: false, error: 'PLAYER.INSUFFICIENT_FUNDS' });
				observer.complete();
				return;
			}

			this.bankService.settleCredit(credit).subscribe({
				next: (data) => {
					if (data) {
						const currentCredits = this.creditsSubject.getValue();
						const updatedCredits = currentCredits.map((c) => {
							if (c.idx === data.idx) {
								c.status = data.status;
								c.remainingTime = data.remainingTime;
							}
							return c;
						});
						this.creditsSubject.next(updatedCredits);

						const currentPlayerState = this.playerStateSubject.getValue();
						if (currentPlayerState) {
							currentPlayerState.coins -= data.amount + data.interest;
							currentPlayerState.status = PLAYER_STATUS.ALIVE;
							this.playerStateSubject.next({ ...currentPlayerState });
						}

						observer.next({ success: true, data });
					} else {
						observer.next({ success: false, error: 'PLAYER.SETTLE_FAILED' });
					}
					observer.complete();
				},
				error: (err) => {
					observer.next({ success: false, error: err });
					observer.complete();
				},
			});
		});
	}

	payInterest(credit: Credit): Observable<{ success: boolean; error?: string; data?: any }> {
		return new Observable((observer) => {
			const playerState = this.playerStateSubject.getValue();

			if (!playerState || playerState.coins < credit.interest) {
				observer.next({ success: false, error: 'PLAYER.INSUFFICIENT_FUNDS' });
				observer.complete();
				return;
			}

			this.bankService.payInterest(credit).subscribe({
				next: (data) => {
					if (data) {
						const currentCredits = this.creditsSubject.getValue();
						const updatedCredits = currentCredits.map((c) => {
							if (c.idx === data.idx) {
								c.status = data.status;
								c.extended = data.extended;
								c.progress = 0;
							}
							return c;
						});
						this.creditsSubject.next(updatedCredits);

						const currentPlayerState = this.playerStateSubject.getValue();
						if (currentPlayerState) {
							currentPlayerState.coins -= credit.interest;
							currentPlayerState.status = PLAYER_STATUS.ALIVE;
							this.playerStateSubject.next({ ...currentPlayerState });
						}

						observer.next({ success: true, data });
					} else {
						observer.next({ success: false, error: 'PLAYER.PAY_INTEREST_FAILED' });
					}
					observer.complete();
				},
				error: (err) => {
					observer.next({ success: false, error: 'PLAYER.TRANSACTION_ERROR' });
					observer.complete();
				},
			});
		});
	}

	produce(letter: string, weight: number): Observable<{ success: boolean; error?: string; data?: any }> {
		return new Observable((observer) => {
			const rules = this.rulesSubject.getValue();
			const cards = this.cardsSubject.getValue();
			const playerState = this.playerStateSubject.getValue();

			if (!rules || !cards) {
				observer.next({ success: false, error: 'PLAYER.INVALID_STATE' });
				observer.complete();
				return;
			}

			const identicalCards = cards.filter((c) => c.letter === letter && c.weight === weight);

			if (identicalCards.length < rules.amountCardsForProd) {
				observer.next({ success: false, error: 'PLAYER.INSUFFICIENT_CARDS' });
				observer.complete();
				return;
			}

			const cardsForProd = identicalCards.slice(0, rules.amountCardsForProd);
			const gameStateId = this.gameStateId;
			const playerIdx = playerState?.idx?.toString();

			if (!gameStateId || !playerIdx) {
				observer.next({ success: false, error: 'PLAYER.INVALID_IDS' });
				observer.complete();
				return;
			}

			this.deckService.produce(gameStateId, playerIdx, cardsForProd).subscribe({
				next: (newCards) => {
					if (newCards) {
						// Remove the used cards
						const updatedCards = cards.filter((c) => !cardsForProd.some((used) => used.key === c.key));

						// Add the new cards
						const allCards = [...updatedCards, ...newCards];

						// Check for gift card
						const cardGift = newCards.find((c) => c.weight === weight + 1);

						observer.next({ success: true, data: { newCards, cardGift } });
					} else {
						observer.next({ success: false, error: 'PLAYER.PRODUCE_FAILED' });
					}
					observer.complete();
				},
				error: (err) => {
					observer.next({ success: false, error: err });
					observer.complete();
				},
			});
		});
	}
}
