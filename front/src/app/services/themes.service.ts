import {Injectable} from '@angular/core';
import {I18nService} from "./i18n.service";
import {HttpClient} from "@angular/common/http";
import {BehaviorSubject} from "rxjs";

@Injectable({
	providedIn: 'root'
})
export class ThemesService {
	icons: Record<string, string> = {};
	namespace = "";
	themes: Record<string, string> = {
		"THEME.CLASSIC": "classic",
		"THEME.EMOJIS": "emojis",
		"THEME.TWEMOJIS": "twemojis",
		"THEME.CUSTOM1": "custom1"
	};

	private _themeConfig$ = new BehaviorSubject<Record<string, string>>({
		type: "CARD",
		by: "level",
		folder: "classic",
		prefixFileName: "classic_"
	});
	readonly themeConfig$ = this._themeConfig$.asObservable();

	setThemeConfig(themeConfig: Record<string, string>) {
		this._themeConfig$.next(themeConfig);
	}
	getThemeConfig(): any {
		return this._themeConfig$.getValue();
	}

	constructor(private i18nService: I18nService, private http: HttpClient) {
	}

	loadTheme(themeKey: string): void {
		//load language translations for the theme
		if (themeKey === "THEME.CLASSIC") {
			this.setThemeConfig({
				type: "CARD",
				by: "level",
				folder: "classic",
				prefixFileName: "classic_"
			});
		} else {
			this.namespace = this.themes[themeKey];
			//load icons for the theme
			if (this.namespace === "twemojis") {
				//use emojis from twemojis  (twemoji is loaded via css)
				this.loadTwemojiCss();
				this.namespace = "emojis";
			} else {
				this.unloadTwemojiCss();
			}
			this.i18nService.loadNamespace("themes/" + this.namespace);
			const path = `assets/i18n/themes/${this.namespace}/icons.json`;
			this.http.get<Record<string, string>>(path).subscribe((icons: Record<string, string>) => {
				this.icons = icons;
				if (this.themes[themeKey] === "twemojis") {
					this.setThemeConfig({
						type: "TWEMOJI",
						by: "level",
						folder: "twemojis",
						prefixFileName: "twemojis_"
					});
				} else {
					this.setThemeConfig({
						type: icons["type"] as "CARD" | "EMOJI" | "TWEMOJI" | "SVG" | "PNG",
						by: "level",
						folder: this.namespace,
						prefixFileName: icons["prefixFileName"] as string
					});
				}
			});
		}
	}

	loadTwemojiCss() {
		if (document.getElementById('twemoji-css')) return;
		const link = document.createElement('link');
		link.id = 'twemoji-css';
		link.rel = 'stylesheet';
		link.href = 'https://cdn.jsdelivr.net/npm/twemoji-colr-font@latest/twemoji.css';
		document.head.appendChild(link);
	}

	unloadTwemojiCss() {
		const link = document.getElementById('twemoji-css');
		if (link) link.remove();
	}

	getIcon(key: string): string {
		return this.icons[key];
	}

	getPNG(key: string): string {
		return `assets/i18n/themes/${this.namespace}/images/${this.icons[key]}`;
	}

	getThemesKeys(): string[] {
		return Object.keys(this.themes);
	}
}
