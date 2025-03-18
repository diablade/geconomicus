import { Component, Input, OnInit } from '@angular/core';
import { I18nService } from '../../services/i18n.service';

interface Language {
	flag: string;
	language: string;
	lang: string;
}

@Component({
	selector: 'app-language-btn',
	templateUrl: './language-btn.component.html',
	styleUrls: ['./language-btn.component.scss']
})
export class LanguageBtnComponent implements OnInit {
	languages: Language[] = [
		{flag: "🇫🇷", language: "Français", lang: "fr"},
		{flag: "🇪🇸", language: "Spanish", lang: "es"},
		{flag: "🇮🇹", language: "Italiano", lang: "it"},
		{flag: "🇬🇧", language: "English", lang: "en"},
		{flag: "🇷🇸", language: "Srpski", lang: "sr"},
		{flag: "🇯🇵", language: "日本語", lang: "ja"}
	];
		// {flag: "", language: "Roumanian", lang: "ro"}

	selectedLanguage: Language = this.languages[0];
	@Input() short = false;
	@Input() cornerScreen = false;

	constructor(private i18nService: I18nService) {}

	ngOnInit() {
		const currentLang = this.i18nService.getCurrentLang();
		this.selectedLanguage = this.languages.find(l => l.lang === currentLang) || this.languages[0];
	}

	switchLanguage(language: Language): void {
		this.selectedLanguage = language;
		this.i18nService.use(language.lang);
	}

	getCurrentLang(): string {
		const currentLang = this.i18nService.getCurrentLang();
		return currentLang;
	}

	changeLang(language: any) {
		this.i18nService.use(language.lang);
	}
}
