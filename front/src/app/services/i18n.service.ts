import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {Observable, tap} from 'rxjs';
import {environment} from '../../environments/environment';

/**
 * Service for handling internationalization (i18n) and translations
 * Provides caching, type safety, and development-time warnings for missing translations
 */
@Injectable({
	providedIn: 'root'
})
export class I18nService {
	private readonly STORAGE_KEY = 'language';
	private readonly DEFAULT_LANG = 'fr';
	private readonly SUPPORTED_LANGS = ['fr', 'en', 'it', 'es'];
	private translationCache = new Map<string, string>();
	private missingTranslations = new Set<string>();

  constructor(private translate: TranslateService) {
    this.initializeLanguage();
  }

	/**
	 * Initialize the language based on stored preference or browser language
	 */
	private initializeLanguage(): void {
		const savedLang = localStorage.getItem(this.STORAGE_KEY);
		const browserLang = this.translate.getBrowserLang();
		const initialLang = savedLang ||
			(browserLang && this.SUPPORTED_LANGS.includes(browserLang) ? browserLang : this.DEFAULT_LANG);

		this.use(initialLang);
	}

	/**
	 * Get instant translation with caching
	 * @param key Translation key
	 * @param params Optional parameters for interpolation
	 * @returns Translated string
	 */
	instant(key: string, params?: any): string {
		// Check cache first
		const cacheKey = `${key}-${JSON.stringify(params)}`;
		if (this.translationCache.has(cacheKey)) {
			return this.translationCache.get(cacheKey)!;
		}

		const translation = this.translate.instant(key, params);

		// Cache the result
		this.translationCache.set(cacheKey, translation);

		// Log missing translations in development
		if (translation === key && !environment.production) {
			this.missingTranslations.add(key);
			console.warn(`Missing translation for key: ${key}`);
		}

		return translation;
	}

	/**
	 * Get translation as observable with caching
	 * @param key Translation key
	 * @param params Optional parameters for interpolation
	 * @returns Observable of translated string
	 */
	get(key: string, params?: any): Observable<string> {
		return this.translate.get(key, params).pipe(
			tap(translation => {
				if (translation === key && !environment.production) {
					this.missingTranslations.add(key);
					console.warn(`Missing translation for key: ${key}`);
				}
			})
		);
	}
	
	onLangChange() {
		return this.translate.onLangChange;
	}

  /**
   * Set current language
   * @param lang Language code
   * @throws Error if language is not supported
   */
  use(lang: string): void {
    if (!this.SUPPORTED_LANGS.includes(lang)) {
			console.error(`Unsupported language: ${lang}`);
			lang='fr';
    }

    this.translate.use(lang);
    localStorage.setItem(this.STORAGE_KEY, lang);
    this.translationCache.clear(); // Clear cache when language changes
  }

	/**
	 * Get current language
	 * @returns Current language code
	 */
	getCurrentLang(): string {
		return this.translate.currentLang;
	}

	/**
	 * Get list of supported languages
	 * @returns Array of supported language codes
	 */
	getSupportedLanguages(): string[] {
		return [...this.SUPPORTED_LANGS];
	}

	/**
	 * Get list of missing translations (development only)
	 * @returns Array of missing translation keys
	 */
	getMissingTranslations(): string[] {
		return Array.from(this.missingTranslations);
	}

	/**
	 * Clear translation cache
	 */
	clearCache(): void {
		this.translationCache.clear();
	}

	/**
	 * Set default language
	 * @param lang Language code
	 */
	setDefaultLang(lang: string): void {
		if (!this.SUPPORTED_LANGS.includes(lang)) {
			throw new Error(`Unsupported language: ${lang}`);
		}
		this.translate.setDefaultLang(lang);
	}

	/**
	 * Check if a translation key exists
	 * @param key Translation key to check
	 * @returns boolean indicating if the key exists
	 */
	hasKey(key: string): boolean {
		return this.translate.instant(key) !== key;
	}

	/**
	 * Get all available languages
	 * @returns Array of available language codes
	 */
	getLangs(): string[] {
		return this.translate.getLangs();
	}
}
