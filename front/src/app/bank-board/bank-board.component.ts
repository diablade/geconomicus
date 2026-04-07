import {AfterViewInit, Component, OnInit} from '@angular/core';
import {Subscription} from "rxjs";
import {Credit, Game, Player} from "../models/game";
import {ActivatedRoute} from "@angular/router";
import {DeprecatedBackService} from "../services/deprecated-back.service";
import {SnackbarService} from "../services/snackbar.service";
import {MatDialog} from "@angular/material/dialog";
// @ts-ignore
import { IO, GAME_STATUS, GAME_TYPE, CREDIT_STATUS, PLAYER_TYPE, PLAYER_STATUS} from '@geco/shared';
import * as _ from 'lodash-es';
import {faCircleInfo, faSackDollar, faLandmark, faInfoCircle} from "@fortawesome/free-solid-svg-icons";
import {ContractDialogComponent} from "../dialogs/contract-dialog/contract-dialog.component";
import {environment} from "../../environments/environment";
import {SeizureDialogComponent} from "../dialogs/seizure-dialog/seizure-dialog.component";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {I18nService} from '../services/i18n.service';
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
import {WebSocketService} from "../services/web-socket.service";
import {ConfirmDialogComponent} from '../dialogs/confirm-dialog/confirm-dialog.component';

@Component({
	selector: 'app-bank-board',
	templateUrl: './bank-board.component.html',
	styleUrls: ['./bank-board.component.scss']
})
export class BankBoardComponent implements OnInit, AfterViewInit {
	protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly FINISHED = GAME_STATUS.FINISHED;
    protected readonly CREDIT_DONE = CREDIT_STATUS.DONE;
	protected readonly JUNE = GAME_TYPE.JUNE;
	faLandMark = faLandmark;
    faSackDollar = faSackDollar;
    faCircleInfo = faCircleInfo;
	ioURl: string = environment.API_HOST;
	subscription: Subscription | undefined;
	idGame = "";
	game: Game = new Game();
	socket: any;
	faInfoCircle = faInfoCircle;
	prisoners: Player[] = [];
	iWantToBreakFree = false;

