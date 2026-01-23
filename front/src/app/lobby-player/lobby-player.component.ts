import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {Avatar} from "../models/avatar";
import {AvatarService} from "../services/api/avatar.service";
import {createAvatar} from "@dicebear/core";
import {adventurer} from "@dicebear/collection";
import * as _ from "lodash-es";
import {Subscription} from "rxjs";

@Component({
	selector: 'app-lobby-player',
	templateUrl: './lobby-player.component.html',
	styleUrls: ['./lobby-player.component.scss']
})
export class LobbyPlayerComponent implements OnInit {
	avatar: Avatar = new Avatar();
	sessionId: string = "";
	avatarIdx: string = "";
	skin: string = "#f2d3b1";
	hairColor: string = "#ac6511";
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	private subscription: Subscription | undefined;

	constructor(private avatarService: AvatarService, private route: ActivatedRoute) {
	}

	ngOnInit() {
		this.subscription = this.route.params.subscribe(params => {
			this.sessionId = params['sessionId'];
			this.avatarIdx = params['avatarIdx'];
			this.loadAvatar();
		});
	}

	loadAvatar() {
		this.avatarService.getAvatar(this.sessionId, this.avatarIdx).subscribe(data => {
			this.avatar = data;
			// this.themesService.loadTheme(this.game.theme);

			// this.initPanels();
			// this.cards = [];
			if (this.avatar.image === "") {
				// this.options.seed = data.player.name.toString();
				// const avatar = createAvatar(adventurer, this.options);
				// this.avatar.image = avatar.toString();
			}
			// @ts-ignore
			// this.svgContainer.nativeElement.innerHTML = this.avatar.image;

			// this.localStorageService.setItem("session",
			// 	{
			// 		sessionId: this.sessionId,
			// 		avatarIdx: this.avatarIdx,
			// 		gameName: this.game.name,
			// 		avatar: this.avatar
			// 	});
		});
	}
}
