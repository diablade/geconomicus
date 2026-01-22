import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from "@angular/router";
import { AvatarService } from "../services/api/avatar.service";
import { Subscription } from "rxjs";
import { AudioService } from '../services/audio.service';
import { I18nService } from '../services/i18n.service';

@Component({
	selector: 'app-join',
	templateUrl: './join.component.html',
	styleUrls: ['./join.component.scss']
})
export class JoinComponent implements OnInit, OnDestroy {
	sessionId = "";
	name = "";
	private subscription: Subscription | undefined;

	constructor(private route: ActivatedRoute, private router: Router, private avatarService: AvatarService, private i18n: I18nService) {
		this.i18n.loadNamespace('join');
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.sessionId = params['sessionId'];
		});
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription)
			this.subscription.unsubscribe()
	}

	join() {
		this.avatarService.join(this.sessionId, this.name).subscribe(avatarIdx => {
			this.router.navigate(['avatar', this.sessionId, avatarIdx, 'settings']);
		});
	}
}
