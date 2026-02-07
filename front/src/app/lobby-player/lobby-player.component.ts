import {AfterViewInit, Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {Avatar} from "../models/avatar";
import {AvatarService} from "../services/api/avatar.service";
import {Subscription} from "rxjs";
import {WebSocketService} from "../services/web-socket.service";
import C from "../../../../back/shared/constantes.mjs";
import {I18nService} from "../services/i18n.service";
import {faPencil, faRightToBracket} from '@fortawesome/free-solid-svg-icons';
import {Session} from "../models/session";
import {getBackgroundStyle} from "../services/avatarTools";

@Component({
	selector: 'app-lobby-player',
	templateUrl: './lobby-player.component.html',
	styleUrls: ['./lobby-player.component.scss']
})
export class LobbyPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
	protected readonly getBackgroundStyle = getBackgroundStyle;
	avatar: Avatar = new Avatar();
	sessionId: string = "";
	skin: string = "#f2d3b1";
	hairColor: string = "#ac6511";
	private subscription: Subscription | undefined;
	session = new Session();
	socket: any;
	C = C;
	faRightToBracket = faRightToBracket;
	faPencil = faPencil;

	constructor(private avatarService: AvatarService,
	            private route: ActivatedRoute,
	            private router: Router,
	            private i18n: I18nService,
	            private ws: WebSocketService) {
		this.i18n.loadNamespace("avatar");
	}

	ngOnInit() {
		this.subscription = this.route.params.subscribe(params => {
			this.sessionId = params['sessionId'];
			const avatarIdx = params['avatarIdx'];
			this.loadAvatar(this.sessionId, avatarIdx);
			this.subscription = this.ws.getReConnectionStatus().subscribe(data => {
				//TODO: handle reconnection status
				if (data) {
					this.refresh();
				}
			});
			this.socket = this.ws.getSocket(this.sessionId, "avatar" + avatarIdx);
		});
	}

	ngAfterViewInit() {
		this.socket.on(C.NEW_GAMES_RULES, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", avatarIdx: this.avatar.idx, _ackId: data._ackId});
			// this.session.gamesRules = this.session.gamesRules.push(data.game);
		});
		this.socket.on(C.UPDATED_RULES, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", avatarIdx: this.avatar.idx, _ackId: data._ackId});
			this.session.gamesRules = this.session.gamesRules.map((game: any) => {
				if (game.id === data.game.id) {
					return data.game;
				}
				return game;
			});
		});
		this.socket.on(C.CREATED_GAME_STATE, async (data: any) => {
			// change status of gameRules
		});
		this.socket.on(C.UPDATED_AVATAR, (data: any) => {
			if (data.idx == this.avatar.idx) {
				this.avatar = data;
			}
		});
		this.socket.on(C.UPDATED_SESSION, (data: any) => {
			//update session data if needed
		});
	}

	loadAvatar(sessionId: string, avatarIdx: number) {
		this.avatarService.getAvatar(sessionId, avatarIdx, true).subscribe(data => {
			this.avatar = data.avatar;
			this.session = data.session;
			console.log("Loaded avatar:", data);

			// this.localStorageService.setItem("session",
			// 	{
			// 		sessionId: this.sessionId,
			// 		avatarIdx: this.avatarIdx,
			// 		gameName: this.game.name,
			// 		avatar: this.avatar
			// 	});
		});
	}

	joinGame(game: any) {
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription) this.subscription.unsubscribe();
	}

	refresh() {
		window.location.reload();
	}

	goToAvatarSettings() {
		this.router.navigate(['avatar', this.sessionId, this.avatar.idx, 'settings']);
	}
}
