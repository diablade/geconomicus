import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, combineLatest, map, take } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { GAME_STATUS, GAME_TYPE, CREDIT_STATUS, PLAYER_STATUS } from '@geco/shared';
import { environment } from '../../environments/environment';
import * as _ from 'lodash-es';
import { faCircleInfo, faSackDollar, faLandmark, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { ContractDialogComponent } from '../dialogs/contract-dialog/contract-dialog.component';
import { SeizureDialogComponent } from '../dialogs/seizure-dialog/seizure-dialog.component';
import { I18nService } from '../services/i18n.service';
import { InformationDialogComponent } from '../dialogs/information-dialog/information-dialog.component';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../services/snackbar.service';
import { GameStateService } from '../services/api/game-state.service';
import { BankService } from '../services/api/bank.service';
import { AudioService } from '../services/audio.service';
import { Credit } from '../models/gameState';
import { Avatar } from '../models/avatar';

@Component({
	selector: 'app-bank-board',
	templateUrl: './bank-board.component.html',
	styleUrls: ['./bank-board.component.scss'],
})
export class BankBoardComponent implements OnInit, OnDestroy {
	protected readonly FINISHED = GAME_STATUS.FINISHED;
	protected readonly CREDIT_DONE = CREDIT_STATUS.DONE;
	protected readonly CREDIT_CANCELED = CREDIT_STATUS.CANCELED;
	protected readonly CREATED = GAME_STATUS.CREATED;
	protected readonly INITIALIZED = GAME_STATUS.INITIALIZED;
	protected readonly PLAYING = GAME_STATUS.PLAYING;
	protected readonly PAUSED = GAME_STATUS.PAUSED;
	protected readonly STOPPED = GAME_STATUS.STOPPED;
	protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly DEAD = PLAYER_STATUS.DEAD;
	protected readonly PRISON = PLAYER_STATUS.PRISON;

	protected readonly environment = environment;
	faLandMark = faLandmark;
	faSackDollar = faSackDollar;
	faCircleInfo = faCircleInfo;
	faInfoCircle = faInfoCircle;

	subscription: Subscription | undefined;
	sessionId = '';
	gameStateId = '';

	// Reactive state from service
	session$ = this.gameStateService.session$;
	gameState$ = this.gameStateService.gameState$;
	rules$ = this.gameStateService.rules$;
	playersAC$ = this.gameStateService.playersAC$;
	credits$ = this.gameStateService.credits$;
	// Timer state from service
	timerProgress$ = this.gameStateService.timerProgress$;
	minutes$ = this.gameStateService.minutes$;
	seconds$ = this.gameStateService.seconds$;

	prisoners$ = this.playersAC$.pipe(map((playersAC) => playersAC.filter((p) => p.status === this.PRISON)));

	averageCurrency$ = combineLatest({
		gameState: this.gameState$,
		playersAC: this.playersAC$,
	}).pipe(
		map(
			({ gameState, playersAC }) =>
				(gameState?.currentMassMonetary || 0) / _.size(_.filter(playersAC, { status: PLAYER_STATUS.ALIVE }))
		)
	);
	averageCurrencyDoubleCheck$ = this.playersAC$.pipe(
		map((playersAC) => {
			const alivePlayers = playersAC.filter((p) => p.status === PLAYER_STATUS.ALIVE);
			return alivePlayers.reduce((sum, player) => sum + player.coins, 0) / alivePlayers.length;
		})
	);

	vm$ = combineLatest({
		gameState: this.gameState$,
		rules: this.rules$,
		session: this.session$,
		timerProgress: this.timerProgress$,
		minutes: this.minutes$,
		seconds: this.seconds$,
		averageCurrency: this.averageCurrency$,
		averageCurrencyDoubleCheck: this.averageCurrencyDoubleCheck$,
	});

	bank$ = combineLatest({
		openedCredits: this.credits$.pipe(
			map((credits) => credits.filter((c) => c.status !== CREDIT_STATUS.DONE && c.status !== CREDIT_STATUS.CANCELED)),
		),
		closedCredits: this.credits$.pipe(
			map((credits) => credits.filter((c) => c.status === CREDIT_STATUS.DONE || c.status === CREDIT_STATUS.CANCELED)),
		),
		debts: this.credits$.pipe(
			map((credits) => {
				let debt = 0;
				_.forEach(credits, (c) => {
					if (c.status !== CREDIT_STATUS.DONE && c.status !== CREDIT_STATUS.CANCELED) {
						debt += c.amount + c.interest;
					}
				});
				return debt;
			})
		),
	});

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private gameStateService: GameStateService,
		private bankService: BankService,
		private snackbarService: SnackbarService,
		public dialog: MatDialog,
		private audioService: AudioService,
		private i18nService: I18nService
	) {
		// this.i18nService.loadNamespace('master');
		this.i18nService.loadNamespace('bank');
	}

	ngOnDestroy(): void {
		this.gameStateService.leaveBankRoom();
		if (this.subscription) this.subscription.unsubscribe();
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.gameStateId = params['gameStateId'];

			// Load game state through the service (fetches data + initializes socket)
			this.gameStateService.loadForMaster(this.sessionId, this.gameStateId, true);
		});
	}

	getAvatar(playerStateIdx: number): Avatar | undefined {
		return this.gameStateService.getAvatar(playerStateIdx);
	}

	goBackToGame() {
		this.router.navigate(['/master', this.sessionId, this.gameStateId]);
	}

	showContract() {
		const dialogRef = this.dialog.open(ContractDialogComponent, {
			data: {
				rules: this.rules$,
				players: this.playersAC$.pipe(
					map((players) => players.filter((p) => p.status === PLAYER_STATUS.ALIVE))
				),
			},
		});
		dialogRef.afterClosed().subscribe((contrat) => {
			console.log('contrat', contrat);
			if (contrat) {
				this.gameStateService.createCredit(contrat);
			}
		});
	}

	cancelCredit(credit: Credit) {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant('CREDIT.CANCEL'),
				message: this.i18nService.instant('CREDIT.CANCEL_MESSAGE', { amount: credit.amount }),
			},
		});
		dialogRef.afterClosed().subscribe((result) => {
			if (result) {
				this.gameStateService.cancelCredit(credit);
			}
		});
	}

	creditForAll() {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant('BANK.CREDIT_FOR_ALL'),
				message: this.i18nService.instant('BANK.CREDIT_FOR_ALL_MESSAGE'),
			},
		});
		dialogRef.afterClosed().subscribe((result) => {
			if (result) {
				// this.gameState.playersStates
				// 	.filter((p) => p.status === PLAYER_STATUS.ALIVE)
				// 	.forEach((p) => {
				// 		this.bankService
				// 			.contract({
				// 				playerStateIdx: p.idx,
				// 				amount: this.rules.defaultCreditAmount,
				// 				interest: this.rules.defaultInterestAmount,
				// 				gameStateId: this.gameStateId,
				// 				startNow: this.gameState.status == GAME_STATUS.PLAYING,
				// 			})
				// 			.subscribe((credit: Credit) => {
				// 				this.snackbarService.showSuccess(
				// 					this.i18nService.instant('CONTRACT.CREDIT_SUCCESS', {
				// 						player: this.getAvatar(credit.playerStateIdx)?.name,
				// 					})
				// 				);
				// 				this.gameState.credits.push(credit);
				// 				this.gameState.currentMassMonetary += credit.amount;
				// 			});
				// 	});
				// // 	this.snackbarService.showSuccess(this.i18nService.instant("BANK.CREDIT_FOR_ALL_SUCCESS"));
			}
		});
	}

	seizureProcedure(credit: Credit) {
		this.rules$.pipe(take(1)).subscribe((rules) => {
			const confDialogRef = this.dialog.open(SeizureDialogComponent, {
				data: {
					credit: credit,
					seizureType: rules.seizureType,
					seizureCosts: rules.seizureCosts,
					seizureDecote: rules.seizureDecote,
				},
			});
			confDialogRef.afterClosed().subscribe((seizure) => {
				if (seizure) {
					this.gameStateService.seizureOnCredit(seizure, credit);
				} else {
					this.snackbarService.showError('ERROR.SEIZURE_CANCELLED');
				}
			});
		});
	}

	actionBtn($event: string, credit: Credit) {
		if ($event == 'seizure') {
			this.seizureProcedure(credit);
		}
	}

	breakFree(idPlayerToFree: number) {
		this.bankService.breakFree(idPlayerToFree.toString()).subscribe(() => {
			this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.BREAK_FREE'));
		});
	}
}
