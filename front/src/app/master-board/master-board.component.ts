import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Subscription, take } from 'rxjs';
import { GameStateService } from '../services/api/game-state.service';
import { environment } from '../../environments/environment';
import { MatDialog } from '@angular/material/dialog';
import { SnackbarService } from '../services/snackbar.service';
import { GAME_STATUS, GAME_TYPE, PLAYER_STATUS, IO } from '@geco/shared';
import { InformationDialogComponent } from '../dialogs/information-dialog/information-dialog.component';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { I18nService } from '../services/i18n.service';
import { WebSocketService } from '../services/web-socket.service';
import { AudioService } from '../services/audio.service';
import { ReJoinQrDialogComponent } from '../dialogs/re-join-qr-dialog/re-join-qr-dialog.component';
import { TranslateService } from '@ngx-translate/core';
import * as _ from 'lodash-es';

@Component({
	selector: 'app-master-board',
	templateUrl: './master-board.component.html',
	styleUrls: ['./master-board.component.scss'],
})
export class MasterBoardComponent implements OnInit, OnDestroy {
	private subscription: Subscription | undefined;
	protected readonly CREATED = GAME_STATUS.CREATED;
	protected readonly INITIALIZED = GAME_STATUS.INITIALIZED;
	protected readonly PLAYING = GAME_STATUS.PLAYING;
	protected readonly PAUSED = GAME_STATUS.PAUSED;
	protected readonly STOPPED = GAME_STATUS.STOPPED;
	protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly DEAD = PLAYER_STATUS.DEAD;
	protected readonly environment = environment;

	@ViewChild('videoPlayerL') videoPlayerL!: ElementRef;
	@ViewChild('videoPlayerLT') videoPlayerLT!: ElementRef;
	@ViewChild('videoPlayerR') videoPlayerR!: ElementRef;
	@ViewChild('videoPlayerRT') videoPlayerRT!: ElementRef;
	coinRotate = false;

	sessionId = '';
	gameStateId = '';

	// Reactive state from service
	masterConnection$ = this.gameStateService.masterConnection$;
	gameState$ = this.gameStateService.gameState$;
	rules$ = this.gameStateService.rules$;
	session$ = this.gameStateService.session$;
	// Timer state from service
	timerProgress$ = this.gameStateService.timerProgress$;
	minutes$ = this.gameStateService.minutes$;
	seconds$ = this.gameStateService.seconds$;
	playersAC$ = this.gameStateService.playersAC$;

	vm$ = combineLatest({
		gameState: this.gameState$,
		rules: this.rules$,
		session: this.session$,
		timerProgress: this.timerProgress$,
		minutes: this.minutes$,
		seconds: this.seconds$,
	});

	constructor(
		private route: ActivatedRoute,
		private gameStateService: GameStateService,
		private snackbarService: SnackbarService,
		private translate: TranslateService,
		private router: Router,
		private i18nService: I18nService,
		private audioService: AudioService,
		private wsService: WebSocketService,
		public dialog: MatDialog
	) {
		this.i18nService.loadNamespace('master');
	}

