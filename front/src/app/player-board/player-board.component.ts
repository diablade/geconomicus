import {createAvatar, Options} from '@dicebear/core';
import {adventurer} from '@dicebear/collection';
import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subscription} from "rxjs";
import io from 'socket.io-client';
import {ActivatedRoute, Router} from "@angular/router";
import {Card, Credit, Player} from "../models/game";
import {BackService} from "../services/back.service";
import {ScannerDialogComponent} from "../dialogs/scanner-dialog/scanner-dialog.component";
import {MatDialog} from "@angular/material/dialog";
import {environment} from "../../environments/environment";
import * as _ from 'lodash-es';
import {faCamera, faEye, faEyeSlash} from "@fortawesome/free-solid-svg-icons";
import {SnackbarService} from "../services/snackbar.service";
import {animate, animateChild, query, stagger, state, style, transition, trigger} from "@angular/animations";
import {LoadingService} from "../services/loading.service";
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
import {MatSnackBar} from "@angular/material/snack-bar";
import {ConfirmDialogComponent} from "../dialogs/confirm-dialog/confirm-dialog.component";
import {CongratsDialogComponent} from "../dialogs/congrats-dialog/congrats-dialog.component";
import {ScannerDialogV3Component} from "../dialogs/scanner-dialog-v3/scanner-dialog-v3.component";
// @ts-ignore
import * as C from "../../../../config/constantes";


