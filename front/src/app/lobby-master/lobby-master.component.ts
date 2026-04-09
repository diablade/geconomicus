import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
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
import { WebSocketService } from '../services/web-socket.service';
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
export class LobbyMasterComponent implements OnInit, AfterViewInit, OnDestroy {
	sessionId = '';
	session: Session = new Session();
	protected readonly OPEN = SESSION_STATUS.OPEN;
	protected readonly IN_PROGRESS = SESSION_STATUS.IN_PROGRESS;
	protected readonly ENDED = SESSION_STATUS.ENDED;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly NONE = GAME_STATUS.NONE;
	protected readonly CREATED = GAME_STATUS.CREATED;
	protected readonly STARTED = GAME_STATUS.STARTED;
	protected readonly PLAYING = GAME_STATUS.PLAYING;
	protected readonly PAUSED = GAME_STATUS.PAUSED;
	protected readonly FINISHED = GAME_STATUS.FINISHED;

	private subscription: Subscription | undefined;
	joinLink = '';
	private socket: any;
	deleteUser = false;
	warningHairColorDuplicate = false;
	protected readonly environment = environment;
	faTrashCan = faTrashCan;
	faQrcode = faQrcode;
	faCogs = faCogs;
	faRightToBracket = faRightToBracket;
	faPencil = faPencil;
	faRotate = faRotate;
	faEye = faEye;
	faPeopleRoof = faPeopleRoof;

	constructor(
		private route: ActivatedRoute,
		private sessionService: SessionService,
		private rulesService: RulesService,
		private avatarService: AvatarService,
		private gameStateService: GameStateService,
		private snackbarService: SnackbarService,
		private wsService: WebSocketService,
		private i18nService: I18nService,
		private audioService: AudioService,
		public dialog: MatDialog
	) {
		this.i18nService.loadNamespace('master');
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.socket = this.wsService.getSocket({publicChannel: this.sessionId, privateChannel: `${this.sessionId}:master`});
			this.getSession();
		});
	}

	getSession() {
		this.sessionService.getById(this.sessionId).subscribe((session) => {
			this.session = session;
			this.checkDuplicateHairColors();
			this.joinLink = environment.WEB_HOST + 'join/' + this.sessionId;
		});
	}

	ngAfterViewInit(): void {
		this.socket.on(IO.AVATAR.NEW, (data: any) => {
			this.session.avatars.push(data.avatar);
		});
		this.socket.on(IO.AVATAR.UPDATED, (data: any) => {
			this.session.avatars = this.session.avatars.map((p) => {
				if (p.idx == data.updatedAvatar.idx) {
					p = data.updatedAvatar;
				}
				return p;
			});
			this.checkDuplicateHairColors();
		});
		this.socket.on(IO.AVATAR.DELETED, (data: any) => {
			this.session.avatars = this.session.avatars.filter((p) => p.idx !== data.avatarIdx);
		});
	}

	ngOnDestroy(): void {
		if (this.subscription) this.subscription.unsubscribe();
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
		const dialogRef = this.dialog.open(SessionEditDialogComponent, {
			data: { session: _.clone(this.session) },
		});
		dialogRef.afterClosed().subscribe((results) => {
			if (results) {
				this.sessionService.update(this.sessionId, results).subscribe(() => {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.SAVED'));
				});
				this.session = { ...results };
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
				this.sessionService.start(this.sessionId).subscribe((data: Session) => {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.STARTED'));
					this.session = data;
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
				title: this.i18nService.instant('MASTER.OPEN_GAME_CONFIRM'),
				message: this.i18nService.instant('MASTER.OPEN_GAME_CONFIRM_2'),
				labelBtnConfirm: this.i18nService.instant('MASTER.OPEN_GAME'),
				styleBtnConfirm: 'warn',
			},
		});
		dialogRef.afterClosed().subscribe((results) => {
			if (results === 'btnConfirm') {
				this.gameStateService.create(this.sessionId, ruleIdx).subscribe((data: any) => {
					this.session.gamesRules = this.session.gamesRules.map((rules) => {
                        console.log('data', data);
						if (rules.idx == ruleIdx) {
							rules.gameStatus = data.gameStatus;
							rules.gameStateId = data.gameStateId;
						}
						return rules;
					});

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
                    this.session.gamesRules = this.session.gamesRules.map((rules) => {
                        if (rules.idx == ruleIdx) {
                            rules.gameStatus = data.gameStatus;
                            rules.gameStateId = data.gameStateId;
                        }
                        return rules;
                    });

                    this.snackbarService.showSuccess(this.i18nService.instant('MASTER.GAME_RESET'));
                });
			}
		});

    }

	enterGame(gameStateId: string) {
		// this.router.navigate(['/master', gameStateId]);
	}

	showResults() {}
}
