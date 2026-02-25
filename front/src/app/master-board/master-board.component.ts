import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameStateService } from '../services/api/game-state.service';
import { GameState, PlayerLife } from '../models/gameState';
import { Rules } from '../models/rules';
import { Session } from '../models/session';
import { environment } from '../../environments/environment';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
} from '@fortawesome/free-solid-svg-icons';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { SnackbarService } from '../services/snackbar.service';
import createCountdown from '../services/countDown';
// @ts-ignore
import { C } from '../../../../back/shared/constantes.mjs';
import * as _ from 'lodash-es';
import { GameOptionsDialogComponent } from '../dialogs/game-options-dialog/game-options-dialog.component';
import { SessionStorageService } from '../services/local-storage/session-storage.service';
import { StorageKey } from '../services/local-storage/storage-key.const';
import { InformationDialogComponent } from '../dialogs/information-dialog/information-dialog.component';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { WebSocketService } from '../services/web-socket.service';
import { TranslateService } from '@ngx-translate/core';
import { I18nService } from '../services/i18n.service';
import { AudioService } from '../services/audio.service';

@Component({
	selector: 'app-master-board',
	templateUrl: './master-board.component.html',
	styleUrls: ['./master-board.component.scss'],
})
export class MasterBoardComponent implements OnInit, AfterViewInit, OnDestroy {
	private subscription: Subscription | undefined;
	@ViewChild('videoPlayerL') videoPlayerL!: ElementRef;
	@ViewChild('videoPlayerLT') videoPlayerLT!: ElementRef;
	@ViewChild('videoPlayerR') videoPlayerR!: ElementRef;
	@ViewChild('videoPlayerRT') videoPlayerRT!: ElementRef;
	gameStateId = '';
	gameState: GameState = new GameState();
	rules: Rules = new Rules();
	session: Session = new Session();
	private socket: any;
	deleteUser = false;
	killUser = false;
	protected readonly environment = environment;
	faTrashCan = faTrashCan;
	faFlagCheckered = faFlagCheckered;
	faQrcode = faQrcode;
	faCogs = faCogs;
	faInfo = faCircleInfo;
	faRightToBracket = faRightToBracket;
	faWarning = faWarning;
	faBuildingColumns = faBuildingColumns;
	faEye = faEye;
	faPlay = faPlay;
	faPause = faPause;
	faStop = faStop;

	C = C;
	timerProgress = 100;

	options = [
		{ value: C.JUNE, label: 'FREE_MONEY', isDisabled: false },
		{ value: C.DEBT, label: 'DEBT_MONEY', isDisabled: false },
	];
	minutes = '00';
	seconds = '00';
	timer = createCountdown(
		{ h: 0, m: 0, s: 0 },
		{
			listen: ({ hh, mm, ss, s, h, m }) => {
				this.minutes = mm;
				this.seconds = ss;
				const secondsRemaining = s + m * 60;
				this.sessionStorageService.setItem(StorageKey.timerRemaining, secondsRemaining);
				this.timerProgress = (secondsRemaining / (this.rules.roundMinutes * 60)) * 100;
			},
			done: () => {
				this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.ROUND_END'));
			},
		}
	);

	constructor(
		private route: ActivatedRoute,
		private sessionStorageService: SessionStorageService,
		private gameStateService: GameStateService,
		private snackbarService: SnackbarService,
		private translate: TranslateService,
		private router: Router,
		private sanitizer: DomSanitizer,
		private wsService: WebSocketService,
		private i18nService: I18nService,
		private audioService: AudioService,
		public dialog: MatDialog
	) {
		this.i18nService.loadNamespace('master');
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe((params) => {
			this.gameStateId = params['gameStateId'];
			this.setMaster();
			if (this.route.snapshot.routeConfig?.path === 'game/:idGame/reset') {
				this.resetGameFromUrl();
			}
			this.socket = this.wsService.getSocket(this.gameStateId, this.gameStateId + 'master');
		});
		this.gameStateService.get(this.gameStateId, true).subscribe((payload) => {
			this.gameState = payload.gameState;
			this.rules = payload.rules;
			this.session = payload.session;
			this.minutes =
				this.rules.roundMinutes > 9
					? this.rules.roundMinutes.toString()
					: '0' + this.rules.roundMinutes.toString();
			const timerRemaining = this.sessionStorageService.getItem(StorageKey.timerRemaining);

			if (timerRemaining && this.gameState.status == C.PLAYING) {
				this.timer.set({ h: 0, m: 0, s: timerRemaining });
				this.timer.start();
			} else {
				this.timer.set({ h: 0, m: this.rules.roundMinutes, s: 0 });
			}
		});
	}

