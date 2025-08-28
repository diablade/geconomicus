import {createAvatar, Options} from '@dicebear/core';
import {adventurer} from '@dicebear/collection';
import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subscription} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {Card, Credit, Player} from "../models/game";
import {BackService} from "../services/back.service";
import {MatDialog} from "@angular/material/dialog";
import {environment} from "../../environments/environment";
import {I18nService} from "../services/i18n.service";
import * as _ from 'lodash-es';
import {faCamera, faCircleInfo, faClipboardCheck, faEye, faEyeSlash, faFileContract, faKeyboard, faQrcode, faCreditCardAlt} from "@fortawesome/free-solid-svg-icons";
import {SnackbarService} from "../services/snackbar.service";
import {animate, animateChild, keyframes, query, style, transition, trigger} from "@angular/animations";
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
import {ConfirmDialogComponent} from "../dialogs/confirm-dialog/confirm-dialog.component";
import {CongratsDialogComponent} from "../dialogs/congrats-dialog/congrats-dialog.component";
import {ScannerDialogV3Component} from "../dialogs/scanner-dialog-v3/scanner-dialog-v3.component";
// @ts-ignore
import * as C from "../../../../config/constantes";
import {ShortCode} from "../models/shortCode";
import {Receipe} from "../models/receipes";
import {ShortcodeDialogComponent} from "../dialogs/shortcode-dialog/shortcode-dialog.component";
import {WebSocketService} from "../services/web-socket.service";
import {GameInfosDialog} from "../components/notice-btn/notice-btn.component";
import createCountdown from "../services/countDown";
import {LocalStorageService} from "../services/local-storage/local-storage.service";
import {AudioService} from '../services/audio.service';

