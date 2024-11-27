import {Component, Input} from '@angular/core';
import {TranslateService} from "@ngx-translate/core";

@Component({
	selector: 'app-language-btn',
	templateUrl: './language-btn.component.html',
	styleUrls: ['./language-btn.component.scss']
})
export class LanguageBtnComponent {
	languages = [
		{flag: "🇫🇷", language: "Français", lang: "fr"},
		{flag: "🇪🇸", language: "Spanish", lang: "es"},
		{flag: "🇮🇹", language: "Italiano", lang: "it"},
		{flag: "🇬🇧", language: "English", lang: "en"},
		{flag: "🇷🇸", language: "Srpski", lang: "sr"},
		{flag: "🇯🇵", language: "日本語", lang: "ja"}
	];
		// {flag: "", language: "Roumanian", lang: "ro"}

	selectedLanguage: any;
	@Input() short: boolean = false;

	constructor(private translate: TranslateService) {
		this.selectedLanguage = this.languages.find(l => l.lang === this.translate.currentLang);
	}

	switchLanguage(language: any) {
		this.selectedLanguage = language;
		this.translate.use(language.lang);
		localStorage.setItem('language', language.lang); // Save preference
	}
}
