import {AfterViewInit, Component, OnDestroy, OnInit} from '@angular/core';
import {Session} from "../models/session";
import {Avatar} from "../models/avatar";
import {SessionService} from "../services/api/session.service";
import {ActivatedRoute, Router} from "@angular/router";
import {Subscription} from "rxjs";
import {environment} from "../../environments/environment";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {
	faFlagCheckered, faQrcode, faCogs, faTrashCan,
	faCircleInfo, faWarning, faBuildingColumns,
	faRightToBracket, faEye
} from '@fortawesome/free-solid-svg-icons';
import {MatDialog} from "@angular/material/dialog";
import {SnackbarService} from "../services/snackbar.service";
// @ts-ignore
import C from "../../../../back/shared/constantes.mjs";
import {WebSocketService} from "../services/web-socket.service";
import {TranslateService} from "@ngx-translate/core";
import {I18nService} from "../services/i18n.service";
import {AudioService} from '../services/audio.service';
import * as _ from 'lodash-es';
import {ReJoinQrDialogComponent} from "../dialogs/re-join-qr-dialog/re-join-qr-dialog.component";
import {AvatarService} from "../services/api/avatar.service";

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
	faFlagCheckered = faFlagCheckered;
	faQrcode = faQrcode;
	faCogs = faCogs;
	faInfo = faCircleInfo;
	faRightToBracket = faRightToBracket;
	faWarning = faWarning;
	faBuildingColumns = faBuildingColumns;
	faEye = faEye;

	constructor(private route: ActivatedRoute,
	            private sessionService: SessionService,
	            private avatarService: AvatarService,
	            private snackbarService: SnackbarService,
	            private translate: TranslateService,
	            private router: Router,
	            private sanitizer: DomSanitizer,
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
		this.socket.on(C.UPDATED_AVATAR, (player: Avatar) => {
			this.session.players = this.session.players.map(p => {
				if (p.idx == player.idx) {
					p = player;
				}
				return p;
			});
		});
		this.socket.on(C.NEW_AVATAR, (player: Avatar) => {
			this.session.players.push(player);
		});
	}

	ngOnDestroy(): void {
		if (this.subscription)
			this.subscription.unsubscribe()
	}

	getSanitizedSvgFromString(svgString: string): SafeHtml {
		return this.sanitizer.bypassSecurityTrustHtml(svgString);
	}

	onDeleteUser(player: Avatar) {
		this.avatarService.deleteAvatar(player.idx, this.sessionId).subscribe((res: any) => {
			if (res.acknowledged) {
				this.snackbarService.showSuccess(this.i18nService.instant("MASTER.LOBBY.DELETE_PLAYER_SUCCESS", {player: player.name}));
				this.session.players = this.session.players.filter(p => p.idx !== res.avatarIdx);
			}
		});
	}

	enterGame() {

	}

	goToResults() {
		this.router.navigate(['results', this.sessionId]);
	}

	getUserUrl(avatarIdx: string) {
		return environment.WEB_HOST + "/s/" + this.sessionId + '/' + avatarIdx;
	}

	reJoin(avatarId: string, username: string): void {
		const dialogRef = this.dialog.open(ReJoinQrDialogComponent, {
			data: {
				text: username,
				url: this.getUserUrl(avatarId)
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

	showOptions() {
		// const dialogRef = this.dialog.open(GameOptionsDialogComponent, {
		// 	data: {game: _.clone(this.game)},
		// });
		// dialogRef.afterClosed().subscribe(results => {
		// 	if (results === "reset") {
		// 		this.resetGameFromBtn();
		// 	} else if (results === "cancel") {
		// 	} else {
		// 		this.backService.updateGame(this.idGame, results).subscribe(() => {
		// 			this.snackbarService.showSuccess(this.i18nService.instant("OPTION.SAVED"));
		// 		});
		// 		this.minutes = results.roundMinutes > 9 ? results.roundMinutes.toString() : "0" + results.roundMinutes.toString();
		// 		this.game = {...results};
		// 	}
		// });
	}
}
