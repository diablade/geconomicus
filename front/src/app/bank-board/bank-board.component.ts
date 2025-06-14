import {AfterViewInit, Component, OnInit} from '@angular/core';
import {Subscription} from "rxjs";
import {Credit, Game, Player} from "../models/game";
import {ActivatedRoute} from "@angular/router";
import {BackService} from "../services/back.service";
import {SnackbarService} from "../services/snackbar.service";
import {MatDialog} from "@angular/material/dialog";
import io from "socket.io-client";
// @ts-ignore
import * as C from "../../../../config/constantes";
import * as _ from 'lodash-es';
import {faCircleInfo, faSackDollar, faLandmark, faInfoCircle} from "@fortawesome/free-solid-svg-icons";
import {ContractDialogComponent} from "../dialogs/contract-dialog/contract-dialog.component";
import {environment} from "../../environments/environment";
import {SeizureDialogComponent} from "../dialogs/seizure-dialog/seizure-dialog.component";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {I18nService} from '../services/i18n.service';
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";

@Component({
	selector: 'app-bank-board',
	templateUrl: './bank-board.component.html',
	styleUrls: ['./bank-board.component.scss']
})
export class BankBoardComponent implements OnInit, AfterViewInit {
	faSackDollar = faSackDollar;
	faCircleInfo = faCircleInfo;
	faLandMark = faLandmark;
	ioURl: string = environment.API_HOST;
	subscription: Subscription | undefined;
	idGame = "";
	game: Game = new Game;
	data = "";
	socket: any;
	C = C;
	faInfoCircle = faInfoCircle;
	prisoners: Player[] = [];
	iWantToBreakFree = false;

