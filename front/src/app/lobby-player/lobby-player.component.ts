import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AvatarService } from '../services/api/avatar.service';
import { Subscription } from 'rxjs';
import { GAME_TYPE, GAME_STATUS } from '@geco/shared';
import { I18nService } from '../services/i18n.service';
import { faPencil, faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { getBackgroundStyle } from '../services/avatarTools';
import { AudioService } from '../services/audio.service';

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
	protected readonly GAME_FINISHED = GAME_STATUS.FINISHED;
	protected readonly GAME_NONE = GAME_STATUS.NONE;
	faRightToBracket = faRightToBracket;
	faPencil = faPencil;

	sessionId: string = '';
	avatarIdx: number = 0;
	avatar$ = inject(AvatarService).avatar$;
	session$ = inject(AvatarService).session$;

	skin: string = '#f2d3b1';
	hairColor: string = '#ac6511';
	private subscription: Subscription | undefined;

	constructor(
		private avatarService: AvatarService,
		private audioService: AudioService,
		private route: ActivatedRoute,
		private router: Router,
		private i18n: I18nService
	) {
		this.i18n.loadNamespace('avatar');
	}

	ngOnInit() {
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.avatarIdx = parseInt(params['avatarIdx']);
			// this.avatarService.initializeSocket(this.sessionId, this.avatarIdx);
			this.avatarService.loadAvatar(this.sessionId, this.avatarIdx, true).subscribe();
		});
	}

	joinGame(gameStateId: string) {
		this.avatarService.getCurrentPlayerStateIdx(this.sessionId, gameStateId, this.avatarIdx).subscribe((data: any) => {
			this.router.navigate(['player', this.sessionId, this.avatarIdx, gameStateId, data.idx]);
		});
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription) this.subscription.unsubscribe();
	}

	refresh() {
		window.location.reload();
	}

	goToAvatarSettings() {
		this.router.navigate(['avatar', this.sessionId, this.avatarIdx, 'settings']);
	}

	coinClick() {
		this.audioService.playSound('coins');
	}
}
