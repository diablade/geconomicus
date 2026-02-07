import {AfterViewInit, Component, OnDestroy, OnInit} from '@angular/core';
import {Session} from "../models/session";
import {Avatar} from "../models/avatar";
import {SessionService} from "../services/api/session.service";
import {ActivatedRoute} from "@angular/router";
import {Subscription} from "rxjs";
import {environment} from "../../environments/environment";
import {
	faQrcode, faCogs, faTrashCan, faEye,
	faRightToBracket, faPencil, faPeopleRoof
} from '@fortawesome/free-solid-svg-icons';
import {MatDialog} from "@angular/material/dialog";
import {SnackbarService} from "../services/snackbar.service";
import C from "../../../../back/shared/constantes.mjs";
import {WebSocketService} from "../services/web-socket.service";
import {I18nService} from "../services/i18n.service";
import {AudioService} from '../services/audio.service';
import * as _ from 'lodash-es';
import {ReJoinQrDialogComponent} from "../dialogs/re-join-qr-dialog/re-join-qr-dialog.component";
import {AvatarService} from "../services/api/avatar.service";
import {SessionEditDialogComponent} from "../dialogs/session-edit/session-edit-dialog.component";
import {ConfirmDialogComponent} from '../dialogs/confirm-dialog/confirm-dialog.component';
import {GameStateService} from "../services/api/game-state.service";
import {GameOptionsDialogComponent} from '../dialogs/game-options-dialog/game-options-dialog.component';
import {Rules} from '../models/rules';
import {fixDuplicateHairColors} from "../services/avatarTools";

@Component({
	selector: 'app-lobby-master',
	templateUrl: './lobby-master.component.html',
	styleUrls: ['./lobby-master.component.scss']
})
export class LobbyMasterComponent implements OnInit, AfterViewInit, OnDestroy {
	sessionId = "";
	session: Session = new Session();
	private subscription: Subscription | undefined;
	joinLink = "";
	private socket: any;
	deleteUser = false;
	protected readonly environment = environment;
	C = C;

	faTrashCan = faTrashCan;
	faQrcode = faQrcode;
	faCogs = faCogs;
	faRightToBracket = faRightToBracket;
	faPencil = faPencil;
	faEye = faEye;
	faPeopleRoof = faPeopleRoof;

