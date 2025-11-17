import {createAvatar, Options} from '@dicebear/core';
import {adventurer} from '@dicebear/collection';
import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subscription, Observable} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {Card, Credit, Game, Player} from "../models/game";
import {BackService} from "../services/back.service";
import {MatDialog} from "@angular/material/dialog";
import {I18nService} from "../services/i18n.service";
import * as _ from 'lodash-es';
import {
	faClipboardCheck,
	faFileContract,
	faCreditCardAlt,
	faHandHoldingHand
} from "@fortawesome/free-solid-svg-icons";
import {SnackbarService} from "../services/snackbar.service";
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
import {ConfirmDialogComponent} from "../dialogs/confirm-dialog/confirm-dialog.component";
import {CongratsDialogComponent} from "../dialogs/congrats-dialog/congrats-dialog.component";
import {ScannerDialogV3Component} from "../dialogs/scanner-dialog-v3/scanner-dialog-v3.component";
// @ts-ignore
import * as C from "../../../../config/constantes";
import {ShortCode} from "../models/shortCode";
import {Recipe, Ingredient, getAvailableRecipes} from "../models/recipe";
import {ShortcodeDialogComponent} from "../dialogs/shortcode-dialog/shortcode-dialog.component";
import {WebSocketService} from "../services/web-socket.service";
import {GameInfosDialog} from "../components/notice-btn/notice-btn.component";
import createCountdown from "../services/countDown";
import {LocalStorageService} from "../services/local-storage/local-storage.service";
import {AudioService} from '../services/audio.service';
import {animations} from "../services/animations";
import {ThemesService} from '../services/themes.service';
import {ActionDialogComponent} from '../dialogs/action-dialog/action-dialog.component';