@Component({
	selector: 'app-player-board',
	templateUrl: './player-board.component.html',
	animations: [
		trigger('list', [
			transition(':enter', [
				query('@items', [
					animateChild()
				], {optional: true})
			]),
		]),
		trigger('item', [
			transition(':enter', [
				style({transform: 'translateY(-100rem)'}),
				animate('600ms ease-out', style({transform: 'translateY(0)'}))
			]),
			transition(':leave', [
				animate('600ms ease-in', style({transform: 'translateY(-100rem)'}))
			])
		]),
		trigger('coinFlip', [
			transition('void => *', []),
			transition('* => *', [
				animate('500ms ease-in-out',
					keyframes([
						style({
							transform: 'rotateY(0deg) scale(1.1)',
							offset: 0
						}),
						style({
							transform: 'rotateY(180deg) scale(1.1)',
							offset: 0.25
						}),
						style({
							transform: 'rotateY(360deg) scale(1.1)',
							offset: 0.5
						}),
						style({
							transform: 'rotateY(540deg) scale(1.1)',
							offset: 0.75
						}),
						style({
							transform: 'rotateY(720deg) scale(1)',
							offset: 1
						})
					])
				)
			])
		]),
		trigger('prisonDoor', [
			transition(':enter', [
				style({transform: 'translateX(-100rem)'}),
				animate('2000ms',
					style({transform: 'translateX(0rem)'}))
			]),
			transition(':leave', [
				style({transform: 'translateX(0rem)'}),
				animate('2000ms',
					style({transform: 'translateX(-100rem)'}))
			]),
		]),
	],
	styleUrls: ['./player-board.component.scss']
})
export class PlayerBoardComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	ioURl: string = environment.API_HOST;
	private socket: any;
	screenWidth = 0;
	screenHeight = 0;
	idGame: string | undefined;
	idPlayer: string | undefined;
	player: Player = new Player();
	private subscription: Subscription | undefined;
	options: Partial<adventurer.Options & Options> = {};
	statusGame = "waiting";
	gameName: string = "";
	typeMoney = C.JUNE;
	modeNewCard = false;
	amountCardsForProd = 4;
	currentDU = 0;
	cards: Card[] = [];
	credits: Credit[] = [];
	faCamera = faCamera;
	faEye = faEye;
	faEyeSlash = faEyeSlash;
	faQrcode = faQrcode;
	faKeyboard = faKeyboard;
	faInfo = faCircleInfo;
	faFileContract = faFileContract;
	faClipboardCheck = faClipboardCheck;
	faCreditCardAlt = faCreditCardAlt;
	scanV3 = true;
	flipCoin = false;
	panelCreditOpenState = true;
	panelReceipeOpenState = true;
	C = C;
	timerCredit = 5;
	timerPrison = 5;
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
		this.panelCreditOpenState = this.localStorageService.getItem("panelCredit") == undefined ? true : this.localStorageService.getItem("panelCredit");
		this.panelReceipeOpenState = this.localStorageService.getItem("panelReceipe") == undefined ? true : this.localStorageService.getItem("panelReceipe");
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
			this.i18nService.loadNamespace("cards");
			this.cards = [];
			this.player = data.player;
			this.typeMoney = data.typeMoney;
			this.currentDU = data.currentDU;
			this.statusGame = data.statusGame;
			this.gameName = data.gameName;
			this.modeNewCard = data.modeNewCard;
			this.timerCredit = data.timerCredit;
			this.amountCardsForProd = data.amountCardsForProd;
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
			if (this.typeMoney === C.DEBT) {
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
					gameName: this.gameName,
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
			this.statusGame = "waiting";
			this.player.coins = data.coins;
			this.typeMoney = data.typeMoney;
			this.timerCredit = data.timerCredit;
			this.timerPrison = data.timerPrison;
			this.amountCardsForProd = data.amountCardsForProd;
			await this.receiveCards(data.cards);
		});
		this.socket.on(C.START_ROUND, async () => {
			this.statusGame = C.PLAYING;
			this.credits.forEach(c => {
				if (c.status == C.PAUSED_CREDIT) {
					c.status = C.RUNNING_CREDIT;
				}
			});
			this.snackbarService.showNotif(this.i18nService.instant("EVENTS.ROUND_START"));
		});
		this.socket.on(C.STOP_ROUND, async () => {
			this.dialog.closeAll();
			this.statusGame = "waiting";
			this.dialog.open(InformationDialogComponent, {
				data: {text: this.i18nService.instant("EVENTS.ROUND_END")},
			});
		});
		this.socket.on(C.UPDATED_PLAYER, (data: any) => {
			if(data.id == this.idPlayer){
				this.player = data;
			}
		});
		this.socket.on(C.END_GAME, (data: any) => {
			this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.GAME_END"));
			this.statusGame = C.END_GAME;
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
			this.currentDU = data.du;
			this.flipCoins();
		});
		this.socket.on(C.RESET_GAME, async (data: any) => {
			this.dialog.closeAll();
			await new Promise(resolve => setTimeout(resolve, 2000));
			if (this.player.reincarnateFromId) {
				this.router.navigate(['game', this.idGame, 'player', this.player.reincarnateFromId]).then(() => {
					this.refresh();
				});
			} else {
				this.refresh();
			}
		});
		this.socket.on(C.FIRST_DU, async (data: any) => {
			this.currentDU = data.du;
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
			if (this.typeMoney === C.DEBT) {
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
				this.typeMoney = data.typeMoney;
				this.timerCredit = data.timerCredit;
				this.timerPrison = data.timerPrison;
				this.amountCardsForProd = data.amountCardsForProd;
				this.gameName = data.gameName;
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
					this.i18nService.instant(this.typeMoney == C.DEBT ? "CURRENCY.EURO" : "CURRENCY.JUNE"));
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
				if(!this.modeNewCard) this.countOccurrencesAndHideDuplicates();
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
		});
		this.socket.on(C.TIMEOUT_CREDIT, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", idPlayer: this.idPlayer, _ackId: data._ackId});
			_.forEach(this.credits, c => {
				if (c._id == data.credit._id) {
					c.status = data.credit.status;
				}
			});
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
			if(!this.modeNewCard) this.countOccurrencesAndHideDuplicates();
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
				card: card
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
		await new Promise(resolve => setTimeout(resolve, 1000));
		if(!this.modeNewCard) this.countOccurrencesAndHideDuplicates();
	}

	produceLevelUp($event: Card) {
		if (this.isProducing) {
			return; // Prevent double-clicks
		}
		this.isProducing = true;
		const identicalCards = _.filter(this.cards, {letter: $event.letter, weight: $event.weight});
		if (identicalCards.length >= this.amountCardsForProd) {
			const cardsForProd = identicalCards.slice(0, this.amountCardsForProd);
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
		const cost = this.typeMoney == C.JUNE ? (data.p * this.currentDU).toFixed(2) : data.p;
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
		if (this.statusGame == C.PLAYING && this.player.status != C.DEAD) {
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

	onReceipeCompleted(receipe: Receipe) {
		console.log(receipe);
	}

	togglePanel(panel: string) {
		if (panel == 'credit') {
			this.panelCreditOpenState = !this.panelCreditOpenState;
			this.localStorageService.setItem('panelCredit', this.panelCreditOpenState);
		} else if (panel == 'receipe') {
			this.panelReceipeOpenState = !this.panelReceipeOpenState;
			this.localStorageService.setItem('panelReceipe', this.panelReceipeOpenState);
		}
	}
}
