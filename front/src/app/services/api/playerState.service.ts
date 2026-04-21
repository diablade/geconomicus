import { Injectable, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { PlayerState, GameState, Card, Credit } from '../../models/gameState';
import { Rules } from '../../models/rules';
import { environment } from '../../../environments/environment';
import { ERROR_RELOAD, ErrorService } from '../error.service';
import { WebSocketService } from '../web-socket.service';
import { IO, GAME_STATUS, PLAYER_STATUS, CREDIT_STATUS, GAME_TYPE } from '@geco/shared';
import { BankService } from './bank.service';
import { DeckService } from './deck.service';
import { ThemesService } from '../themes.service';
import { Router } from '@angular/router';
import _ from 'lodash';

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
	private prisonSubject = new BehaviorSubject<boolean>(false);
	prison$ = this.prisonSubject.asObservable();
	private defaultCreditSubject = new BehaviorSubject<boolean>(false);
	defaultCredit$ = this.defaultCreditSubject.asObservable();

	private sessionId: string = '';
	private gameStateId: string = '';
	private avatarIdx: number = 0;
	private playerStateIdx: number = 0;

	private roomGameState: string = '';
	private roomPlayerState: string = '';

	setPlayerState(playerState: PlayerState) {
		this.playerStateSubject.next(playerState);
	}
	setGameState(gameState: GameState) {
		this.gameStateSubject.next(gameState);
	}
	setRules(rules: Rules) {
		this.rulesSubject.next(rules);
	}
	setCards(cards: Card[]) {
		console.log('set cards', cards);
		this.cardsSubject.next(cards);
	}
	setCredits(credits: Credit[]) {
		this.creditsSubject.next(credits);
	}
	setPrison(prison: boolean) {
		this.prisonSubject.next(prison);
	}
	setDefaultCredit(defaultCredit: boolean) {
		this.defaultCreditSubject.next(defaultCredit);
	}

	constructor(
		private http: HttpClient,
		private errorService: ErrorService,
		private wsService: WebSocketService,
		private bankService: BankService,
		private themesService: ThemesService,
		private deckService: DeckService,
		private router: Router
	) {}

	loadPlayerState(sessionId: string, gameStateId: string, avatarIdx: number, playerStateIdx: number): void {
		this.sessionId = sessionId;
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
					this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.GAME_NOT_FOUND');
					this.router.navigate(['/avatar', sessionId, avatarIdx]);
					return [];
				})
			)
			.subscribe((data) => {
				this.setPlayerState(data.playerState);
				this.setGameState(data.gameState);
				this.setRules(data.rules);
				this.setCards(data.cards);
				this.setCredits(data.credits);
				this.setPrison(data.prison);
				this.setDefaultCredit(data.defaultCredit);
			});
		this.initializeSocket(sessionId, gameStateId, avatarIdx, playerStateIdx);
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

	initializeSocket(sessionId: string, gameStateId: string, avatarIdx: number, playerStateIdx: number): void {
		this.sessionId = sessionId;
		this.gameStateId = gameStateId;
		this.avatarIdx = avatarIdx;
		this.playerStateIdx = playerStateIdx;
		this.roomGameState = gameStateId;
		this.roomPlayerState = `${gameStateId}:${avatarIdx}:${playerStateIdx}`;
		this.setupSocketListeners();
	}

	private setupSocketListeners(): void {
		this.wsService.on('connected', () => {
			// if avatarService is connected it should come here to connect other rooms
			console.log('Joining game states rooms...');
			this.joinRooms();
		});

		// Error handling
		this.wsService.on('error', (error: any) => {
			console.error('Socket error:', error);
			if (error && error.message && error.message.includes('timeout')) {
				// Handle socket timeout
				window.location.reload();
			}
		});

		// Resync event
		this.wsService.on('resync', (data: any) => {
			if (data.needsResync) {
				this.loadPlayerState(this.sessionId, this.gameStateId, this.avatarIdx, this.playerStateIdx);
			}
		});


		// Game events
		this.wsService.on(IO.PLAYER.INIT, async (data: any, cb: (response: any) => void) => {
			console.log('PLAYER.INIT', data);
			cb({ status: 'ok', _ackId: data._ackId });
			const currentPlayerState = this.playerStateSubject.getValue();
			if (currentPlayerState) {
				currentPlayerState.coins = data.coins;
				this.playerStateSubject.next(currentPlayerState);
			}
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState) {
				this.gameStateSubject.next({ ...currentGameState, ...data.gameState });
			}
			this.setCards(data.cards);
		});

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

		this.wsService.on(IO.PLAYER.DIED, async () => {
			const currentPlayerState = this.playerStateSubject.getValue();
			if (currentPlayerState) {
				currentPlayerState.status = PLAYER_STATUS.DEAD;
				this.playerStateSubject.next(currentPlayerState);
			}
			this.setCards([]);
			const currentGameState = this.gameStateSubject.getValue();
			if (currentGameState && currentGameState.typeMoney === GAME_TYPE.DEBT) {
				currentPlayerState.coins = 0;
				this.playerStateSubject.next(currentPlayerState);
			}
			this.setPrison(true);
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

		// Transaction events
		this.wsService.on(IO.TRANSACTION_DONE, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', _ackId: data._ackId });
			const currentPlayerState = this.playerStateSubject.getValue();
			if (currentPlayerState) {
				currentPlayerState.coins = data.coins;
				this.playerStateSubject.next(currentPlayerState);
			}
			const currentCards = this.cardsSubject.getValue();
			const updatedCards = currentCards.filter((c) => c.key !== data.idCardSold);
			this.setCards(updatedCards);
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

		// Prison events
		this.wsService.on(IO.PLAYER.PROGRESS_PRISON, async (data: any) => {
			// Handle prison progress - emit event for component to handle timer
		});

		this.wsService.on(IO.PLAYER.PRISON_ENDED, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', _ackId: data._ackId });
			this.setPrison(false);
			if (data && data.cards) {
				this.setCards(data.cards);
			}
		});

		this.wsService.on(IO.CREDIT.SEIZURE, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', _ackId: data._ackId });
			const currentCards = this.cardsSubject.getValue();
			const updatedCards = currentCards.filter((c) => !data.seizure.cards.some((sc: any) => sc.key === c.key));
			this.setCards(updatedCards);
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

	sendBuyingShortCode(gameStateId: string, playerStateIdx: number, code: string): void {
		this.wsService.emit(IO.SHORT_CODE.EMIT, { code, idBuyer: playerStateIdx }, (ack: any) => {
			console.log(ack);
		});
	}

	transaction(idGame: string, idBuyer: string, idSeller: any, idCard: any): Observable<any> {
		return this.http
			.post<any>(environment.API_HOST + environment.PLAYER.TRANSACTION, {
				idGame,
				idBuyer,
				idSeller,
				idCard,
			})
			.pipe(catchError((err) => this.errorService.handleError(err, ERROR_RELOAD, 'ERROR.TRANSACTION')));
	}

	buy(dataRaw: string): Observable<{ success: boolean; error?: string; data?: any }> {
		return new Observable((observer) => {
			try {
				const data = JSON.parse(dataRaw);
				const gameState = this.gameStateSubject.getValue();
				const playerState = this.playerStateSubject.getValue();
				const rules = this.rulesSubject.getValue();

				const cost = rules.typeMoney === GAME_TYPE.JUNE ? (data.p * gameState.currentDU).toFixed(2) : data.p;

				if (this.gameStateId && data.g && this.gameStateId !== data.g) {
					observer.next({ success: false, error: 'PLAYER.WRONG_GAME' });
					observer.complete();
					return;
				}

				if (!playerState || playerState.coins < parseFloat(cost.toString())) {
					observer.next({ success: false, error: 'PLAYER.INSUFFICIENT_FUNDS' });
					observer.complete();
					return;
				}

				this.transaction(this.gameStateId!, playerState!.idx.toString(), data.o, data.c).subscribe({
					next: (dataReceived) => {
						if (dataReceived?.buyedCard) {
							const currentCards = this.cardsSubject.getValue();
							const newCards = [...currentCards, dataReceived.buyedCard];
							this.setCards(newCards);

							if (playerState) {
								playerState.coins = dataReceived.coins;
								this.playerStateSubject.next({ ...playerState });
							}
							observer.next({ success: true, data: dataReceived });
						} else {
							observer.next({ success: false, error: 'PLAYER.NO_CARD_RECEIVED' });
						}
						observer.complete();
					},
					error: (err) => {
						observer.next({ success: false, error: 'PLAYER.TRANSACTION_ERROR' });
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
								c.endDate = data.endDate;
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
						this.setCards(updatedCards);

						// Add the new cards
						const allCards = [...updatedCards, ...newCards];
						this.setCards(allCards);

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