@Component({
	selector: 'app-player-board',
	templateUrl: './player-board.component.html',
	animations: [
		// nice stagger effect when showing existing elements
		trigger('list', [
			transition(':enter', [
				// child animation selector + stagger
				query('@items',
					stagger(600, animateChild()), {optional: true}
				)
			]),
		]),
		trigger('items', [
			transition(':enter', [
				style({transform: 'translateY(-100rem)'}),
				animate('600ms',
					style({transform: 'translateY(0rem)'}))
			]),
			transition(':leave', [
				style({transform: 'translateY(0rem)'}),
				animate('600ms',
					style({transform: 'translateY(-100rem)'}))
			]),
		]),
		trigger('duReceived', [
			state('void', style({
				opacity: 0,
				transform: 'rotate(0deg)'
			})),
			state('*', style({
				opacity: 1,
				transform: 'rotate(360deg)'
			})),
			transition(':enter', animate('1500ms ease')),
			transition(':leave', animate('1500ms ease'))
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
	@ViewChild('audioDu') audioDu!: ElementRef;
	@ViewChild('audioCops') audioCops!: ElementRef;
	@ViewChild('audioPrison') audioPrison!: ElementRef;
	@ViewChild('audioCredit') audioCredit!: ElementRef;
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
	typeMoney = "june";
	amountCardsForProd = 4;
	currentDU = 0;
	cards: Card[] = [];
	credits: Credit[] = [];
	faCamera = faCamera;
	faEye = faEye;
	faEyeSlash = faEyeSlash;
	scanV3 = true;
	duVisible = false;
	panelCreditOpenState = true;
	C = C;
	timerCredit = 5;
	timerPrison = 5;
	prison = false;
	defaultCredit = false;
	prisonProgress = 0;
	minutesPrison = 0;
	secondsPrison = 0;


	constructor(private route: ActivatedRoute, public dialog: MatDialog, private router: Router, private backService: BackService, private snackbarService: SnackbarService, private loadingService: LoadingService, private _snackBar: MatSnackBar) {
	}

	updateScreenSize() {
		// Listen for window resize events to update the dimensions if the screen size changes
		this.screenWidth = window.innerWidth;
		this.screenHeight = window.innerHeight;
		window.addEventListener('resize', this.updateScreenSize.bind(this));
	}

	ngOnInit(): void {
		this.updateScreenSize();
		this.subscription = this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			this.idPlayer = params['idPlayer'];
			this.socket = io(this.ioURl, {
				query: {
					idPlayer: this.idPlayer,
					idGame: this.idGame,
				},
			});

			this.backService.getPlayer(this.idGame, this.idPlayer).subscribe(async data => {
				this.player = data.player;
				this.typeMoney = data.typeMoney;
				this.currentDU = data.currentDU;
				this.statusGame = data.statusGame;
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
			});

			this.backService.getPlayerCredits(this.idGame, this.idPlayer).subscribe(data => {
				this.credits = data;
				_.forEach(data, d => {
					if (d.status == C.DEFAULT_CREDIT) {
						this.defaultCredit = true;
					} else if (d.status == "requesting") {
						this.requestingWhenCreditEnds(d, true);
					}
				})
			})
		});
	}

	ngAfterViewInit() {
		this.socket.on(C.START_GAME, async (data: any) => {
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
			this.dialog.open(InformationDialogComponent, {
				data: {text: "Le tour démarre ! "},
			});
		});
		this.socket.on(C.STOP_ROUND, async () => {
			this.statusGame = "waiting";
			this.dialog.open(InformationDialogComponent, {
				data: {text: "Tour terminé !"},
			});
		});
		this.socket.on("connected", (data: any) => {
			console.log("connected", data);
		});
		this.socket.on('disconnect', () => {
			console.log('Socket has been disconnected');
		});
		this.socket.on(C.END_GAME, (data: any) => {
			this.snackbarService.showSuccess("Jeu terminé !");
			this.statusGame = C.END_GAME;
			if (data && data.redirect == 'survey') {
				this.router.navigate(['game', this.idGame, 'player', this.idPlayer, 'survey']);
			} else {
				this.router.navigate(['game', this.idGame, 'results']);
			}
		});
		this.socket.on(C.DISTRIB_DU, (data: any) => {
			this.duVisible = true;
			this.audioDu.nativeElement.play();
			this.player.coins += data.du;
			this.currentDU = data.du;
			setTimeout(() => {
				this.duVisible = false;
			}, 4000);
		});
		this.socket.on(C.RESET_GAME, async (data: any) => {
			await new Promise(resolve => setTimeout(resolve, 1000));
			this.dialog.closeAll();
			this.cards = [];
			this.credits = [];
			this.statusGame = C.OPEN;
			this.player.coins = 0;
			this.defaultCredit = false;
			this.prison = false;
		});
		this.socket.on(C.FIRST_DU, async (data: any) => {
			this.currentDU = data.du;
		});
		this.socket.on(C.DEAD, async () => {
			this.player.status = C.DEAD;
			this.dialog.closeAll();
			this.dialog.open(InformationDialogComponent, {
				data: {text: "☠️La mort vient de passer ! ☠️ \n Resurrection en cours....️"},
			});
			this.cards = [];
			if (this.typeMoney === C.DEBT) {
				this.player.coins = 0;
			}
			await new Promise(resolve => setTimeout(resolve, 4000));
			this.resurrection();
		});
		this.socket.on(C.TRANSACTION_DONE, async (data: any) => {
			this.player.coins = data.coins;
			const cardSold = _.find(this.cards, {_id: data.idCardSold});
			if (cardSold) {
				await new Promise(resolve => setTimeout(resolve, 1000));
				_.remove(this.cards, {_id: data.idCardSold});
				//display the card that was bellow (if stacked)
				_.forEach(this.cards, c => {
					// @ts-ignore
					if (!c.displayed && c.weight == cardSold.weight && c.letter == cardSold.letter) {
						c.displayed = true;
					}
				});
				this.countOccurrencesAndHideDuplicates();
			}
		});
		this.socket.on(C.NEW_CREDIT, async (data: Credit) => {
			this.dialog.open(InformationDialogComponent, {
				data: {text: "Crédit obtenu (+" + data.amount + "💰)"},
			});
			this.player.coins += data.amount;
			this.audioCredit.nativeElement.play();
			this.credits.push(data);
		});
		this.socket.on(C.TIMEOUT_CREDIT, async (data: any) => {
			_.forEach(this.credits, c => {
				if (c._id == data._id) {
					c.status = data.status;
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
		this.socket.on(C.PROGRESS_CREDIT, async (data: any) => {
			_.forEach(this.credits, c => {
				if (c._id == data.id) {
					c.status = C.RUNNING_CREDIT;
					c.progress = data.progress;
				}
			});
		});
		this.socket.on(C.DEFAULT_CREDIT, async (data: any) => {
			_.forEach(this.credits, c => {
				if (c._id == data._id) {
					c.status = data.status;
				}
			});
			this.snackbarService.showError("DEFAULT DE PAIEMENT");
			this.defaultCredit = true;
			this.audioCops.nativeElement.play();
		});
		this.socket.on(C.CREDIT_DONE, async (data: any) => {
			_.forEach(this.credits, c => {
				if (c._id == data._id) {
					c.status = C.CREDIT_DONE;
				}
			});
		});
		this.socket.on(C.PROGRESS_PRISON, async (data: any) => {
			this.prisonProgress = data.progress;
			this.minutesPrison = Math.floor((data.remainingTime / (1000 * 60)) % 60);
			this.secondsPrison = Math.floor((data.remainingTime / 1000) % 60);
		});
		this.socket.on(C.PRISON_ENDED, async (data: any) => {
			this.prison = false;
			if (data && data.cards) {
				await this.receiveCards(data.cards);
			}
			this.dialog.open(InformationDialogComponent, {
				data: {text: "Sortie de prison, qu'on ne vous y reprenne plus ! 👮‍♂️ "},
			});
		});
		this.socket.on(C.SEIZURE, async (data: any) => {
			_.forEach(data.seizure.cards, c => {
				_.remove(this.cards, {_id: c._id});
			});
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
				this.audioPrison.nativeElement.play();
			}
		});
	}

	countOccurrencesAndHideDuplicates() {
		_.orderBy(this.cards, ["weight", "letter"]);
		const countByResult = _.countBy(this.cards, (obj: any) => `${obj.weight}-${obj.letter}`);
		const keyDuplicates: string[] = [];
		for (const c of this.cards) {
			const countKey = `${c.weight}-${c.letter}`;
			c.count = countByResult[countKey] || 0;
			const existCountKey = _.find(keyDuplicates, (k: string) => k === countKey);
			if (c.count > 1 && existCountKey) {
				c.displayed = false;
			}
			if (c.count > 1 && !existCountKey) {
				keyDuplicates.push(countKey);
				c.displayed = true;
			}
		}
	}

	showGift(card: Card) {
		this.dialog.open(CongratsDialogComponent, {
			data: {text: "Bravo ! vous obtenez une carte supérieur.", card: card},
			width: '10px',
			height: '10px'
		});
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription) this.subscription.unsubscribe()
		// Remember to disconnect the socket when the component is destroyed.
		this.socket.disconnect();
	}

	updatePlayer() {
		this.router.navigate(["game", this.idGame, "player", this.idPlayer, "settings"]);
	}

	scan() {
		if (this.scanV3) {
			const dialogRef = this.dialog.open(ScannerDialogV3Component, {});
			dialogRef.afterClosed().subscribe(dataRaw => {
				if (dataRaw) {
					this.buy(dataRaw);
				}
			});
		} else {
			const dialogRef = this.dialog.open(ScannerDialogComponent, {});
			dialogRef.afterClosed().subscribe(dataRaw => {
				this.buy(dataRaw);
			});
		}
	}

	resurrection() {
		this.router.navigate(['game', this.idGame, 'join', 'true']);
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
		this.countOccurrencesAndHideDuplicates();
	}

	produceLevelUp($event: Card) {
		const cardsToRemove = _.filter(this.cards, {letter: $event.letter, weight: $event.weight});
		if (cardsToRemove.length === this.amountCardsForProd) {
			this.backService.produce(this.idGame, this.idPlayer, cardsToRemove).subscribe(async newCards => {
				_.remove(this.cards, {letter: $event.letter, weight: $event.weight,});
				const cardGift = _.find(newCards, {weight: $event.weight + 1});
				if (cardGift) {
					this.showGift(cardGift);
				}
				await this.receiveCards(newCards);
			});
		} else {
			this.snackbarService.showError("are you trying to cheat???");
		}
	}

	buy(dataRaw: any) {
		const data = JSON.parse(dataRaw);
		const cost = this.typeMoney == C.JUNE ? data.p * this.currentDU : data.p;
		if (this.idGame != data.g) {
			this.snackbarService.showError("petit malin... c'est une carte d'une autre partie...");
		} else if (this.player.coins >= cost) {
			this.backService.transaction(this.idGame, this.idPlayer, data.o, data.c).subscribe(async dataReceived => {
				if (dataReceived?.buyedCard) {
					await this.receiveCards([dataReceived.buyedCard]);
					this.player.coins = dataReceived.coins;
				}
			});
		} else {
			this.snackbarService.showError("Fond insuffisant !");
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
				title: "Le crédit est arrivé à expiration !",
				message:
					"Rembourser l'intégralité (" + (credit.amount + credit.interest) + "\nou prolongé de 5 mn en payant l'intéret de " + credit.interest,
				labelBtn1: "Rembourser",
				labelBtn2: "Prolonger",
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
				message: "Etes vous sur de rembourser votre crédit , en payant: " + (credit.amount + credit.interest) + " ?",
				labelBtn1: "Rembourser intégralement",
				labelBtn2: "Annuler",
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
							this.player.coins -= data.amount;
							this.player.status = C.ALIVE;
						}
						return c;
					});
				}
			});
		} else {
			this.snackbarService.showError("Fond insuffisant...");
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
}
