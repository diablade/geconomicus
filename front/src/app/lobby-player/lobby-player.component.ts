import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {Avatar} from "../models/avatar";
import {AvatarService} from "../services/api/avatar.service";
import {Subscription} from "rxjs";
import {WebSocketService} from "../services/web-socket.service";
import C from "../../../../back/shared/constantes.mjs";
import {I18nService} from "../services/i18n.service";

@Component({
	selector: 'app-lobby-player',
	templateUrl: './lobby-player.component.html',
	styleUrls: ['./lobby-player.component.scss']
})
export class LobbyPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
	avatar: Avatar = new Avatar();
	sessionId: string = "";
	avatarIdx: string = "";
	skin: string = "#f2d3b1";
	hairColor: string = "#ac6511";
	private subscription: Subscription | undefined;
	games: any;
	socket: any;
	C = C;
	private options: any;

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
			this.avatarIdx = params['avatarIdx'];
			this.subscription = this.ws.getReConnectionStatus().subscribe(data => {
				//TODO: handle reconnection status
				if (data) {
					this.refresh();
				}
			});
			this.socket = this.ws.getSocket(this.sessionId, "lobby-player");
			this.loadAvatar();
		});
	}

	ngAfterViewInit() {
		this.socket.on(C.NEW_GAMES_RULES, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", avatarIdx: this.avatarIdx, _ackId: data._ackId});
			this.games = this.games.push(data.game);
		});
		this.socket.on(C.UPDATED_RULES, async (data: any, cb: (response: any) => void) => {
			cb({status: "ok", avatarIdx: this.avatarIdx, _ackId: data._ackId});
			this.games = this.games.map((game: any) => {
				if (game.id === data.game.id) {
					return data.game;
				}
				return game;
			});
		});
		this.socket.on(C.GAME_STATE_CREATED, async (data: any) => {
			// change status of gameRules
		});
		this.socket.on(C.UPDATED_AVATAR, (data: any) => {
			if (data.id == this.avatarIdx) {
				this.avatar = data;
			}
		});
		this.socket.on(C.UPDATED_SESSION, (data: any) => {
			//update session data if needed
		});
	}

	loadAvatar() {
		this.avatarService.getAvatar(this.sessionId, this.avatarIdx).subscribe(data => {
			this.avatar = data;
			// console.log("Loaded avatar:", this.avatar);
			// this.themesService.loadTheme(this.game.theme);

			// this.localStorageService.setItem("session",
			// 	{
			// 		sessionId: this.sessionId,
			// 		avatarIdx: this.avatarIdx,
			// 		gameName: this.game.name,
			// 		avatar: this.avatar
			// 	});
		});
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription) this.subscription.unsubscribe();
	}

	refresh() {
		window.location.reload();
	}

	getBackgroundStyle() {
		switch (this.avatar.boardConf) {
			case "green":
				return {"background-image": "url('/assets/images/green-carpet.jpg')"};
			case "custom":
				return {"background-color": "" + this.avatar.boardColor};
			case "wood":
			default:
				return {"background-image": "url('/assets/images/woodJapAlt.jpg')"};
		}
	}

	goToAvatarSettings() {
		this.router.navigate(['avatar', this.sessionId, this.avatarIdx, 'settings']);
	}
}
