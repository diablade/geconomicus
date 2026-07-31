import {Component, OnInit} from '@angular/core';
import {SwUpdate, VersionReadyEvent} from "@angular/service-worker";
import {filter, map} from "rxjs";
import { I18nService } from './services/i18n.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{
	title = 'Ğeconomicus';

	constructor(private swUpdate: SwUpdate, private i18nService: I18nService) {
		this.i18nService.setDefaultLang('fr'); // Default language
		const savedLanguage = localStorage.getItem('language');
		if (savedLanguage) {
			this.i18nService.use(savedLanguage);
		}
	}

	public ngOnInit(): void {
		this.lockPinchZoom();
		if (this.swUpdate.isEnabled) {
			this.swUpdate.versionUpdates.pipe(
				filter((evt: any): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
				map((evt: any) => {
					console.info(`currentVersion=[${evt.currentVersion} | latestVersion=[${evt.latestVersion}]`);
					// this.modalVersion = true;
					window.location.reload();
				}),
			);
		}
	}

	private lockPinchZoom(): void {
		const block = (event: Event) => event.preventDefault();
		document.addEventListener('gesturestart', block, {passive: false});
		document.addEventListener('gesturechange', block, {passive: false});
		document.addEventListener('gestureend', block, {passive: false});
		document.addEventListener(
			'touchmove',
			(event: TouchEvent) => {
				if (event.touches.length > 1) {
					event.preventDefault();
				}
			},
			{passive: false},
		);
	}
}
