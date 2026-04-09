import {AfterViewInit, Component, OnInit} from '@angular/core';
import {Subscription} from "rxjs";
import {ActivatedRoute} from "@angular/router";
import {MatDialog} from "@angular/material/dialog";
// @ts-ignore
import { IO, GAME_STATUS, GAME_TYPE, CREDIT_STATUS, PLAYER_TYPE, PLAYER_STATUS} from '@geco/shared';
import * as _ from 'lodash-es';
import {faCircleInfo, faSackDollar, faLandmark, faInfoCircle} from "@fortawesome/free-solid-svg-icons";
import {ContractDialogComponent} from "../dialogs/contract-dialog/contract-dialog.component";
import {SeizureDialogComponent} from "../dialogs/seizure-dialog/seizure-dialog.component";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {I18nService} from '../services/i18n.service';
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
import {ConfirmDialogComponent} from '../dialogs/confirm-dialog/confirm-dialog.component';
import {WebSocketService} from "../services/web-socket.service";
import {SnackbarService} from "../services/snackbar.service";
import {GameStateService} from "../services/api/game-state.service";
import {BankService} from "../services/api/bank.service";
import {Credit, GameState, PlayerState} from "../models/gameState";
import { Session } from '../models/session';
import { Rules } from '../models/rules';

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

	subscription: Subscription | undefined;
	sessionId = "";
	gameStateId = "";
    session: Session = new Session();
	gameState: GameState = new GameState();
    rules: Rules = new Rules();
	socket: any;
	faInfoCircle = faInfoCircle;
	get prisoners(): PlayerState[] {
		return this.gameState.playersStates.filter(p => p.status === PLAYER_STATUS.PRISON);
	}
	iWantToBreakFree = false;

	constructor(private route: ActivatedRoute,
				private gameStateService: GameStateService,
                private bankService: BankService,
				private snackbarService: SnackbarService,
				private sanitizer: DomSanitizer,
				public dialog: MatDialog,
				private wsService: WebSocketService,
				private i18nService: I18nService) {
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
            this.sessionId = params['sessionId'];
			this.gameStateId = params['gameStateId'];
			this.getGame();
		});
	}

	ngAfterViewInit() {
		this.socket.on(IO.GAME.RESET, async () => {
			window.location.reload();
		});
		this.socket.on(IO.GAME.STARTED, async () => {
			this.gameState.status = GAME_STATUS.PLAYING;
			this.snackbarService.showNotif(this.i18nService.instant("EVENTS.ROUND_START"));
		});
		this.socket.on(IO.GAME.STOPPED, async () => {
			this.dialog.closeAll();
			this.gameState.status = GAME_STATUS.WAITING;
			this.dialog.open(InformationDialogComponent, {
				data: {text: this.i18nService.instant("EVENTS.ROUND_END")},
			});
		});
		this.socket.on(IO.GAME.SETUP, async (data: any) => {
			if (data) {
				this.gameState = {...this.gameState, ...data};
			}
		});
		this.socket.on(IO.CREDIT.STARTED, async () => {
			_.forEach(this.gameState.credits, c => {
				if (c.status == CREDIT_STATUS.PAUSED) {
					c.status = CREDIT_STATUS.RUNNING;
				}
			});
		});
		this.socket.on(IO.CREDIT.PROGRESS, async (data: any) => {
			_.forEach(this.gameState.credits, c => {
				if (c.idx == data.idx) {
					c.status = CREDIT_STATUS.RUNNING;
					c.progress = data.progress;
				}
			});
		});
		this.socket.on(IO.CREDIT.DONE, async (data: any) => {
			_.forEach(this.gameState.credits, c => {
				if (c.idx == data.idx) {
					c.status = data.status;
					this.gameState.currentMassMonetary = data.currentMassMonetary;
					this.gameState.bankInterestEarned = data.bankInterestEarned;
					this.gameState.bankMoneyLost = data.bankMoneyLost;
					this.gameState.bankGoodsEarned = data.bankGoodsEarned;
				}
			});
		});
		this.socket.on(IO.CREDIT.TIMEOUT, async (data: any) => {
			_.forEach(this.gameState.credits, c => {
				if (c.idx == data.idx) {
					c.status = data.status;
				}
			});
		});
		this.socket.on(IO.CREDIT.PAYED_INTEREST, async (data: any) => {
			_.forEach(this.gameState.credits, (c) => {
				if (c.idx == data.idx) {
					c.status = data.status;
					c.extended = data.extended;
					c.progress = 0;
					this.gameState.currentMassMonetary -= c.interest;
				}
			});
		});
		this.socket.on(IO.CREDIT.DEFAULT, async (data: any) => {
			_.forEach(this.gameState.credits, (c) => {
				if (c.playerStateIdx == data.playerStateIdx) {
					c.status = data.status;
				}
			});
			this.snackbarService.showError(this.i18nService.instant("CREDIT.DEFAULT_CREDIT_MESSAGE"));
		});
		this.socket.on(IO.PLAYER.PROGRESS_PRISON, async (data: any) => {
			_.forEach(this.prisoners, p => {
				if (p.idx == data.idx) {
					p.progressPrison = data.progress;
				}
			});
		});
		this.socket.on(IO.PLAYER.PRISON_ENDED, async (data: any) => {
			this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.PRISON_ENDED"));
			_.remove(this.prisoners, p => p.idx == data.idx);
			_.forEach(this.gameState.playersStates, p => {
				if (p.idx == data.idx) {
					p.status = PLAYER_STATUS.ALIVE;
					p.progressPrison = 0;
				}
			});
		});
		this.socket.on(IO.PLAYER.DIED, async (event: any) => {
			_.forEach(this.gameState.playersStates, p => {
				if (p.idx == event.receiver) {
					p.status = PLAYER_STATUS.DEAD;
				}
			});
			_.forEach(this.gameState.credits, c => {
				if (c.playerStateIdx === event.receiver && c.status === CREDIT_STATUS.DEFAULT) {
					this.dialog.closeAll();
				}
			});
		});
		this.socket.on(IO.AVATAR.UPDATED, (_data: any) => {
			window.location.reload();
		});
	}

	getGame() {
		this.gameStateService.get(this.gameStateId, true).subscribe((payload: any) => {
            this.gameState = payload.gameState;
			this.rules = payload.rules;
			this.session = payload.session;
		});
	}

	getAverageCurrency() {
		return this.gameState.currentMassMonetary / _.size(_.filter(this.gameState.playersStates, {'status': 'alive'}));
	}

	getAvatar(avatarIdx: number) {
		return _.find(this.session.avatars, p => p.idx === avatarIdx)!;
	}

	showContract() {
		const dialogRef = this.dialog.open(ContractDialogComponent, {
			data: {game: _.clone(this.gameState)},
		});
		dialogRef.afterClosed().subscribe(contrat => {
			if (contrat) {
				this.bankService.contract({
					...contrat,
					gameStateId: this.gameStateId,
					startNow: this.gameState.status == GAME_STATUS.PLAYING
				}).subscribe((credit: Credit) => {
					this.snackbarService.showSuccess(this.i18nService.instant("CONTRACT.CREDIT_SUCCESS", {player: this.getAvatar(credit.playerStateIdx)?.name}));
					this.gameState.credits.push(credit);
					this.gameState.currentMassMonetary += credit.amount;
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
				this.gameState.playersStates.filter(p => p.status === PLAYER_STATUS.ALIVE).forEach(p => {
					this.bankService.contract({
						playerStateIdx: p.idx,
						amount: this.rules.defaultCreditAmount,
						interest: this.rules.defaultInterestAmount,
						gameStateId: this.gameStateId,
						startNow: this.gameState.status == GAME_STATUS.PLAYING
					}).subscribe((credit: Credit) => {
						this.snackbarService.showSuccess(this.i18nService.instant("CONTRACT.CREDIT_SUCCESS", {player: this.getAvatar(credit.playerStateIdx)?.name}));
						this.gameState.credits.push(credit);
						this.gameState.currentMassMonetary += credit.amount;
					});
				});
				// 	this.snackbarService.showSuccess(this.i18nService.instant("BANK.CREDIT_FOR_ALL_SUCCESS"));
			}
		});
	}

	getDebts() {
		let debt = 0;
		_.forEach(this.gameState.credits, c => {
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
				seizureType: this.rules.seizureType,
				seizureCosts: this.rules.seizureCosts,
				seizureDecote: this.rules.seizureDecote,
			}
		});
		confDialogRef.afterClosed().subscribe(seizure => {
			if (seizure) {
				this.bankService.seizure(seizure, credit).subscribe((data: any) => {
					this.snackbarService.showSuccess(this.i18nService.instant("DIALOG.SEIZURE.SUCCESS"));
					if (data) {
						this.gameState.credits = _.map(this.gameState.credits, c => {
							if (c.idx == data.credit.idx) {
								return data.credit;
							} else {
								return c;
							}
						});
						if (data.prisoner) {
							this.prisoners.push(data.prisoner);
						}
						if (data.seizure) {
							this.gameState.currentMassMonetary -= seizure.coins;
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

	breakFree(idPlayerToFree: number) {
		this.bankService.breakFree(idPlayerToFree.toString()).subscribe(() => {
			this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.BREAK_FREE"));
		});
	}
}
