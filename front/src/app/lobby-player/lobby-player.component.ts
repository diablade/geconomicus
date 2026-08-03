import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AvatarService } from '../services/api/avatar.service';
import { combineLatest, Subscription } from 'rxjs';
import { GAME_TYPE, GAME_STATUS } from '@geco/shared';
import { MatDialog } from '@angular/material/dialog';
import { I18nService } from '../services/i18n.service';
import { faPencil, faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { getBackgroundStyle } from '../services/avatarTools';
import { formatAvatarCode } from '../services/avatarCode';
import { AudioService } from '../services/audio.service';
import { SnackbarService } from '../services/snackbar.service';
import { InformationDialogComponent } from '../dialogs/information-dialog/information-dialog.component';
import { TutorialDialogComponent } from '../dialogs/tutorial-dialog/tutorial-dialog.component';
import { FullscreenService } from '../services/fullscreen.service';
import { LocalStorageService } from '../services/local-storage/local-storage.service';

@Component({
	selector: 'app-lobby-player',
	templateUrl: './lobby-player.component.html',
	styleUrls: ['./lobby-player.component.scss'],
})
export class LobbyPlayerComponent implements OnInit, OnDestroy {
	protected readonly getBackgroundStyle = getBackgroundStyle;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly GAME_INITIALIZED = GAME_STATUS.INITIALIZED;
	protected readonly GAME_CREATED = GAME_STATUS.CREATED;
	protected readonly GAME_PLAYING = GAME_STATUS.PLAYING;
	protected readonly GAME_PAUSED = GAME_STATUS.PAUSED;
	protected readonly GAME_STOPPED = GAME_STATUS.STOPPED;
	protected readonly GAME_NONE = GAME_STATUS.NONE;
	faRightToBracket = faRightToBracket;
	faPencil = faPencil;
	allowEditFeedback = false;
	scanV3 = true;

	sessionId = '';
	avatarIdx = 0;
	avatar$ = inject(AvatarService).avatar$;
	session$ = inject(AvatarService).session$;

	vm$ = combineLatest({
		avatar: this.avatar$,
		session: this.session$,
	});
	skin = '#f2d3b1';
	hairColor = '#ac6511';
	avatarCode = '';
	rejoinCountdown: number | null = null;
	private subscription: Subscription | undefined;
	private sessionSubscription: Subscription | undefined;
	private resumeRequested = false;
	private rejoinArmed = false;
	private rejoinTarget: { gameStateId: string; playerStateIdx: number } | null = null;
	private rejoinTicker: any = null;

	constructor(
		private avatarService: AvatarService,
		private audioService: AudioService,
		private route: ActivatedRoute,
		private router: Router,
		private dialog: MatDialog,
		private snackbarService: SnackbarService,
		public fullscreenService: FullscreenService,
		private localStorageService: LocalStorageService,
		private i18n: I18nService
	) {
		this.i18n.loadNamespace('avatar');
	}

	ngOnInit() {
		this.scanV3 = this.localStorageService.getItem('scanV3');
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.avatarIdx = parseInt(params['avatarIdx']);
			// this.avatarService.initializeSocket(this.sessionId, this.avatarIdx);
			this.avatarService.loadAvatar(this.sessionId, this.avatarIdx, true).subscribe();
		});
		this.avatarService.surveyRedo$.subscribe((redo: boolean) => {
			if (redo) {
				this.allowEditFeedback = true;
			}
		});
		this.resumeRequested = this.route.snapshot.queryParamMap.get('resume') === '1';
		this.sessionSubscription = this.session$.subscribe((session: any) => {
			if (session?.shortId) {
				this.avatarCode = formatAvatarCode(session.shortId, this.avatarIdx);
			}
			this.tryArmRejoin(session);
		});
	}

	joinGame(gameStateId: string) {
		this.cancelRejoin();
		this.avatarService
			.getCurrentPlayerStateIdx(this.sessionId, gameStateId, this.avatarIdx)
			.subscribe((data: any) => {
				if (data?.idx == undefined || data.idx === -1) {
					this.snackbarService.showError(this.i18n.instant('ERROR.JOIN_REINCARNATE'));
					return;
				}
				this.router.navigate(['player', this.sessionId, this.avatarIdx, gameStateId, data.idx]);
			});
	}

	isRejoinTarget(gameStateId: string): boolean {
		return this.rejoinCountdown !== null && this.rejoinTarget?.gameStateId === gameStateId;
	}

	cancelRejoin(): void {
		if (this.rejoinTicker) {
			clearInterval(this.rejoinTicker);
			this.rejoinTicker = null;
		}
		this.rejoinCountdown = null;
	}

	private tryArmRejoin(session: any): void {
		if (!this.resumeRequested || this.rejoinArmed || !session?.gamesRules) {
			return;
		}
		const joinable = session.gamesRules.filter(
			(game: any) =>
				game.gameStateId &&
				game.gameStatus &&
				game.gameStatus !== GAME_STATUS.NONE &&
				game.gameStatus !== GAME_STATUS.STOPPED
		);
		if (joinable.length !== 1) {
			return;
		}
		this.rejoinArmed = true;
		const gameStateId = joinable[0].gameStateId;
		this.avatarService.getCurrentPlayerStateIdx(this.sessionId, gameStateId, this.avatarIdx).subscribe({
			next: (data: any) => {
				if (data?.idx == undefined || data.idx === -1) {
					return;
				}
				this.rejoinTarget = { gameStateId, playerStateIdx: data.idx };
				this.rejoinCountdown = 5;
				this.rejoinTicker = setInterval(() => this.tickRejoin(), 1000);
			},
		});
	}

	private tickRejoin(): void {
		if (this.rejoinCountdown === null) {
			return;
		}
		this.rejoinCountdown -= 1;
		if (this.rejoinCountdown > 0) {
			return;
		}
		const target = this.rejoinTarget;
		this.cancelRejoin();
		if (target) {
			this.router.navigate(['player', this.sessionId, this.avatarIdx, target.gameStateId, target.playerStateIdx]);
		}
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription) this.subscription.unsubscribe();
		if (this.sessionSubscription) this.sessionSubscription.unsubscribe();
		this.cancelRejoin();
	}

	refresh() {
		window.location.reload();
	}

	toggleFullscreen() {
		this.fullscreenService.toggle();
	}

	onChangeSysScan() {
		this.localStorageService.setItem('scanV3', this.scanV3);
	}

	goToAvatarSettings() {
		this.router.navigate(['avatar', this.sessionId, this.avatarIdx, 'settings']);
	}

	flipCoin(rule: any) {
        this.audioService.playSound('coins');
		rule.rotate = true;
		setTimeout(() => {
			rule.rotate = false;
		}, 500);
	}

	openTutorial() {
		this.dialog.open(TutorialDialogComponent, {
			data: {},
			maxWidth: '700px',
			width: '95vw',
		});
	}

	modifyFeedback(gameStateId: string) {
		if (!this.allowEditFeedback) {
			this.dialog.open(InformationDialogComponent, {
				data: {
					title: this.i18n.instant('AVATAR.MODIFY_FEEDBACK'),
					message: this.i18n.instant('AVATAR.MODIFY_FEEDBACK_MESSAGE'),
				},
			});
		} else {
			this.router.navigate(['/survey', this.sessionId, gameStateId, this.avatarIdx, 'edit']);
		}
	}
}
