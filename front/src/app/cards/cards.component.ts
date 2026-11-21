import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, catchError, forkJoin } from 'rxjs';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { I18nService } from '../services/i18n.service';
import { ThemesService } from '../services/themes.service';
import { Card } from '../models/gameState';

type KeyMap = Record<string, string>;

interface CardEntry {
	key: string;
	name: string;
	icon: string;
	png: string;
}

interface FamilyRow {
	family: CardEntry;
	levels: CardEntry[][];
}

const LEVELS = [0, 1, 2, 3];
const COPIES = [1, 2, 3, 4, 5];

@Component({
	selector: 'app-cards',
	templateUrl: './cards.component.html',
	styleUrls: ['./cards.component.scss'],
})
export class CardsComponent implements OnInit, OnDestroy {
	readonly faArrowLeft = faArrowLeft;
	readonly levels = LEVELS;
	readonly levelColors = ['red', 'yellow', 'green', 'blue'];
	readonly classicExample: Card[] = LEVELS.map((weight) => ({
		...new Card(),
		key: `A${weight}1`,
		letter: 'A',
		color: this.levelColors[weight],
		weight,
	}));
	readonly themeKeys: string[];
	themeKey = 'THEME.EMOJIS';
	rows: FamilyRow[] = [];
	private langSub?: Subscription;
	private loadSub?: Subscription;

	constructor(
		private http: HttpClient,
		private i18nService: I18nService,
		private themesService: ThemesService
	) {
		this.themeKeys = this.themesService.getThemesKeys();
	}

	/** Loads the page keys and the default theme, then reloads the card names whenever the language changes. */
	ngOnInit() {
		this.i18nService.loadNamespace('cards');
		this.load();
		this.langSub = this.i18nService.onLangChange().subscribe(() => this.load());
	}

	/** Stops listening to language changes and drops any pending theme fetch. */
	ngOnDestroy() {
		this.langSub?.unsubscribe();
		this.loadSub?.unsubscribe();
	}

	/** Whether the selected theme is the classic one, whose cards carry only a letter and a level. */
	get isClassic(): boolean {
		return this.themeKey === 'THEME.CLASSIC';
	}

	/** Whether the selected theme draws its emojis with the Twemoji font. */
	get isTwemoji(): boolean {
		return this.themeKey === 'THEME.TWEMOJIS';
	}

	/** Switches the table to another theme. */
	selectTheme(themeKey: string) {
		this.themeKey = themeKey;
		this.load();
	}

	/**
	 * Fetches the selected theme's names and icons straight from its files, so browsing here never
	 * overwrites the theme a game has loaded into the shared translations.
	 */
	load() {
		this.loadSub?.unsubscribe();
		if (this.isClassic) return;
		const base = `assets/i18n/themes/${this.themesService.getThemeFolder(this.themeKey)}`;
		const lang = this.i18nService.getCurrentLang() || 'fr';
		const names$ = this.http
			.get<KeyMap>(`${base}/${lang}.json`)
			.pipe(catchError(() => this.http.get<KeyMap>(`${base}/fr.json`)));
		const icons$ = this.http.get<KeyMap>(`${base}/icons.json`);
		if (this.isTwemoji) this.themesService.loadTwemojiCss();
		this.loadSub = forkJoin([names$, icons$]).subscribe(([names, icons]) => {
			this.rows = this.buildRows(names, this.isTwemoji ? this.themesService.stripVariationSelectors(icons) : icons, base);
		});
	}

	/** Turns a theme's flat key maps into one row per family, each holding its four levels of five cards. */
	private buildRows(names: KeyMap, icons: KeyMap, base: string): FamilyRow[] {
		const pngTheme = icons['type'] === 'PNG';
		const entry = (key: string): CardEntry => {
			const icon = icons[key] ?? '';
			const isPng = icon.endsWith('.png');
			return {
				key,
				name: names[key] ?? key,
				icon: pngTheme ? '' : icon,
				png: isPng ? `${base}/images/${icon}` : '',
			};
		};
		return Object.keys(names)
			.filter((key) => /^[A-Z]+$/.test(key))
			.map((letter) => ({
				family: entry(letter),
				levels: LEVELS.map((level) => COPIES.map((copy) => entry(`${letter}${level}${copy}`))),
			}));
	}
}