	constructor(private route: ActivatedRoute,
	            private sessionService: SessionService,
	            private avatarService: AvatarService,
	            private gameStateService: GameStateService,
	            private snackbarService: SnackbarService,
	            private wsService: WebSocketService,
	            private i18nService: I18nService,
	            private audioService: AudioService,
	            public dialog: MatDialog) {
		this.i18nService.loadNamespace("master");
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.sessionId = params['sessionId'];
			this.socket = this.wsService.getSocket(this.sessionId, "lobby-master");
		});
		this.sessionService.getById(this.sessionId).subscribe(session => {
			this.session = session;
			this.joinLink = environment.WEB_HOST + "join/" + this.sessionId;
		});
	}

	ngAfterViewInit(): void {
		this.socket.on(C.UPDATED_AVATAR, (data: any) => {
			this.session.players = this.session.players.map(p => {
				if (p.idx == data.updatedAvatar.idx) {
					p = data.updatedAvatar;
				}
				return p;
			});
		});
		this.socket.on(C.NEW_AVATAR, (data: any) => {
			this.session.players.push(data.avatar);
		});
		this.socket.on(C.DELETED_AVATAR, (data: any) => {
			this.session.players = this.session.players.filter(p => p.idx !== data.avatarIdx);
		});
	}

	ngOnDestroy(): void {
		if (this.subscription)
			this.subscription.unsubscribe()
	}

	onDeleteUser(player: Avatar) {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant("MASTER.DELETE_USER"),
				message: this.i18nService.instant("MASTER.DELETE_USER_CONFIRM", {player: player.name}),
				labelBtnConfirm: this.i18nService.instant("DELETE"),
				styleBtnConfirm: "warn"
			},
		});
		dialogRef.afterClosed().subscribe(results => {
			if (results === "btnConfirm") {
				this.deletePlayer(player);
			}
		});
	}

	deletePlayer(player: Avatar) {
		this.avatarService.deleteAvatar(this.sessionId, player.idx).subscribe((res: any) => {
			if (res.acknowledged) {
				this.snackbarService.showSuccess(this.i18nService.instant("MASTER.DELETE_PLAYER_SUCCESS", {player: player.name}));
				this.session.players = this.session.players.filter(p => p.idx !== res.avatarIdx);
			}
		});
	}

	createAvatarUrl(avatarIdx: number) {
		return environment.WEB_HOST + "avatar/" + this.sessionId + '/' + avatarIdx;
	}

	reJoin(avatarIdx: number, username: string): void {
		const dialogRef = this.dialog.open(ReJoinQrDialogComponent, {
			data: {
				text: username,
				url: this.createAvatarUrl(avatarIdx)
			},
		});
		dialogRef.afterClosed().subscribe(() => {
		});
	}

	copyJoinLink(): void {
		navigator.clipboard.writeText(this.joinLink)
			.then(() => this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.COPY_SUCCESS")))
			.catch(err => console.error('Error copying: ', err));
	}

	editSession() {
		const dialogRef = this.dialog.open(SessionEditDialogComponent, {
			data: {session: _.clone(this.session)},
		});
		dialogRef.afterClosed().subscribe(results => {
			if (results) {
				this.sessionService.update(this.sessionId, results).subscribe(() => {
					this.snackbarService.showSuccess(this.i18nService.instant("MASTER.SAVED"));
				});
				this.session = {...results};
			}
		});
	}

	startSession() {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant("MASTER.START_CONFIRM"),
				message: this.i18nService.instant("MASTER.START_CONFIRM_2"),
				labelBtnConfirm: this.i18nService.instant("MASTER.START"),
				styleBtnConfirm: "warn"
			},
		});
		dialogRef.afterClosed().subscribe(results => {
			if (results === "btnConfirm") {
				this.sessionService.start(this.sessionId).subscribe((data: Session) => {
					this.snackbarService.showSuccess(this.i18nService.instant("MASTER.STARTED"));
					this.session = data
				});
			}
		});
	}

	async fixHairColor() {
		const playersWithChangedColor: Avatar[] = fixDuplicateHairColors(this.session.players);

		// update players
		for (let i = 0; i < playersWithChangedColor.length; i++) {
			this.avatarService.updateAvatar(this.sessionId, playersWithChangedColor[i].idx, playersWithChangedColor[i]).subscribe(
				data => {
					if (data) {
						this.snackbarService.showSuccess("color applied for player: " + playersWithChangedColor[i].name);
						this.forceRefreshAvatar(playersWithChangedColor[i]);
					}
				}
			);
		}
	}

	forceRefreshAvatar(avatar: Avatar) {
		this.snackbarService.showSuccess("Refresh Sended for player: " + avatar.name);
		this.avatarService.refreshForceAvatar(this.sessionId, avatar.idx).subscribe();
	}

	editRules(rules: Rules) {
		const dialogRef = this.dialog.open(GameOptionsDialogComponent, {
			data: {rules: _.clone(rules), playersLength: this.session.players.length},
		});
		dialogRef.afterClosed().subscribe(results => {
			if (results === "reset") {

			} else if (results) {
				this.sessionService.update(this.sessionId, results).subscribe(() => {
					this.snackbarService.showSuccess(this.i18nService.instant("MASTER.SAVED"));
				});
				this.session = {...results};
			}
		});
	}

	launchGame(ruleIdx: number) {
		this.gameStateService.launch(this.sessionId, ruleIdx).subscribe((data: any) => {
			this.session.gamesRules = this.session.gamesRules.map((rules) => {
				if (rules.idx == ruleIdx) {
					rules.gameStatus = C.CREATED_GAME_STATE;
					rules.gameStateId = data.gameStateId;
				}
				return rules;
			});
			// update session
			//update gameStateId and status

			this.snackbarService.showSuccess(this.i18nService.instant("MASTER.GAME_LAUNCHED"));
			//and redirect to masterBoard ...
		});
	}

	enterGame() {

	}

	showResults() {

	}

}