@Component({
	selector: 'app-player-board',
	templateUrl: './player-board.component.html',
	animations,
	styleUrls: ['./player-board.component.scss']
})
export class PlayerBoardComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	private socket: any;
	screenWidth = 0;
	screenHeight = 0;
	idGame: string | undefined;
	idPlayer: string | undefined;
	player: Player = new Player();
	private subscription: Subscription | undefined;
	options: Partial<adventurer.Options & Options> = {};
	game: Game = new Game();
	typeTheme$ = this.themesService.typeTheme$;
	cards: Card[] = [];
	credits: Credit[] = [];
	recipes: Recipe[] = [];
	faFileContract = faFileContract;
	faClipboardCheck = faClipboardCheck;
	faCreditCardAlt = faCreditCardAlt;
	faHandHoldingHand = faHandHoldingHand;
	scanV3 = true;
	flipCoin = false;
	panelCreditOpenState = false;
	panelRecipeOpenState = false;
	C = C;
	prison = false;
	defaultCredit = false;
	prisonProgress = 0;
	minutesPrison = 5;
	secondsPrison = 0;
	shortCode: ShortCode | undefined;
	isBuying = false;
	isProducing = false;
	prisonTimer = createCountdown({h: 0, m: 0, s: 0}, {
		listen: ({hh, mm, ss, s, h, m}) => {
			this.minutesPrison = m;
			this.secondsPrison = s;
		},
		done: () => {
			this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.PRISON_END"));
		}
	});

	constructor(private route: ActivatedRoute,
	            public dialog: MatDialog,
	            private router: Router,
	            private localStorageService: LocalStorageService,
	            private backService: BackService,
	            private wsService: WebSocketService,
	            private i18nService: I18nService,
	            private themesService: ThemesService,
	            private audioService: AudioService,
	            private snackbarService: SnackbarService) {
	}

	updateScreenSize() {
		// Listen for window resize events to update the dimensions if the screen size changes
		this.screenWidth = window.innerWidth;
		this.screenHeight = window.innerHeight;
		window.addEventListener('resize', this.updateScreenSize.bind(this));
	}

	ngOnInit(): void {
		this.updateScreenSize();
		this.scanV3 = this.localStorageService.getItem("scanV3");
		this.panelCreditOpenState = this.localStorageService.getItem("panelCredit") == undefined ? false : this.localStorageService.getItem("panelCredit");
		this.panelRecipeOpenState = this.localStorageService.getItem("panelRecipe") == undefined ? true : this.localStorageService.getItem("panelRecipe");
		this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			this.idPlayer = params['idPlayer'];
			this.subscription = this.wsService.getReConnectionStatus().subscribe(data => {
				if (data) {
					this.refresh();
				}
			});
			this.socket = this.wsService.getSocket(this.idGame, this.idPlayer);

			// Setup error handling for socket timeouts
			this.socket.on('error', (error: any) => {
				console.error('Socket error:', error);
				if (error && error.message && error.message.includes('timeout')) {
					this.handleSocketTimeout();
				}
			});

			this.getPlayerInfos();
		});
	}

	/**
	 * Handle socket timeout by forcing a complete page reload
	 */
	private handleSocketTimeout() {
		this.snackbarService.showError(this.i18nService.instant("ERROR.CONNECTION_EXPIRED"));

		// Set a short delay to allow the notification to be shown before reload
		setTimeout(() => {
			// Force a complete page reload
			window.location.reload();
		}, 2000);
	}

	getPlayerInfos() {
		this.backService.getPlayer(this.idGame, this.idPlayer).subscribe(async data => {
			this.game = {...this.game, ...data.game};
			this.themesService.loadTheme(this.game.theme);
			this.cards = [];
			this.player = data.player;
			if (this.player.image === "") {
				this.options.seed = data.player.name.toString();
				const avatar = createAvatar(adventurer, this.options);
				this.player.image = avatar.toString();
			}
			// @ts-ignore
			this.svgContainer.nativeElement.innerHTML = this.player.image;
			await this.receiveCards(this.player.cards);
			if (data.player.status == "prison") {
				this.prison = true;
			}
			if (this.game.typeMoney === C.DEBT) {
				this.backService.getPlayerCredits(this.idGame, this.idPlayer).subscribe(data => {
					this.credits = data;
					_.forEach(data, d => {
						if (d.status == C.DEFAULT_CREDIT) {
							this.defaultCredit = true;
						} else if (d.status == "requesting") {
							this.requestingWhenCreditEnds(d, true);
						}
					});
				});
			}
			this.localStorageService.setItem("session",
				{
					idGame: this.idGame,
					idPlayer: this.idPlayer,
					gameName: this.game.name,
					player: this.player
				});
		});
	}

	ngAfterViewInit() {
		this.socket.on('resync', (data: any) => {
			if (data.needsResync) {
				this.getPlayerInfos();
			}
		});
		this.socket.on(C.START_GAME, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			this.player.coins = data.coins;
			this.game = {...this.game, ...data.game};
			await this.receiveCards(data.cards);
		});
		this.socket.on(C.START_ROUND, async () => {
			this.game.status = C.PLAYING;
			this.credits.forEach(c => {
				if (c.status == C.PAUSED_CREDIT) {
					c.status = C.RUNNING_CREDIT;
				}
			});
			this.snackbarService.showNotif(this.i18nService.instant("EVENTS.ROUND_START"));
		});
		this.socket.on(C.STOP_ROUND, async () => {
			this.dialog.closeAll();
			this.game.status = C.WAITING;
			this.dialog.open(InformationDialogComponent, {
				data: {text: this.i18nService.instant("EVENTS.ROUND_END")},
			});
		});
		this.socket.on(C.UPDATED_PLAYER, (data: any) => {
			if (data.id == this.idPlayer) {
				this.player = data;
			}
		});
		this.socket.on(C.END_GAME, (data: any) => {
			this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.GAME_END"));
			this.game.status = C.END_GAME;
			if (data && data.redirect == 'survey') {
				this.router.navigate(['game', this.idGame, 'player', this.idPlayer, 'survey']);
			} else {
				this.router.navigate(['game', this.idGame, 'results']);
			}
		});
		this.socket.on(C.DISTRIB_DU, (data: any, cb: (response: any) => void) => {
			if (cb) {
				cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			}
			this.audioService.playSound("audioDu");
			this.player.coins += data.du;
			this.game.currentDU = data.du;
			this.flipCoins();
		});
		this.socket.on(C.RESET_GAME, async (data: any) => {
			this.dialog.closeAll();
			await new Promise(resolve => setTimeout(resolve, 2000));
			this.panelCreditOpenState = false;
			this.localStorageService.setItem("panelCredit", false);
			if (this.player.reincarnateFromId) {
				this.router.navigate(['game', this.idGame, 'player', this.player.reincarnateFromId]).then(() => {
					this.refresh();
				});
			} else {
				this.refresh();
			}
		});
		this.socket.on(C.FIRST_DU, async (data: any) => {
			this.game.currentDU = data.du;
		});
		this.socket.on(C.DEAD, async () => {
			this.player.status = C.DEAD;
			this.dialog.closeAll();
			this.dialog.open(InformationDialogComponent, {
				data: {
					text: "☠️La mort vient de passer ! ☠️ \n Resurrection en cours....️",
					sound: "dead"
				},
			});
			this.cards = [];
			if (this.game.typeMoney === C.DEBT) {
				this.player.coins = 0;
			}
			await new Promise(resolve => setTimeout(resolve, 4000));
			this.resurrection();
		});
		this.socket.on(C.SHORT_CODE_BROADCAST, async (data: any) => {
			if (this.shortCode && this.shortCode.code === data.code) {
				this.socket.emit(C.SHORT_CODE_CONFIRMED, {payload: this.shortCode.payload, idBuyer: data.idBuyer});
			}
		});
		this.socket.on(C.SHORT_CODE_CONFIRMED, async (data: any) => {
			if (data && data.payload) {
				this.buy(data.payload);
			}
		});
		this.socket.on(C.UPDATE_GAME_OPTION, async (data: any) => {
			if (data) {
				this.game = {...this.game, ...data};
				this.themesService.loadTheme(this.game.theme);
			}
		});
		this.socket.on(C.REFRESH_FORCE, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			this.refresh();
		});
		this.socket.on(C.TRANSACTION_DONE, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			if (data.cost > 0) {
				this.audioService.playSound("coin");
				this.flipCoins();
				this.snackbarService.showNotif(this.i18nService.instant("EVENTS.RECEIVED_COINS", {amount: data.cost}) +
					this.i18nService.instant(this.game.typeMoney == C.DEBT ? "CURRENCY.EURO" : "CURRENCY.JUNE"));
			}
			this.player.coins = data.coins;
			const cardSold = _.find(this.cards, {_id: data.idCardSold});
			if (cardSold) {
				_.remove(this.cards, {_id: data.idCardSold});
				//display the card that was bellow (if stacked)
				_.forEach(this.cards, c => {
					// @ts-ignore
					if (!c.displayed && c.weight == cardSold.weight && c.letter == cardSold.letter) {
						c.displayed = true;
					}
				});
				// await new Promise(resolve => setTimeout(resolve, 1000));
				if (this.game.theme == 'THEME.CLASSIC') this.countOccurrencesAndHideDuplicates();
			}
		});
		this.socket.on(C.NEW_CREDIT, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			this.dialog.open(InformationDialogComponent, {
				data: {
					text: this.i18nService.instant("CREDIT.NEW_CREDIT", {amount: data.credit.amount})
				},
			});
			this.credits.push(data.credit);
			this.player.coins += data.credit.amount;
			this.flipCoins();
			this.audioService.playSound("coins");
			this.panelCreditOpenState = true;
			this.localStorageService.setItem("panelCredit", true);
		});
		this.socket.on(C.TIMEOUT_CREDIT, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			_.forEach(this.credits, c => {
				if (c._id == data.credit._id) {
					c.status = data.credit.status;
				}
			});
			this.panelCreditOpenState = true;
			this.localStorageService.setItem('panelCredit', true);
			this.requestingWhenCreditEnds(data, true);
		});
		this.socket.on(C.CREDITS_STARTED, async () => {
			_.forEach(this.credits, c => {
				if (c.status == C.PAUSED_CREDIT) {
					c.status = C.RUNNING_CREDIT;
				}
			});
		});
		this.socket.on(C.COPY_PLAYER, async (payload: any) => {
			console.log(payload);
			this.router.navigate(['game', payload.idGame, 'player', payload.idPlayer]).then(() => {
				// window.location.reload();
			});
		});
		this.socket.on(C.PROGRESS_CREDIT, async (data: any) => {
			_.forEach(this.credits, c => {
				if (c._id == data.id) {
					c.status = C.RUNNING_CREDIT;
					c.progress = data.progress;
				}
			});
		});
		this.socket.on(C.DEFAULT_CREDIT, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			_.forEach(this.credits, c => {
				if (c._id == data.credit._id) {
					c.status = data.credit.status;
				}
			});

			this.panelCreditOpenState = true;
			this.localStorageService.setItem("panelCredit", true);
			this.snackbarService.showError(this.i18nService.instant("CREDIT.DEFAULT_CREDIT"));
			this.defaultCredit = true;
			this.audioService.playSound("police");
		});
		this.socket.on(C.CREDIT_DONE, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			_.forEach(this.credits, c => {
				if (c._id == data.credit._id) {
					c.status = C.CREDIT_DONE;
				}
			});
		});
		this.socket.on(C.PROGRESS_PRISON, async (data: any) => {
			this.prisonProgress = data.progress;
			const minutes = Math.floor((data.remainingTime / (1000 * 60)) % 60);
			const seconds = Math.floor((data.remainingTime / 1000) % 60);
			this.prisonTimer.stop();
			this.prisonTimer.reset();
			this.prisonTimer.set({h: 0, m: minutes, s: seconds});
			this.prisonTimer.start();
		});
		this.socket.on(C.PRISON_ENDED, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			this.prison = false;
			if (data && data.cards) {
				await this.receiveCards(data.cards);
			}
			this.dialog.open(InformationDialogComponent, {
				data: {
					text: this.i18nService.instant("EVENTS.PRISON_END_TEXT"),
					sound: "./../../assets/audios/outPrison.mp3"
				},
			});
		});
		this.socket.on(C.SEIZURE, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			_.forEach(data.seizure.cards, c => {
				_.remove(this.cards, {_id: c._id});
			});
			if (this.game.theme != 'THEME.CLASSIC') this.countOccurrencesAndHideDuplicates();
			this.credits = _.map(this.credits, c => {
				if (c._id == data.credit._id) {
					c.status = C.CREDIT_DONE;
				}
				return c;
			});
			this.player.coins -= data.seizure.coins;
			this.defaultCredit = false;
			if (data.prisoner && data.prisoner._id == this.idPlayer) {
				this.prison = true;
				this.audioService.playSound("prison");
			}
		});
	}

	countOccurrencesAndHideDuplicates() {
		this.cards = _.orderBy(this.cards, ["weight", "letter"]);
		const countByResult = _.countBy(this.cards, (obj: any) => `${obj.weight}-${obj.letter}`);
		const keyDuplicates: string[] = [];
		for (const c of this.cards) {
			const countKey = `${c.weight}-${c.letter}`;
			c.count = countByResult[countKey] || 0;
			const existCountKey = _.find(keyDuplicates, (k: string) => k === countKey);
			if (c.count > 1 && existCountKey) {
				c.displayed = false;
			}
			if (c.count >= 1 && !existCountKey) {
				keyDuplicates.push(countKey);
				c.displayed = true;
			}
		}
	}

	showGift(card: Card) {
		this.dialog.open(CongratsDialogComponent, {
			hasBackdrop: true,
			backdropClass: 'bgBlur',
			data: {
				text: card.weight > 2 ? this.i18nService.instant("EVENTS.TECHNOLOGY") : this.i18nService.instant("EVENTS.GIFT"),
				card: card,
				theme: this.game.theme
			},
			width: '10px',
			height: '10px'
		});
	}

	flipCoins() {
		this.flipCoin = true;
		setTimeout(() => {
			this.flipCoin = false;
		}, 2000);
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription) this.subscription.unsubscribe();
	}

	updatePlayer() {
		this.router.navigate(["game", this.idGame, "player", this.idPlayer, "settings"]);
	}

	resurrection() {
		this.router.navigate(['game', this.idGame, 'join', this.player._id, this.player.name]);
	}

	formatNewCards(newCards: Card[]) {
		for (const c of newCards) {
			c.displayed = true;
			c.count = 1;
		}
		return newCards;
	}

	async receiveCards(newCards: Card[]) {
		const cards = this.formatNewCards(newCards);
		this.cards = _.concat(this.cards, cards);
		this.cards = _.orderBy(this.cards, ["weight", "letter"],);
		await new Promise(resolve => setTimeout(resolve, 1000));
		if (this.game.theme == 'THEME.CLASSIC') {
			this.countOccurrencesAndHideDuplicates();
			this.cards = _.orderBy(this.cards, ["count"], "desc");
		} else {
			this.recipes = getAvailableRecipes(this.cards, this.game.amountCardsForProd, this.game.generatedIdenticalLetters);
		}
	}

	produceLevelUp($event: any) {
		if (this.isProducing) {
			return; // Prevent double-clicks
		}
		this.isProducing = true;
		const identicalCards = _.filter(this.cards, {letter: $event.letter, weight: $event.weight});
		if (identicalCards.length >= this.game.amountCardsForProd) {
			const cardsForProd = identicalCards.slice(0, this.game.amountCardsForProd);
			this.backService.produce(this.idGame, this.idPlayer, cardsForProd).subscribe(async newCards => {
				_.remove(this.cards, c => _.some(cardsForProd, c));
				const cardGift = _.find(newCards, {weight: $event.weight + 1});
				if (cardGift) {
					this.showGift(cardGift);
				}
				this.isProducing = false;
				await this.receiveCards(newCards);
			});
		} else {
			this.isProducing = false;
			this.snackbarService.showError("are you trying to cheat???");
		}
	}

	scan() {
		const dialogRef = this.dialog.open(ScannerDialogV3Component, {});
		dialogRef.afterClosed().subscribe(dataRaw => {
			if (dataRaw) {
				this.buy(dataRaw);
			}
		});
	}

	buyWithCode(code: string) {
		this.socket.emit(C.SHORT_CODE_EMIT, {code, idBuyer: this.idPlayer}, (ack: any) => {
			console.log(ack)
		});
		this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.SHORT_CODE_SEND"));
	}

	buy(dataRaw: any) {
		if (this.isBuying) {
			return; // Prevent double-clicks
		}
		this.isBuying = true;

		const data = JSON.parse(dataRaw);
		const cost = this.game.typeMoney == C.JUNE ? (data.p * this.game.currentDU).toFixed(2) : data.p;
		if (this.idGame && data.g && this.idGame != data.g) {
			this.snackbarService.showError("petit malin... c'est une carte d'une autre partie...");
			this.isBuying = false; // Reset flag
		} else if (this.player.coins >= cost) {
			this.backService.transaction(this.idGame, this.idPlayer, data.o, data.c).subscribe(async dataReceived => {
				if (dataReceived?.buyedCard) {
					await this.receiveCards([dataReceived.buyedCard]);
					this.player.coins = dataReceived.coins;
					this.audioService.playSound("cardFlipBack");
				}
				this.isBuying = false; // Reset flag on success
			});
		} else if (this.player.coins < cost) {
			console.log(this.player.coins, cost);
			this.snackbarService.showError("Fond insuffisant !");
			this.audioService.playSound("error");
			this.isBuying = false; // Reset flag
		} else {
			this.snackbarService.showError("Erreur scan, réessaye !");
			this.isBuying = false; // Reset flag
		}
	}

	getBackgroundStyle() {
		switch (this.player.boardConf) {
			case "green":
				return {"background-image": "url('/assets/images/green-carpet.jpg')"};
			case "custom":
				return {"background-color": "" + this.player.boardColor};
			case "wood":
			default:
				return {"background-image": "url('/assets/images/woodJapAlt.jpg')"};
		}
	}

	requestingWhenCreditEnds(credit: Credit, beep: boolean) {
		this.player.status = "needAnswer";
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant("DIALOG.CREDIT_EXPIRED.TITLE"),
				message: this.i18nService.instant("DIALOG.CREDIT_EXPIRED.MESSAGE", {
					amount: (credit.amount + credit.interest),
					interest: credit.interest
				}),
				labelBtn1: this.i18nService.instant("DIALOG.CREDIT_EXPIRED.BTN1"),
				labelBtn2: this.i18nService.instant("DIALOG.CREDIT_EXPIRED.BTN2"),
				autoClickBtn2: true,
				timerBtn2: "14",//en secondes
				beep,
			}
		});
		dialogRef.afterClosed().subscribe(options => {
			if (options == "btn2") {
				if (this.player.coins >= credit.interest) {
					this.backService.payInterest(credit).subscribe(data => {
						if (data) {
							_.forEach(this.credits, c => {
								if (c._id == data._id) {
									c.status = data.status;
									c.extended = data.extended;
									c.progress = 0;
								}
							});
							this.player.coins -= credit.interest;
							this.player.status = C.ALIVE;
							this.audioService.playSound("interest");
						}
					});
				} else {
					this.snackbarService.showError("Fond insuffisant ! allez voir la banque");
				}
			} else if (options == "btn1") {
				if (this.player.coins >= (credit.amount + credit.interest)) {
					this.settleCredit(credit);
				} else {
					this.snackbarService.showError("Fond insuffisant !");
					this.audioService.playSound("error");
					this.requestingWhenCreditEnds(credit, false);
				}
			}
		});
	}

	getDebts() {
		let debts = 0;
		_.forEach(this.credits, c => {
			if (c.status != C.CREDIT_DONE) {
				debts += c.amount;
				debts += c.interest;
			}
		});
		return debts;
	}

	settleDebt(credit: Credit) {
		const confDialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				message: this.i18nService.instant("CREDIT.SETTLE_CREDIT", {amount: credit.amount + credit.interest}),
				labelBtn1: this.i18nService.instant("CREDIT.SETTLE_ALL"),
				labelBtn2: this.i18nService.instant("DIALOG.CANCEL"),
			}
		});
		confDialogRef.afterClosed().subscribe(result => {
			if (result && result == "btn1") {
				this.settleCredit(credit);
			}
		});
	}

	settleCredit(credit: Credit) {
		if (this.player && this.player.coins >= (credit.amount + credit.interest)) {
			this.backService.settleCredit(credit).subscribe(data => {
				if (data) {
					this.credits = _.map(this.credits, c => {
						if (c._id == data._id) {
							c.status = data.status;
							c.endDate = data.endDate;
							this.player.coins -= (data.amount + data.interest);
							this.player.status = C.ALIVE;
						}
						return c;
					});
					this.snackbarService.showSuccess(this.i18nService.instant("CREDIT.CREDIT_SETTLED"));
					this.audioService.playSound("interest");
				}
			});
		} else {
			this.snackbarService.showError(this.i18nService.instant("ERROR.NOT_ENOUGH_MONEY"));
			this.audioService.playSound("error");
		}
	}

	creditActionBtn($event: string, credit: Credit) {
		if (this.game.status == C.PLAYING && this.player.status != C.DEAD) {
			if ($event == 'settle') {
				this.settleDebt(credit);
			} else if ($event == 'answer') {
				this.requestingWhenCreditEnds(credit, false);
			}
		}
	}

	tryReincarnate() {
		this.backService.isReincarnated(this.idGame, this.idPlayer).subscribe(data => {
			if (data?.playerReIncarnated) {
				this.router.navigate(['game', this.idGame, 'player', data.playerReIncarnated]);
			} else {
				this.resurrection();
			}
		})
	}

	onCreateShortCode($event: ShortCode) {
		this.shortCode = $event;
	}

	openDialogShorCode() {
		const shortCodeDialogRef = this.dialog.open(ShortcodeDialogComponent);
		shortCodeDialogRef.afterClosed().subscribe(code => {
			if (code) {
				this.buyWithCode(code);
			}
		});
	}

	refresh() {
		window.location.reload();
	}

	showRules() {
		this.dialog.open(GameInfosDialog, {});
	}

	showActions() {
		const actionDialogRef = this.dialog.open(ActionDialogComponent, {
			data: {
				recipes: this.recipes,
				cards: this.cards,
				actionUsed: this.player.actionUsed
			}
		});
		actionDialogRef.afterClosed().subscribe(action => {
			if (action) {
				this.backService.sendAction(this.idGame, this.idPlayer, action).subscribe(data => {
					if (data) {
						this.player.actionUsed = true;
					}
				});
			}
		});
	}

	togglePanel(panel: string) {
		if (panel == 'credit') {
			this.panelCreditOpenState = !this.panelCreditOpenState;
			this.localStorageService.setItem('panelCredit', this.panelCreditOpenState);
		} else if (panel == 'recipe') {
			this.panelRecipeOpenState = !this.panelRecipeOpenState;
			this.localStorageService.setItem('panelRecipe', this.panelRecipeOpenState);
		}
	}

	onRecipeCompleted(recipe: Recipe) {
		console.log(recipe);
	}

	whoHaveCard(ingredient: Ingredient) {
		let cardName = this.themesService.getIcon(ingredient.key) + " " + this.i18nService.instant(ingredient.key);
		this.backService.whoHaveCard(this.idGame, ingredient.key).subscribe((payload: any) => {
			this.dialog.open(InformationDialogComponent, {
				data: {
					text: payload.status == "deck" ? this.i18nService.instant("CARD.IN_DECK", {cardName}) : this.i18nService.instant("CARD.IN_PLAYER", {
						player: payload.name,
						cardName
					}),
				}
			});
		});
	}

	recipeCompleted(recipe: Recipe) {
		if (recipe.completed && recipe.ingredients.some(i => i.have > 0)) {
			this.produceLevelUp({letter: recipe.letter, weight: recipe.weight});
		}
	}
}
