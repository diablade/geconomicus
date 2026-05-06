import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Session } from '../models/session';
import { Avatar } from '../models/avatar';
import { SessionService } from '../services/api/session.service';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import {
	faQrcode,
	faCogs,
	faTrashCan,
	faEye,
	faRightToBracket,
	faPencil,
	faPeopleRoof,
	faRotate,
} from '@fortawesome/free-solid-svg-icons';
import { MatDialog } from '@angular/material/dialog';
import { SnackbarService } from '../services/snackbar.service';
import { IO, GAME_TYPE, SESSION_STATUS, GAME_STATUS } from '@geco/shared';
import { I18nService } from '../services/i18n.service';
import { AudioService } from '../services/audio.service';
import * as _ from 'lodash-es';
import { ReJoinQrDialogComponent } from '../dialogs/re-join-qr-dialog/re-join-qr-dialog.component';
import { AvatarService } from '../services/api/avatar.service';
import { SessionEditDialogComponent } from '../dialogs/session-edit/session-edit-dialog.component';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { GameStateService } from '../services/api/game-state.service';
import { GameOptionsDialogComponent } from '../dialogs/game-options-dialog/game-options-dialog.component';
import { Rules } from '../models/rules';
import { fixDuplicateHairColors, groupeDuplicatedHairColor } from '../services/avatarTools';
import { RulesService } from '../services/api/rules.service';

@Component({
	selector: 'app-lobby-master',
	templateUrl: './lobby-master.component.html',
	styleUrls: ['./lobby-master.component.scss'],
})
export class LobbyMasterComponent implements OnInit, OnDestroy {
    protected readonly OPEN = SESSION_STATUS.OPEN;
	protected readonly IN_PROGRESS = SESSION_STATUS.IN_PROGRESS;
	protected readonly ENDED = SESSION_STATUS.ENDED;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly NONE = GAME_STATUS.NONE;
	protected readonly CREATED = GAME_STATUS.CREATED;
	protected readonly INITIALIZED = GAME_STATUS.INITIALIZED;
	protected readonly PLAYING = GAME_STATUS.PLAYING;
	protected readonly PAUSED = GAME_STATUS.PAUSED;
	protected readonly FINISHED = GAME_STATUS.FINISHED;
	protected readonly environment = environment;
	protected readonly faTrashCan = faTrashCan;
	protected readonly faQrcode = faQrcode;
	protected readonly faCogs = faCogs;
	protected readonly faRightToBracket = faRightToBracket;
	protected readonly faPencil = faPencil;
	protected readonly faRotate = faRotate;
	protected readonly faEye = faEye;
	protected readonly faPeopleRoof = faPeopleRoof;

	private subscription: Subscription | undefined;
	private sessionSubscription: Subscription | undefined;
	warningHairColorDuplicate = false;
	joinLink = '';
	deleteUser = false;
	sessionId = '';
	session$ = inject(SessionService).session$;
	session: Session = new Session();

