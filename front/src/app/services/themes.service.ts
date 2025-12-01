import {Injectable} from '@angular/core';
import {I18nService} from "./i18n.service";
import {HttpClient} from "@angular/common/http";
import {BehaviorSubject} from "rxjs";

@Injectable({
	providedIn: 'root'
})
export class ThemesService {
	icons: Record<string, string> = {};
	currentTheme: string = "";
	themes: Record<string, string> = {
		"THEME.CLASSIC": "classic",
		"THEME.EMOJIS": "emojis",
		"THEME.TWEMOJIS": "twemojis"
	};

	private _typeTheme$ = new BehaviorSubject<string>("CARD");
	readonly typeTheme$ = this._typeTheme$.asObservable();

	setTypeTheme(typeTheme: string) {
		this._typeTheme$.next(typeTheme);
	}

	constructor(private i18nService: I18nService, private http: HttpClient) {
	}

	loadTheme(themeKey: string): void {
		//load language translations for the theme
		if (themeKey === "THEME.CLASSIC") {
			this.setTypeTheme("CARD");
		} else {
			const namespace = this.themes[themeKey];
			let pathIcon = this.themes[themeKey];
			//load icons for the theme
			if (namespace === "twemojis") {
				//use emojis from twemojis  (twemoji is loaded via css)
				this.loadTwemojiCss();
				pathIcon = "emojis";
			} else {
				this.unloadTwemojiCss();
			}
			this.i18nService.loadNamespace("themes/" + pathIcon);
			const path = `assets/i18n/themes/${pathIcon}/icons.json`;
			this.http.get<Record<string, string>>(path).subscribe((icons: Record<string, string>) => {
				this.icons = icons;
				this.currentTheme = namespace;
				if (namespace === "twemojis") {
					this.setTypeTheme("TWEMOJI");
				} else {
					this.setTypeTheme(icons["type"] as "CARD" | "EMOJI" | "TWEMOJI" | "SVG" | "PNG");
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

	getTypeTheme(): string {
		return this._typeTheme$.value!;
	}

	getCurrentTheme(): string {
		return this.currentTheme;
	}

	getThemes(): Record<string, string> {
		return this.themes;
	}

	getThemesKeys(): string[] {
		return Object.keys(this.themes);
	}
}