	ngAfterViewInit(): void {
		this.socket.on(C.UPDATED_PLAYER, (player: PlayerLife) => {
			// this.gameState.players = _.map(this.gameState.players, (p) => {
			// if (p._id == player._id) {
			// p = player;
			// }
			// return p;
			// });
		});
		this.socket.on(C.NEW_PLAYER, (player: PlayerLife) => {
			// this.gameState.players.push(player);
		});
		this.socket.on('connected', (player: any) => {
			console.log('connected', player);
		});
		this.socket.on(C.TIMER_LEFT, (minutesRemaining: number) => {
			this.startVideos();
			this.sessionStorageService.setItem(StorageKey.timerRemaining, minutesRemaining * 60);
			if (minutesRemaining && this.gameState.status == C.PLAYING) {
				this.timer.stop();
				this.timer.reset();
				this.timer.set({ h: 0, m: minutesRemaining, s: 0 });
				this.timer.start();
			}
		});
		this.socket.on(C.STOP_ROUND, async () => {
			this.stopRound();
		});
		this.socket.on(C.DEATH_IS_COMING, async () => {
			if (this.rules.autoDeath) {
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
		this.socket.on(C.DEAD, async (event: any) => {
			_.forEach(this.gameState.playersLifes, (p) => {
				if (p.idx == event.receiver) {
					p.status = C.DEAD;
				}
			});
		});
	}

	setMaster() {
		this.sessionStorageService.setItem('master', this.gameStateId);
	}

	startVideos() {
		this.videoPlayerL.nativeElement.play();
		this.videoPlayerLT.nativeElement.play();
		this.videoPlayerR.nativeElement.play();
		this.videoPlayerRT.nativeElement.play();
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription) this.subscription.unsubscribe();
	}

	onDeleteUser(player: PlayerLife) {
		// this.backService.deleteUser(player._id, this.idGame).subscribe((game: Game) => {
		// 	this.gameState = game;
		// });
	}

	startGame() {
		// if (this.gameState) {
		// 	this.backService.startGame(this.gameState).subscribe((data: any) => {
		// 		if (data.status == C.START_GAME) {
		// 			this.gameState.status = data.status;
		// 			this.gameState.round += 1;
		// 		}
		// 	});
		// }
	}

	startRound() {
		// this.backService.startRound(this.idGame, this.gameState.round).subscribe(() => {
		// 	this.timer.set({ h: 0, m: this.gameState.roundMinutes, s: 0 });
		// 	this.timer.start();
		// 	this.gameState.status = C.PLAYING;
		// 	this.audioService.playSound('start');
		// 	this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.ROUND_START'));
		// });
	}

	stopRound() {
		this.timer.stop();
		this.timer.reset();
		this.timer.set({ h: 0, m: 0, s: 0 });
		this.gameState.status = C.STOP_ROUND;
		this.timerProgress = 0;
		this.sessionStorageService.removeItem(StorageKey.timerRemaining);
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
			// if (result && result == 'btn2') {
			// 	this.backService.stopRound(this.idGame, this.gameState.round).subscribe();
			// }
		});
	}

	resetGameFromBtn() {
		// this.backService.resetGame(this.idGame).subscribe(() => {
		// this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.RESET_GAME'));
		// window.location.reload();
		// });
	}

	resetGameFromUrl() {
		// this.backService.resetGame(this.idGame).subscribe(() => {
		// this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.RESET_GAME'));
		// this.router.navigate(['ogame', this.idGame, 'master']);
		// });
	}

	goBackToLobby() {
		// this.router.navigate(['ogame', this.idGame, 'results']);
	}

	sendSurvey() {}
	pauseRound() {}

	getUserUrl(idPlayer: string) {
		// return environment.WEB_HOST + '/ogame/' + this.idGame + '/' + environment.PLAYER.GET + idPlayer;
	}

	reJoin(idPlayer: string, username: string): void {
		const dialogRef = this.dialog.open(JoinQrDialog, {
			data: {
				text: username,
				url: this.getUserUrl(idPlayer),
			},
		});
		dialogRef.afterClosed().subscribe(() => {});
	}

	qrCodeBank(): void {
		let username = '';
		this.translate.get('BANK.TITLE').subscribe((text) => {
			username = text;
		});

		const dialogRef = this.dialog.open(JoinQrDialog, {
			data: {
				text: username,
				url: environment.WEB_HOST + '/bank/' + this.gameStateId,
			},
		});
		dialogRef.afterClosed().subscribe(() => {});
	}

	showEvents() {
		// window.open('ogame/' + this.idGame + '/results', '_blank');
	}

	showBank() {
		window.open('bank/' + this.gameStateId, '_blank');
	}

	goToAdmin() {
		window.open('table/' + this.gameStateId, '_blank');
	}

	onKillUser(player: PlayerLife) {
		// this.backService.killUser(player._id, this.idGame).subscribe(() => {
		// player.status = C.DEAD;
		// });
	}
}

@Component({
	selector: 'join-qr-dialog',
	template: 'deprecated',
})
export class JoinQrDialog {
	constructor(
		public dialogRef: MatDialogRef<JoinQrDialog>,
		@Inject(MAT_DIALOG_DATA) public data: any
	) {}

	back(): void {
		this.dialogRef.close();
	}
}