	constructor(private route: ActivatedRoute,
				private backService: DeprecatedBackService,
				private snackbarService: SnackbarService,
				private sanitizer: DomSanitizer,
				public dialog: MatDialog,
				private wsService: WebSocketService,
				private i18nService: I18nService) {
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			this.socket = this.wsService.getSocket(this.idGame, this.idGame + PLAYER_TYPE.BANK);
			this.getGame();
		});
	}

	ngAfterViewInit() {
		this.socket.on(IO.GAME.RESET, async () => {
			window.location.reload();
		});
		this.socket.on(IO.GAME.STARTED, async () => {
			this.game.status = GAME_STATUS.PLAYING;
			this.snackbarService.showNotif(this.i18nService.instant("EVENTS.ROUND_START"));
		});
		this.socket.on(IO.GAME.STOPPED, async () => {
			this.dialog.closeAll();
			this.game.status = GAME_STATUS.WAITING;
			this.dialog.open(InformationDialogComponent, {
				data: {text: this.i18nService.instant("EVENTS.ROUND_END")},
			});
		});
		this.socket.on(IO.GAME.SETUP, async (data: any) => {
			if (data) {
				this.game = {...this.game, ...data};
			}
		});
		this.socket.on(IO.CREDIT.STARTED, async () => {
			_.forEach(this.game.credits, c => {
				if (c.status == CREDIT_STATUS.PAUSED) {
					c.status = CREDIT_STATUS.RUNNING;
				}
			});
		});
		this.socket.on(IO.CREDIT.PROGRESS, async (data: any) => {
			_.forEach(this.game.credits, c => {
				if (c._id == data.id) {
					c.status = CREDIT_STATUS.RUNNING;
					c.progress = data.progress;
				}
			});
		});
		this.socket.on(IO.CREDIT.DONE, async (data: any) => {
			_.forEach(this.game.credits, c => {
				if (c._id == data.credit._id) {
					c.status = CREDIT_STATUS.DONE;
					this.game.currentMassMonetary = data.currentMassMonetary;
					this.game.bankInterestEarned = data.bankInterestEarned;
					this.game.bankMoneyLost = data.bankMoneyLost;
					this.game.bankGoodsEarned = data.bankGoodsEarned;
				}
			});
		});
		this.socket.on(IO.CREDIT.TIMEOUT, async (data: any) => {
			_.forEach(this.game.credits, c => {
				if (c._id == data._id) {
					c.status = data.status;
				}
			});
		});
		this.socket.on(IO.CREDIT.PAYED_INTEREST, async (data: any) => {
			_.forEach(this.game.credits, (c) => {
				if (c._id == data._id) {
					c.status = data.status;
					c.extended = data.extended;
					c.progress = 0;
					this.game.currentMassMonetary -= c.interest;
				}
			});
		});
		this.socket.on(IO.CREDIT.DEFAULT, async (data: any) => {
			_.forEach(this.game.credits, (c) => {
				if (c._id == data._id) {
					c.status = data.status;
				}
			});
			this.snackbarService.showError(this.i18nService.instant("CREDIT.DEFAULT_CREDIT_MESSAGE"));
		});
		this.socket.on(IO.PLAYER.PROGRESS_PRISON, async (data: any) => {
			_.forEach(this.prisoners, p => {
				if (p._id == data.id) {
					p.progressPrison = data.progress;
				}
			});
		});
		this.socket.on(IO.PLAYER.PRISON_ENDED, async (data: any) => {
			this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.PRISON_ENDED"));
			_.remove(this.prisoners, p => p._id == data.idPlayer);
			_.forEach(this.game.players, p => {
				if (p._id == data.idPlayer) {
					p.status = PLAYER_STATUS.ALIVE;
				}
			});
		});
		this.socket.on(IO.PLAYER.DIED, async (event: any) => {
			_.forEach(this.game.players, p => {
				if (p._id == event.receiver) {
					p.status = PLAYER_STATUS.DEAD;
				}
			});
			_.forEach(this.game.credits, c => {
				if (c.idPlayer === event.receiver && c.status === CREDIT_STATUS.DEFAULT) {
					this.dialog.closeAll();
				}
			});
		});
		this.socket.on(IO.AVATAR.NEW, (player: Player) => {
			this.game.players.push(player);
		});
		this.socket.on(IO.AVATAR.UPDATED, (_data: any) => {
			this.getGame();
		});
	}

	getGame() {
		this.backService.getGame(this.idGame).subscribe(game => {
			this.game = game;
			this.prisoners = _.filter(game.players, {"status": "prison"});
		});
	}

	getAverageCurrency() {
		return this.game.currentMassMonetary / _.size(_.filter(this.game.players, {'status': 'alive'}));
	}

	getPlayerName(idPlayer: string) {
		const player = _.find(this.game.players, p => p._id === idPlayer);
		return player ? player.name : idPlayer;
	}

	getContractorColor(idPlayer: string) {
		const player = _.find(this.game.players, p => p._id === idPlayer);
		return player ? player.hairColor : 'black';
	}

	getContractorSvg(idPlayer: string) {
		const player = _.find(this.game.players, p => p._id === idPlayer);
		return player ? player.image : 'none';
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
					startNow: this.game.status == GAME_STATUS.PLAYING
				}).subscribe((credit: Credit) => {
					this.snackbarService.showSuccess(this.i18nService.instant("CONTRACT.CREDIT_SUCCESS", {player: this.getPlayerName(credit.idPlayer)}));
					this.game.credits.push(credit);
					this.game.currentMassMonetary += credit.amount;
				});
			}
		});
	}

	creditForAll() {

		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant("BANK.CREDIT_FOR_ALL"),
				message: this.i18nService.instant("BANK.CREDIT_FOR_ALL_MESSAGE"),
			}
		});
		dialogRef.afterClosed().subscribe(result => {
			if (result) {
				this.game.players.filter(p => p.status === PLAYER_STATUS.ALIVE).forEach(p => {
					this.backService.createCredit({
						idPlayer: p._id,
						amount: this.game.defaultCreditAmount,
						interest: this.game.defaultInterestAmount,
						idGame: this.idGame,
						startNow: this.game.status == GAME_STATUS.PLAYING
					}).subscribe((credit: Credit) => {
						this.snackbarService.showSuccess(this.i18nService.instant("CONTRACT.CREDIT_SUCCESS", {player: this.getPlayerName(credit.idPlayer)}));
						this.game.credits.push(credit);
						this.game.currentMassMonetary += credit.amount;
					});
				});
				// 	this.snackbarService.showSuccess(this.i18nService.instant("BANK.CREDIT_FOR_ALL_SUCCESS"));
			}
		});
	}

	getDebts() {
		let debt = 0;
		_.forEach(this.game.credits, c => {
			if (c.status != CREDIT_STATUS.DONE) {
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
