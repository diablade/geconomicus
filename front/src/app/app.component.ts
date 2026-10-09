import {Component, OnInit} from '@angular/core';
import { I18nService } from './services/i18n.service';
import { PwaUpdateService } from './services/pwa-update.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{
	title = 'Ğeconomicus';

	constructor(private pwaUpdateService: PwaUpdateService, private i18nService: I18nService) {
		this.i18nService.setDefaultLang('fr'); // Default language
		const savedLanguage = localStorage.getItem('language');
		if (savedLanguage) {
			this.i18nService.use(savedLanguage);
		}
	}

	public ngOnInit(): void {
		this.pwaUpdateService.init();
	}
}
