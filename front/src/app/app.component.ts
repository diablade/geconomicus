import {Component, OnInit} from '@angular/core';
import {SwUpdate, VersionReadyEvent} from "@angular/service-worker";
import {filter, map} from "rxjs";
import {TranslateService} from "@ngx-translate/core";

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{
	title = 'Ğeconomicus';

	constructor(private swUpdate: SwUpdate, private translate: TranslateService) {
		this.translate.setDefaultLang('fr'); // Default language
		// Load preference on app start
		let savedLanguage = localStorage.getItem('language') || 'fr';
		translate.use(savedLanguage);
	}

	public ngOnInit(): void {
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
}
