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
import {faCircleInfo, faSackDollar, faLandmark} from "@fortawesome/free-solid-svg-icons";
import {ContractDialogComponent} from "../dialogs/contract-dialog/contract-dialog.component";
import {environment} from "../../environments/environment";
import {SeizureDialogComponent} from "../dialogs/seizure-dialog/seizure-dialog.component";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";

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
	prisoners: Player[] = [];
	iWantToBreakFree = false;

	constructor(private route: ActivatedRoute,
							private backService: BackService,
							private snackbarService: SnackbarService,
							private sanitizer: DomSanitizer,
							public dialog: MatDialog) {
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
			this.snackbarService.showError("!!! UN CREDIT EST EN DEFAULT !!!");
		});
		this.socket.on(C.PROGRESS_PRISON, async (data: any) => {
			_.forEach(this.prisoners, p => {
				if (p._id == data.id) {
					p.progressPrison = data.progress;
				}
			});
		});
		this.socket.on(C.PRISON_ENDED, async (data: any) => {
			this.snackbarService.showSuccess("un prisonnier viens de purger sa peine");
			_.remove(this.prisoners, p => p._id == data.idPlayer);
			_.forEach(this.game.players, p => {
				if (p._id == data.idPlayer) {
					p.status = C.ALIVE;
				}
			});
		});
		this.socket.on(C.DEAD, async (event:any) => {
			_.forEach(this.game.players, p => {if(p._id==event.receiver){
				p.status = C.DEAD;
			}});
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
			this.backService.createCredit({...contrat, idGame: this.idGame}).subscribe((credit: Credit) => {
				this.snackbarService.showSuccess("Credit octroyer à " + this.getPlayerName(credit.idPlayer));
				this.game.credits.push(credit);
				this.game.currentMassMonetary += credit.amount;
			});
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
					this.snackbarService.showSuccess("Saisie effectué !");
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
			this.snackbarService.showSuccess("I want to break FREEEEEE !");
		});
	}
}
