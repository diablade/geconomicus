import { Injectable } from '@angular/core';
import { I18nService } from './i18n.service';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class ThemesService {
	icons: Record<string, string> = {};
	currentTheme = '';
	themes: Record<string, string> = {
		'THEME.TWEMOJIS': 'twemojis',
		'THEME.EMOJIS': 'emojis',
		'THEME.CLASSIC': 'classic',
        'THEME.POKE':'poke'
	};

	private _typeTheme$ = new BehaviorSubject<string>('CARD');
	readonly typeTheme$ = this._typeTheme$.asObservable();

	setTypeTheme(typeTheme: string) {
		this._typeTheme$.next(typeTheme);
	}

	constructor(
		private i18nService: I18nService,
		private http: HttpClient
	) {}

	async loadTheme(themeKey: string): Promise<void> {
		//load language translations for the theme
		if (themeKey === 'THEME.CLASSIC') {
			this.setTypeTheme('CARD');
		} else {
			const namespace = this.themes[themeKey];
			let pathIcon = this.themes[themeKey];
			//load icons for the theme
			if (namespace === 'twemojis') {
				//use emojis from twemojis  (twemoji is loaded via css)
				this.loadTwemojiCss();
				pathIcon = 'emojis';
			} else {
				this.unloadTwemojiCss();
			}
			this.i18nService.loadNamespace('themes/' + pathIcon);
			const path = `assets/i18n/themes/${pathIcon}/icons.json`;
			this.http.get<Record<string, string>>(path).subscribe((icons: Record<string, string>) => {
				this.icons = namespace === 'twemojis' ? this.stripVariationSelectors(icons) : icons;
				this.currentTheme = namespace;
				if (namespace === 'twemojis') {
					this.setTypeTheme('TWEMOJI');
				} else {
					this.setTypeTheme(icons['type'] as 'CARD' | 'EMOJI' | 'TWEMOJI' | 'SVG' | 'PNG');
				}
			});
		}
	}

	loadTwemojiCss() {
		if (document.getElementById('twemoji-css')) return;
		const link = document.createElement('link');
		link.id = 'twemoji-css';
		link.rel = 'stylesheet';
		link.href = 'https://cdn.jsdelivr.net/npm/twemoji-colr-font@15.0.3/twemoji.css';
		document.head.appendChild(link);
	}

	unloadTwemojiCss() {
		const link = document.getElementById('twemoji-css');
		if (link) link.remove();
	}

	private stripVariationSelectors(icons: Record<string, string>): Record<string, string> {
		return Object.fromEntries(
			Object.entries(icons).map(([key, value]) => [key, value.replace(/\uFE0F/g, '')])
		);
	}

	getIcon(key: string): string {
		return this.icons[key];
	}

	getPNG(key: string): string {
		return `assets/i18n/themes/${this.currentTheme}/images/${this.icons[key]}`;
	}

	hasPNG(key: string): boolean {
		return this.getTypeTheme() === 'PNG' && !!this.icons[key]?.endsWith('.png');
	}

	getTypeTheme(): string {
		return this._typeTheme$.value!;
	}

	getThemeName(theme: string): string {
		return this.themes[theme];
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