	ngOnDestroy(): void {
		this.gameStateService.leaveRooms();
		this.gameStateService.offAll();
		if (this.subscription) this.subscription.unsubscribe();
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.gameStateId = params['gameStateId'];

			// Load game state through the service (fetches data + initializes socket)
			this.gameStateService.loadForMaster(this.sessionId, this.gameStateId);

			this.subscription?.add(
				this.gameStateService.timerTick$.subscribe(() => {
					this.playVideos();
				})
			);

			this.wsService.on(IO.GAME.STOPPED, () => {
				this.snackbarService.showNotif(this.i18nService.instant('EVENTS.ROUND_END'));
				this.dialog.open(InformationDialogComponent, {
					data: { message: this.i18nService.instant('EVENTS.ROUND_END'), sound: 'end' },
				});
			});

			this.wsService.on(IO.GAME.DEATH_IS_COMING, () => {
				this.rules$.pipe(take(1)).subscribe((rules) => {
					if (rules.autoDeath) {
						this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.DEATH_PASS'));
					} else {
						this.dialog.open(InformationDialogComponent, {
							data: {
								message: this.i18nService.instant('EVENTS.NEED_DEATH_PASS'),
								sound: './assets/audios/iamdeath.mp3',
							},
						});
					}
				});
			});
		});
	}

	playVideos() {
		this.videoPlayerL?.nativeElement?.play();
		this.videoPlayerLT?.nativeElement?.play();
		this.videoPlayerR?.nativeElement?.play();
		this.videoPlayerRT?.nativeElement?.play();
	}

	resetGame(rulesIdx: number) {
		this.session$.pipe(take(1)).subscribe((session) => {
			this.gameStateService.resetGame(this.gameStateId, session._id, rulesIdx).subscribe((data) => {
				this.snackbarService.showSuccess(this.i18nService.instant('MASTER.SAVED'));
			});
		});
	}

	goBackToLobby() {
		this.router.navigate(['/session', this.sessionId]);
	}

	getPlayerStateUrl(playerState: any) {
		return (
			environment.WEB_HOST +
			'player/' +
			this.sessionId +
			'/' +
			playerState.avatarIdx +
			'/' +
			this.gameStateId +
			'/' +
			playerState.idx
		);
	}

	copyPlayerLink(playerState: any): void {
		const url = this.getPlayerStateUrl(playerState);
		navigator.clipboard.writeText(url);
		this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.COPY_SUCCESS'));
	}

	reJoin(playerState: any): void {
		this.dialog.open(ReJoinQrDialogComponent, {
			data: {
				text: playerState.avatar?.name || '',
				url: this.getPlayerStateUrl(playerState),
			},
		});
	}

	qrCodeBank(): void {
		let username = '';
		this.translate.get('BANK.TITLE').subscribe((text) => {
			username = text;
		});

		this.dialog.open(ReJoinQrDialogComponent, {
			data: {
				text: username,
				url: environment.WEB_HOST + '/bank/' + this.gameStateId,
			},
		});
	}

	spinnerDiameter(): number {
		return window.innerWidth < 850 ? 200 : 300;
	}

	goToAdmin() {
		window.open('table/' + this.sessionId + '/' + this.gameStateId, '_blank');
	}

	toggleCoinRotate() {
		this.coinRotate = !this.coinRotate;
	}

	initGame() {
		this.gameStateService.init(this.gameStateId).subscribe({
			next: (result: any) => {
				if (result.gameState.status === this.INITIALIZED) {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.CARDS_DISTRIBUTED'));
				}
			},
			error: (err: any) => {
				this.snackbarService.showError(this.i18nService.instant('ERROR.DISTRIBUTE_CARDS'));
			},
		});
	}

	startGame() {
		this.gameStateService.startGame(this.gameStateId).subscribe({
			next: (result) => {
				this.rules$.pipe(take(1)).subscribe((rules) => {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.GAME_STARTED'));
					this.audioService.playSound('start');
					const remainingMs = result?.remainingTimeMs || (rules.roundMinutes * 60 * 1000);
					this.gameStateService.startTimer(remainingMs);
				});
			},
			error: (error) => {
				this.snackbarService.showError(this.i18nService.instant(error.message));
			},
		});
	}

	stopGame() {
		const confDialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				message: this.i18nService.instant('EVENTS.ASK_END_ROUND'),
			},
		});
		confDialogRef.afterClosed().subscribe((result) => {
			if (result && result == 'btnConfirm') {
				this.gameStateService.stopGame(this.gameStateId).subscribe(() => {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.GAME_ENDED'));
                    this.gameStateService.stopTimer();
				});
			}
		});
	}

	pauseGame() {
		this.gameStateService.pauseGame(this.gameStateId).subscribe({
			next: () => {
				this.snackbarService.showSuccess(this.i18nService.instant('MASTER.GAME_PAUSED'));
				this.gameStateService.pauseTimer();
			},
			error: (error) => {
				this.snackbarService.showError(this.i18nService.instant(error.message));
			},
		});
	}

	killUserNow(playerState: any) {
		// TODO: Wire to backend killUser when endpoint is ready
	}
}
