import {Injectable} from '@angular/core';
import {I18nService} from "./i18n.service";
import {HttpClient} from "@angular/common/http";

@Injectable({
	providedIn: 'root'
})
export class ThemesService {
	icons: Record<string, string> = {};
	currentTheme: string = "emojis";
	currentIconType: "EMOJI" | "SVG" | "PNG" = "EMOJI";
	constructor(private i18nService: I18nService, private http: HttpClient) {
	}

	loadTheme(namespace: string): void {
		//load language translations for the theme
		this.i18nService.loadNamespace(namespace);

		//load icons for the theme
		const path = `assets/i18n/themes/${namespace}/icons.json`;
		this.http.get<Record<string, string>>(path).subscribe((icons: Record<string, string>) => {
			this.icons = icons;
			this.currentTheme = namespace;
			this.currentIconType = icons["type"] as "EMOJI" | "SVG" | "PNG";
		});
	}

	getIcon(key: string): string {
		return this.icons[key];
	}

	getIconType(): "EMOJI" | "SVG" | "PNG" {
		return this.currentIconType;
	}

	getTheme(): string {
		return this.currentTheme;
	}
}