	constructor(
		private route: ActivatedRoute,
		private sessionService: SessionService,
		private rulesService: RulesService,
		private avatarService: AvatarService,
		private gameStateService: GameStateService,
		private snackbarService: SnackbarService,
		private i18nService: I18nService,
		private audioService: AudioService,
		public dialog: MatDialog
	) {
		this.i18nService.loadNamespace('master');
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.joinLink = environment.WEB_HOST + 'join/' + this.sessionId;
			this.sessionService.loadSession(this.sessionId).subscribe();
		});

		// Subscribe to session$ to track current session value
		this.sessionSubscription = this.session$.subscribe((session) => {
			if (session) {
				this.session = session;
				this.checkDuplicateHairColors();
			}
		});
	}

	ngOnDestroy(): void {
		if (this.subscription) this.subscription.unsubscribe();
		if (this.sessionSubscription) this.sessionSubscription.unsubscribe();
	}

	onDeleteUser(player: Avatar) {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant('MASTER.DELETE_USER'),
				message: this.i18nService.instant('MASTER.DELETE_USER_CONFIRM', { player: player.name }),
				labelBtnConfirm: this.i18nService.instant('DELETE'),
				styleBtnConfirm: 'warn',
			},
		});
		dialogRef.afterClosed().subscribe((results) => {
			if (results === 'btnConfirm') {
				this.deletePlayer(player);
			}
		});
	}

	deletePlayer(player: Avatar) {
		this.sessionService.deleteAvatar(this.sessionId, player.idx);
	}

	createAvatarUrl(avatarIdx: number) {
		return environment.WEB_HOST + 'avatar/' + this.sessionId + '/' + avatarIdx;
	}

	copyPlayerLink(avatarIdx: number): void {
		navigator.clipboard
			.writeText(this.createAvatarUrl(avatarIdx))
			.then(() => this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.COPY_SUCCESS')))
			.catch((err) => console.error('Error copying: ', err));
	}


	reJoin(avatarIdx: number, username: string): void {
		const dialogRef = this.dialog.open(ReJoinQrDialogComponent, {
			data: {
				text: username,
				url: this.createAvatarUrl(avatarIdx),
			},
		});
		dialogRef.afterClosed().subscribe(() => {});
	}

	copyJoinLink(): void {
		navigator.clipboard
			.writeText(this.joinLink)
			.then(() => this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.COPY_SUCCESS')))
			.catch((err) => console.error('Error copying: ', err));
	}

	editSession() {
		const sessionData = {
            name: this.session.name,
			animator: this.session.animator,
			location: this.session.location,
			theme: this.session.theme,
            devMode: this.session.devMode,
		};
		const dialogRef = this.dialog.open(SessionEditDialogComponent, {
			data: { session: sessionData },
		});
		dialogRef.afterClosed().subscribe((results) => {
			if (results) {
				this.sessionService.update(this.sessionId, results).subscribe((data) => {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.SAVED'));
					// Reload session to get updated data
					// this.sessionService.loadSession(this.sessionId).subscribe();
					// this.session = { ...this.session, ...results };
				});
			}
		});
	}

	startSession() {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant('MASTER.START_CONFIRM'),
				message: this.i18nService.instant('MASTER.START_CONFIRM_2'),
				labelBtnConfirm: this.i18nService.instant('MASTER.START'),
				styleBtnConfirm: 'warn',
			},
		});
		dialogRef.afterClosed().subscribe((results) => {
			if (results === 'btnConfirm') {
				this.sessionService.start(this.sessionId).subscribe(() => {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.STARTED'));
					// Reload session to get updated data
					this.sessionService.loadSession(this.sessionId).subscribe();
				});
			}
		});
		this.checkDuplicateHairColors();
	}

	checkDuplicateHairColors() {
		if (this.session.status == SESSION_STATUS.IN_PROGRESS) {
			const groupes = groupeDuplicatedHairColor(this.session.avatars);
			if (groupes.length > 0) {
				this.warningHairColorDuplicate = true;
				this.snackbarService.showError(this.i18nService.instant('WARNING.DUPLICATE_COLOR'));
			} else {
				this.warningHairColorDuplicate = false;
			}
		}
	}

	async fixDuplicateHairColor() {
		const playersWithChangedColor: Avatar[] = fixDuplicateHairColors(this.session.avatars);

		// update avatars
		for (let i = 0; i < playersWithChangedColor.length; i++) {
			this.avatarService.updateAvatar(this.sessionId, playersWithChangedColor[i].idx, playersWithChangedColor[i], true);
		}
	}

	editRules(rules: Rules) {
		const dialogRef = this.dialog.open(GameOptionsDialogComponent, {
			data: {
				rules: _.clone(rules),
				playersLength: this.session.avatars.length,
				devMode: this.session.devMode,
			},
		});
		dialogRef.afterClosed().subscribe((results) => {
			if (results === 'default') {
				this.rulesService.resetDefault(this.sessionId, rules.idx).subscribe((data) => {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.SAVED'));
					this.session.gamesRules = this.session.gamesRules.map((rules) => {
						if (rules.idx == data.idx) {
							rules = { ...data };
						}
						return rules;
					});
				});
			} else if (results) {
				this.rulesService.update(this.sessionId, results).subscribe(() => {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.SAVED'));
					this.session.gamesRules = this.session.gamesRules.map((rules) => {
						if (rules.idx == results.idx) {
							rules = { ...rules, ...results };
						}
						return rules;
					});
				});
			}
		});
	}

	createGame(ruleIdx: number) {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant('MASTER.CREATE_GAME_CONFIRM'),
				message: this.i18nService.instant('MASTER.CREATE_GAME_CONFIRM_2'),
				labelBtnConfirm: this.i18nService.instant('MASTER.CREATE_GAME'),
				styleBtnConfirm: 'warn',
			},
		});
		dialogRef.afterClosed().subscribe((results) => {
			if (results === 'btnConfirm') {
				this.gameStateService.create(this.sessionId, ruleIdx).subscribe((data: any) => {
					const currentSession = this.session;
					currentSession.gamesRules = currentSession.gamesRules.map((rules) => {
						if (rules.idx == ruleIdx) {
							rules.gameStatus = data.gameStatus;
							rules.gameStateId = data.gameStateId;
						}
						return rules;
					});
					// Update the session subject
					this.sessionService.setSession({ ...currentSession });

					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.GAME_LAUNCHED'));
				});
			}
		});
	}

	killGame(ruleIdx: number, gameStateId: string) {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant('MASTER.KILL_GAME_CONFIRM'),
				message: this.i18nService.instant('MASTER.KILL_GAME_CONFIRM_2'),
				labelBtnConfirm: this.i18nService.instant('MASTER.KILL_GAME'),
				styleBtnConfirm: 'warn',
			},
		});
		dialogRef.afterClosed().subscribe((results) => {
			if (results === 'btnConfirm') {
				this.sessionService.killGame(this.sessionId, gameStateId, ruleIdx).subscribe((data: any) => {
					const currentSession = this.session;
					currentSession.gamesRules = currentSession.gamesRules.map((rules) => {
						if (rules.idx == ruleIdx && data.gameStateId == rules.gameStateId) {
							rules.gameStatus = data.ruleStatus;
							rules.gameStateId = "";
						}
						return rules;
					});
					// Update the session subject
					this.sessionService.setSession({ ...currentSession });

					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.GAME_RESET'));
				});
			}
		});
	}

	showResults() {}
}