	constructor(private route: ActivatedRoute,
	            private backService: BackService,
	            private snackbarService: SnackbarService,
	            private sanitizer: DomSanitizer,
	            public dialog: MatDialog,
	            private i18nService: I18nService) {
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			this.socket = io(this.ioURl, {
				query: {
					idPlayer: this.idGame + 'bank',
					idGame: this.idGame,
				},
			});
			this.backService.getGame(this.idGame).subscribe(game => {
				this.game = game;
				this.prisoners = _.filter(game.players, {"status": "prison"});
			});
		});
	}

	ngAfterViewInit() {
		this.socket.on(C.RESET_GAME, async () => {
			window.location.reload();
		});
		this.socket.on(C.START_ROUND, async () => {
			this.game.status = C.PLAYING;
			this.snackbarService.showNotif(this.i18nService.instant("EVENTS.ROUND_START"));
		});
		this.socket.on(C.STOP_ROUND, async () => {
			this.dialog.closeAll();
			this.game.status = "waiting";
			this.dialog.open(InformationDialogComponent, {
				data: {text: this.i18nService.instant("EVENTS.ROUND_END")},
			});
		});
		this.socket.on(C.UPDATE_GAME_OPTION, async (data: any) => {
			if (data) {
				this.game.typeMoney = data.typeMoney;
				this.game.timerCredit = data.timerCredit;
				this.game.timerPrison = data.timerPrison;
				this.game.amountCardsForProd = data.amountCardsForProd;
			}
		});
		this.socket.on(C.CREDITS_STARTED, async () => {
			_.forEach(this.game.credits, c => {
				if (c.status == C.PAUSED_CREDIT) {
					c.status = C.RUNNING_CREDIT;
				}
			});
		});
		this.socket.on(C.PROGRESS_CREDIT, async (data: any) => {
			_.forEach(this.game.credits, c => {
				if (c._id == data.id) {
					c.status = C.RUNNING_CREDIT;
					c.progress = data.progress;
				}
			});
		});
		this.socket.on(C.CREDIT_DONE, async (data: any) => {
			_.forEach(this.game.credits, c => {
				if (c._id == data._id) {
					c.status = C.CREDIT_DONE;
					this.game.currentMassMonetary -= c.interest;
					this.game.currentMassMonetary -= c.amount;
				}
			});
		});
		this.socket.on(C.TIMEOUT_CREDIT, async (data: any) => {
			_.forEach(this.game.credits, c => {
				if (c._id == data._id) {
					c.status = data.status;
				}
			});
		});
		this.socket.on(C.PAYED_INTEREST, async (data: any) => {
			_.forEach(this.game.credits, c => {
				if (c._id == data._id) {
					c.status = data.status;
					c.extended = data.extended;
					c.progress = 0;
					this.game.currentMassMonetary -= c.interest;
				}
			});
		});
		this.socket.on(C.DEFAULT_CREDIT, async (data: any) => {
			_.forEach(this.game.credits, c => {
				if (c._id == data._id) {
					c.status = data.status;
				}
			});
			this.snackbarService.showError(this.i18nService.instant("CREDIT.DEFAULT_CREDIT_MESSAGE"));
		});
		this.socket.on(C.PROGRESS_PRISON, async (data: any) => {
			_.forEach(this.prisoners, p => {
				if (p._id == data.id) {
					p.progressPrison = data.progress;
				}
			});
		});
		this.socket.on(C.PRISON_ENDED, async (data: any) => {
			this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.PRISON_ENDED"));
			_.remove(this.prisoners, p => p._id == data.idPlayer);
			_.forEach(this.game.players, p => {
				if (p._id == data.idPlayer) {
					p.status = C.ALIVE;
				}
			});
		});
		this.socket.on(C.DEAD, async (event: any) => {
			_.forEach(this.game.players, p => {
				if (p._id == event.receiver) {
					p.status = C.DEAD;
				}
			});
			_.forEach(this.game.credits, c => {
				if (c.idPlayer === event.receiver && c.status === C.DEFAULT_CREDIT) {
					this.dialog.closeAll();
				}
			});
		});
		this.socket.on(C.SEIZED_DEAD, async (event: any) => {
			_.forEach(this.game.credits, c => {
				if (c.idPlayer === event.emitter) {
					c.status = C.CREDIT_DONE;
				}
			});
			this.game.currentMassMonetary -= event.amount;
			this.game.bankInterestEarned += event.resources[0].interest;
			this.game.bankMoneyLost += event.resources[0].bankMoneyLost;
			this.game.bankGoodsEarned += event.resources[0].bankGoodsEarned;
		});
		this.socket.on(C.NEW_PLAYER, (player: Player) => {
			this.game.players.push(player);
		});
	}

	getAverageCurrency() {
		return this.game.currentMassMonetary / _.size(_.filter(this.game.players, {'status': 'alive'}));
	}

	getPlayerName(idPlayer: string) {
		const player = _.find(this.game.players, p => p._id === idPlayer);
		return player ? player.name : idPlayer;
	}

	showContract() {
		const dialogRef = this.dialog.open(ContractDialogComponent, {
			data: {game: _.clone(this.game)},
		});
		dialogRef.afterClosed().subscribe(contrat => {
			if (contrat) {
				this.backService.createCredit({
					...contrat,
					idGame: this.idGame,
					startNow: this.game.status == C.PLAYING
				}).subscribe((credit: Credit) => {
					this.snackbarService.showSuccess(this.i18nService.instant("CONTRACT.CREDIT_SUCCESS", {player: this.getPlayerName(credit.idPlayer)}));
					this.game.credits.push(credit);
					this.game.currentMassMonetary += credit.amount;
				});
			}
		});
	}

	getDebts() {
		let debt = 0;
		_.forEach(this.game.credits, c => {
			if (c.status != C.CREDIT_DONE) {
				debt += (c.amount + c.interest)
			}
		});
		return debt;
	}

	seizureProcedure(credit: Credit) {
		const confDialogRef = this.dialog.open(SeizureDialogComponent, {
			data: {
				credit: credit,
				seizureType: this.game.seizureType,
				seizureCosts: this.game.seizureCosts,
				seizureDecote: this.game.seizureDecote,
			}
		});
		confDialogRef.afterClosed().subscribe(seizure => {
			if (seizure) {
				this.backService.seizure(seizure, credit).subscribe((data: any) => {
					this.snackbarService.showSuccess(this.i18nService.instant("DIALOG.SEIZURE.SUCCESS"));
					if (data) {
						this.game.credits = _.map(this.game.credits, c => {
							if (c._id == data.credit._id) {
								return data.credit;
							} else {
								return c;
							}
						});
						if (data.prisoner) {
							this.prisoners.push(data.prisoner);
						}
						if (data.seizure) {
							this.game.currentMassMonetary -= seizure.coins;
						}
					}
				});
			} else {
				this.snackbarService.showError("saisie annulé...");
			}
		});
	}

	actionBtn($event: string, credit: Credit) {
		if ($event == 'seizure') {
			this.seizureProcedure(credit);
		}
	}

	getSanitizedSvgFromString(svgString: string): SafeHtml {
		return this.sanitizer.bypassSecurityTrustHtml(svgString);
	}

	breakFree(idPlayerToFree: string) {
		this.backService.breakFree(this.idGame, idPlayerToFree).subscribe(() => {
			this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.BREAK_FREE"));
		});
	}
}
