import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, map, Subscription } from 'rxjs';
import { GameStateService } from '../services/api/game-state.service';
import { environment } from '../../environments/environment';
import {
	faFlagCheckered,
	faQrcode,
	faCogs,
	faTrashCan,
	faCircleInfo,
	faWarning,
	faBuildingColumns,
	faRightToBracket,
	faEye,
	faPlay,
	faPause,
	faStop,
	faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import { MatDialog } from '@angular/material/dialog';
import { SnackbarService } from '../services/snackbar.service';
// @ts-ignore
import { GAME_STATUS, GAME_TYPE, IO } from '@geco/shared';
import { InformationDialogComponent } from '../dialogs/information-dialog/information-dialog.component';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { I18nService } from '../services/i18n.service';
import { WebSocketService } from '../services/web-socket.service';
import { AudioService } from '../services/audio.service';
import { SessionStorageService } from '../services/local-storage/session-storage.service';
import { ReJoinQrDialogComponent } from '../dialogs/re-join-qr-dialog/re-join-qr-dialog.component';
import { TranslateService } from '@ngx-translate/core';

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
	protected readonly environment = environment;
	protected readonly faTrashCan = faTrashCan;
	protected readonly faFlagCheckered = faFlagCheckered;
	protected readonly faQrcode = faQrcode;
	protected readonly faCogs = faCogs;
	protected readonly faInfo = faCircleInfo;
	protected readonly faRightToBracket = faRightToBracket;
	protected readonly faWarning = faWarning;

	faBuildingColumns = faBuildingColumns;
	faEye = faEye;
	faPlay = faPlay;
	faPause = faPause;
	faStop = faStop;
	faArrowLeft = faArrowLeft;
	@ViewChild('videoPlayerL') videoPlayerL!: ElementRef;
	@ViewChild('videoPlayerLT') videoPlayerLT!: ElementRef;
	@ViewChild('videoPlayerR') videoPlayerR!: ElementRef;
	@ViewChild('videoPlayerRT') videoPlayerRT!: ElementRef;

	sessionId: string = '';
	gameStateId: string = '';

	// Reactive state from service
	gameState$ = this.gameStateService.gameState$;
	rules$ = this.gameStateService.rules$;
	session$ = this.gameStateService.session$;
	playersStates$ = this.gameStateService.playersStates$;

	playersWithAvatars$ = combineLatest([this.playersStates$, this.session$]).pipe(
		map(([playerStates, session]) =>
			playerStates.map(playerState => ({
				...playerState,
				avatar: session.avatars.find(a => a.idx === playerState.avatarIdx) ?? null,
			}))
		)
	);

	// Timer state from service
	timerProgress$ = this.gameStateService.timerProgress$;
	minutes$ = this.gameStateService.minutes$;
	seconds$ = this.gameStateService.seconds$;

	killUser = false;
	coinRotate = false;

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
		if (this.subscription) this.subscription.unsubscribe();
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.gameStateId = params['gameStateId'];

			// Load game state through the service (fetches data + initializes socket)
			this.gameStateService.loadForMaster(this.sessionId, this.gameStateId);

			this.wsService.on(IO.TIMER_LEFT, () => {
				this.playVideos();
			});

			this.wsService.on(IO.GAME.STOPPED, () => {
				this.stopRound();
			});

			this.wsService.on(IO.GAME.DEATH_IS_COMING, () => {
				const rules = this.gameStateService.getRulesSnapshot();
				if (rules.autoDeath) {
					this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.DEATH_PASS'));
				} else {
					this.dialog.open(InformationDialogComponent, {
						data: {
							text: this.i18nService.instant('EVENTS.NEED_DEATH_PASS'),
							sound: './assets/audios/iamdeath.mp3',
						},
					});
				}
			});
		});

		// Subscribe to rules to set initial timer
		this.rules$.subscribe((rules) => {
			if (rules && rules.roundMinutes > 0) {
				this.gameStateService.setInitialTimer(rules.roundMinutes);
			}
		});
	}

	playVideos() {
		this.videoPlayerL?.nativeElement?.play();
		this.videoPlayerLT?.nativeElement?.play();
		this.videoPlayerR?.nativeElement?.play();
		this.videoPlayerRT?.nativeElement?.play();
	}

	stopRound() {
		this.snackbarService.showNotif(this.i18nService.instant('EVENTS.ROUND_END'));
		this.dialog.open(InformationDialogComponent, {
			data: { text: this.i18nService.instant('EVENTS.ROUND_END'), sound: 'end' },
		});
	}

	endRound() {
		const confDialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				message: this.i18nService.instant('EVENTS.ASK_END_ROUND'),
			},
		});
		confDialogRef.afterClosed().subscribe((result) => {
			if (result && result == 'btn2') {
				// TODO: Call backend stopRound endpoint when wired up
			}
		});
	}

	resetGame(rulesIdx: number) {
		const session = this.gameStateService.getSessionSnapshot();
		this.gameStateService.resetGame(this.gameStateId, session._id, rulesIdx).subscribe((data) => {
			this.snackbarService.showSuccess(this.i18nService.instant('MASTER.SAVED'));
		});
	}

	goBackToLobby() {
		this.router.navigate(['/session', this.sessionId]);
	}

	getPlayerStateUrl(playerState: any) {
		return environment.WEB_HOST + 'player/' + this.sessionId + '/' + playerState.avatarIdx + '/' + this.gameStateId + '/' + playerState.idx;
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

	showBank() {
		window.open('bank/' + this.gameStateId, '_blank');
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
				if (result.status === this.INITIALIZED) {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.CARDS_DISTRIBUTED'));
				}
			},
			error: (err: any) => {
				this.snackbarService.showError(this.i18nService.instant('ERROR.DISTRIBUTE_CARDS'));
			},
		});
	}

	startRound() {
		const rules = this.gameStateService.getRulesSnapshot();
		this.gameStateService.startRound(this.gameStateId).subscribe({
			next: (result) => {
				if (result.status === this.PLAYING) {
					this.gameStateService.setInitialTimer(rules.roundMinutes);
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.ROUND_STARTED'));
				}
			},
			error: (err) => {
				this.snackbarService.showError(this.i18nService.instant('ERROR.START_ROUND'));
			},
		});
	}

	pauseRound() {
		// TODO: Wire to backend pauseRound when endpoint is ready
	}

	sendSurvey() {
		// TODO: Wire to backend sendSurvey when endpoint is ready
	}
}
