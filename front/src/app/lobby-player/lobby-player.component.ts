import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Avatar } from '../models/avatar';
import { AvatarService } from '../services/api/avatar.service';
import { Subscription } from 'rxjs';
import { WebSocketService } from '../services/web-socket.service';
import { IO, GAME_TYPE, GAME_STATUS } from '@geco/shared';
import { I18nService } from '../services/i18n.service';
import { faPencil, faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { Session } from '../models/session';
import { getBackgroundStyle } from '../services/avatarTools';

@Component({
	selector: 'app-lobby-player',
	templateUrl: './lobby-player.component.html',
	styleUrls: ['./lobby-player.component.scss'],
})
export class LobbyPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
	protected readonly getBackgroundStyle = getBackgroundStyle;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly GAME_STARTED = GAME_STATUS.STARTED;
	protected readonly GAME_CREATED = GAME_STATUS.CREATED;
	protected readonly GAME_PLAYING = GAME_STATUS.PLAYING;
	protected readonly GAME_PAUSED = GAME_STATUS.PAUSED;
	protected readonly GAME_FINISHED = GAME_STATUS.FINISHED;
	protected readonly GAME_NONE = GAME_STATUS.NONE;
	faRightToBracket = faRightToBracket;
	faPencil = faPencil;

	avatar: Avatar = new Avatar();
	sessionId: string = '';
	session = new Session();
	skin: string = '#f2d3b1';
	hairColor: string = '#ac6511';
	private subscription: Subscription | undefined;
	socket: any;

	constructor(
		private avatarService: AvatarService,
		private route: ActivatedRoute,
		private router: Router,
		private i18n: I18nService,
		private ws: WebSocketService
	) {
		this.i18n.loadNamespace('avatar');
	}

	ngOnInit() {
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			const avatarIdx = params['avatarIdx'];
			this.loadAvatar(this.sessionId, avatarIdx);
			this.subscription = this.ws.getReConnectionStatus().subscribe((data) => {
				//TODO: handle reconnection status
				if (data) {
					this.refresh();
				}
			});
			this.socket = this.ws.getSocket(this.sessionId, 'avatar' + avatarIdx);
		});
	}

	ngAfterViewInit() {
		this.socket.on(IO.SESSION.STARTED, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', avatarIdx: this.avatar.idx, _ackId: data._ackId });
			this.session.gamesRules = data.gamesRules;
		});
		this.socket.on(IO.SESSION.UPDATED, (data: any) => {
			this.session = {
				...this.session,
				...data
			};
		});
		this.socket.on(IO.GAME.KILLED, (data: any) => {
            this.session.gamesRules = this.session.gamesRules.map((rules) => {
                        if (rules.idx == data.idx) {
                            rules.gameStatus = data.gameStatus;
                            rules.gameStateId = "";
                        }
                        return rules;
                    });
		});
		this.socket.on(IO.GAME.CREATED, async (data: any, cb: (response: any) => void) => {
			cb({ status: 'ok', avatarIdx: this.avatar.idx, _ackId: data._ackId });
			this.session.gamesRules = this.session.gamesRules.map((game: any) => {
				if (game.idx === data.idx) {
					game.gameStateId = data.gameStateId;
					game.typeMoney = data.typeMoney;
					game.gameStatus = data.gameStatus;
				}
				return game;
			});
		});
		this.socket.on(IO.GAME.SETUP, async (data: any) => {
			// change status of gameRules
		});
		this.socket.on(IO.REFRESH_FORCE, async (data: any) => {
			this.refresh();
		});
		this.socket.on(IO.AVATAR.UPDATED, (data: any) => {
			if (data.idx == this.avatar.idx) {
				this.avatar = data;
			}
		});

	}

	loadAvatar(sessionId: string, avatarIdx: number) {
		this.avatarService.getAvatar(sessionId, avatarIdx, true).subscribe((data) => {
			this.avatar = data.avatar;
			this.session = data.session;

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
        this.router.navigate(['player', this.sessionId, this.avatar.idx, game.gameStateId, this.avatar.idx]);
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

    logGameStatus(game: any) {
        console.log(game.gameStatus);
    }
}
