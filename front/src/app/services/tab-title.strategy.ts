import { Injectable, Injector } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { map, Observable, of, Subscription } from 'rxjs';
import { AvatarService } from './api/avatar.service';

const DEFAULT_TITLE = 'Ğeconomicus';

@Injectable({ providedIn: 'root' })
export class TabTitleStrategy extends TitleStrategy {
	private sub?: Subscription;

	constructor(
		private title: Title,
		private translate: TranslateService,
		private injector: Injector
	) {
		super();
	}

	/** Sets the browser tab title: the avatar's name on player views, else the translated route title. */
	override updateTitle(snapshot: RouterStateSnapshot): void {
		this.sub?.unsubscribe();
		let leaf = snapshot.root;
		while (leaf.firstChild) leaf = leaf.firstChild;
		const routeTitle = this.buildTitle(snapshot);
		let title$: Observable<string>;
		if (leaf.data['avatarTitle']) {
			title$ = this.injector.get(AvatarService).avatar$.pipe(map((avatar) => avatar?.name || DEFAULT_TITLE));
		} else {
			title$ = routeTitle ? this.translate.stream(routeTitle) : of(DEFAULT_TITLE);
		}
		this.sub = title$.subscribe((title) => this.title.setTitle(title));
	}
}
