import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from "@angular/router";
import { SessionService } from "../services/api/session.service";
import { Subscription } from "rxjs";
import { I18nService } from '../services/i18n.service';

@Component({
	selector: 'app-join',
	templateUrl: './join.component.html',
	styleUrls: ['./join.component.scss']
})
export class JoinComponent implements OnInit, OnDestroy {
	sessionId = "";
	name = "";
	fromUnknownAvatar = false;
	private subscription: Subscription | undefined;

	constructor(private route: ActivatedRoute, private router: Router, private sessionService: SessionService, private i18n: I18nService) {
		this.i18n.loadNamespace('join');
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.sessionId = params['sessionId'];
		});
		this.fromUnknownAvatar = this.route.snapshot.queryParamMap.get('newAvatar') === '1';
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription)
			this.subscription.unsubscribe()
	}

	join() {
		if (this.name) {
			this.sessionService.join(this.sessionId, this.name).subscribe((data: any) => {
				this.router.navigate(['avatar', this.sessionId, data.avatarIdx, 'settings']);
			});
		}
	}
}
