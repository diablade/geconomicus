import {Component, OnInit, OnDestroy} from '@angular/core';
import {Router} from '@angular/router';
import {Subscription, interval} from 'rxjs';
import {faPlay, faPause, faRotateLeft, faCircleInfo, faArrowRightArrowLeft} from '@fortawesome/free-solid-svg-icons';
import {SimParams, SimResult, TaxSimulationService} from './tax-simulation.service';

/** Un preset = un repère historique réel. Les libellés/contextes sont dans les fichiers i18n (clé par id). */
interface FiscalPreset {
	id: string;
	marginalTopRate: number;
	accentColor: string;
	effectiveByDecile: number[]; // taux effectif moyen par décile (%), D1..D10
}

/** View-model d'une bulle SVG. */
interface Bubble {
	cx: number;
	cy: number;
	r: number;
	color: string;
	label: string;
	valueLabel: string;
	value: number;
}

const START_YEAR = 1983;
const VIEW_W = 1000;
const BAND_CENTER_Y = 150;
const MAX_RADIUS = 46;
const MS_PER_YEAR = 200;

/** Presets — repères historiques réels (taux marginaux documentés). Taux par décile = modèle pédagogique simplifié. */
const PRESETS: FiscalPreset[] = [
	{id: 'mitterrand', marginalTopRate: 65, accentColor: '#1d4e89', effectiveByDecile: [0, 1, 3, 6, 10, 14, 20, 28, 38, 52]},
	{id: 'sarkozy', marginalTopRate: 41, accentColor: '#c98a3c', effectiveByDecile: [0, 1, 2, 5, 8, 11, 15, 20, 27, 34]},
	{id: 'hollande', marginalTopRate: 45, accentColor: '#b56576', effectiveByDecile: [0, 1, 3, 6, 10, 14, 19, 26, 36, 50]},
	{id: 'macron', marginalTopRate: 45, accentColor: '#c0392b', effectiveByDecile: [0, 1, 2, 5, 8, 11, 14, 18, 24, 30]},
];

/** Valeurs par défaut du modèle (ancrées sur des ordres de grandeur INSEE / Piketty). */
const DEFAULTS = {
	decileIncome: [9960, 15890, 19400, 22430, 25310, 28290, 31670, 36040, 43010, 76970],
	savingsRate: [0, 0.02, 0.04, 0.06, 0.09, 0.12, 0.16, 0.22, 0.3, 0.42],
	capitalReturn: [0.005, 0.008, 0.011, 0.014, 0.018, 0.022, 0.028, 0.035, 0.043, 0.05],
	growthRate: 0.015,
	years: 40,
	initialWealthMultiple: 3,
};
const DEFAULT_TOP_RETURN = DEFAULTS.capitalReturn[9]; // 0.05, référence pour le slider "rendement du capital"

@Component({
	selector: 'app-module-fiscalite',
	templateUrl: './module-fiscalite.component.html',
	styleUrls: ['./module-fiscalite.component.scss'],
	providers: [TaxSimulationService],
})
export class ModuleFiscaliteComponent implements OnInit, OnDestroy {
	readonly presets = PRESETS;
	readonly startYear = START_YEAR;
	readonly viewW = VIEW_W;

	/** Sources réelles vérifiées (libellés = noms propres, non traduits). */
	readonly sources = [
		{label: 'IPP — Barème de l\'impôt sur le revenu depuis 1945', url: 'https://www.ipp.eu/baremes-ipp/impot-sur-le-revenu/bareme_ir_depuis_1945/bareme_ir/'},
		{label: 'IPP — 1914-2014 : cent ans d\'impôt sur le revenu (Note IPP n°12)', url: 'https://www.ipp.eu/wp-content/uploads/2014/07/n12-notesIPP-juillet2014.pdf'},
		{label: 'INSEE — Niveau de vie moyen par décile', url: 'https://www.insee.fr/fr/statistiques/2417897'},
		{label: 'Landais, Piketty & Saez — Pour une révolution fiscale', url: 'https://www.revolution-fiscale.fr/'},
	];

	// --- Sliders par décile : taux d'imposition effectif (%) ---
	taxRates: number[] = PRESETS[0].effectiveByDecile.slice();
	activePresetId: string | null = PRESETS[0].id;

	// --- Paramètres de simulation (éditables) ---
	decileIncome: number[] = DEFAULTS.decileIncome.slice();
	savingsRate: number[] = DEFAULTS.savingsRate.slice();
	capitalReturn: number[] = DEFAULTS.capitalReturn.slice();
	growthRatePct = DEFAULTS.growthRate * 100;     // %
	topCapitalReturnPct = DEFAULTS.capitalReturn[9] * 100; // %
	years = DEFAULTS.years;
	initialWealthMultiple = DEFAULTS.initialWealthMultiple;
	showAdvanced = false;

	// --- Comparaison ---
	compareEnabled = false;
	comparePresetId = 'macron';

	// --- Animation ---
	currentYearIndex = 0;
	isPlaying = false;

	// --- Résultats / rendu ---
	private simA!: SimResult;
	private simB: SimResult | null = null;
	private wealthRef = 1;
	bubblesA: Bubble[] = [];
	bubblesB: Bubble[] = [];
	ratioFinalA = 0;
	ratioCurrentA = 0;
	ratioFinalB = 0;
	ratioCurrentB = 0;

	private playSub: Subscription | null = null;
	private tweenHandle: number | null = null;

	// icônes
	readonly faPlay = faPlay;
	readonly faPause = faPause;
	readonly faRotateLeft = faRotateLeft;
	readonly faCircleInfo = faCircleInfo;
	readonly faArrowRightArrowLeft = faArrowRightArrowLeft;

	constructor(private router: Router, private sim: TaxSimulationService) {
	}

	ngOnInit(): void {
		this.recompute();
	}

	ngOnDestroy(): void {
		this.stopPlay();
		this.cancelTween();
	}

	// ----------------------------------------------------------------------------------
	// Paramètres dérivés
	// ----------------------------------------------------------------------------------
	get endYear(): number {
		return START_YEAR + this.years;
	}

	get displayYear(): number {
		return START_YEAR + this.currentYearIndex;
	}

	get activePreset(): FiscalPreset | null {
		return this.presets.find(p => p.id === this.activePresetId) ?? null;
	}

	get comparePreset(): FiscalPreset {
		return this.presets.find(p => p.id === this.comparePresetId) ?? this.presets[3];
	}

	/** Clé i18n du libellé du scénario courant (preset actif ou « personnalisé »). */
	get scenarioLabelKeyA(): string {
		return this.activePresetId ? 'MODULE.FISCALITE.PRESETS.' + this.activePresetId + '.LABEL' : 'MODULE.FISCALITE.CUSTOM';
	}

	get scenarioLabelKeyB(): string {
		return 'MODULE.FISCALITE.PRESETS.' + this.comparePresetId + '.LABEL';
	}

	private buildParams(): SimParams {
		return {
			decileIncome: this.decileIncome.map((v, i) => (v == null || !isFinite(v) || v <= 0) ? DEFAULTS.decileIncome[i] : v),
			savingsRate: this.savingsRate,
			capitalReturn: this.capitalReturn,
			growthRate: this.growthRatePct / 100,
			years: this.years,
			initialWealthMultiple: this.initialWealthMultiple,
		};
	}

	// ----------------------------------------------------------------------------------
	// Recalcul + rendu
	// ----------------------------------------------------------------------------------
	recompute(): void {
		// en comparaison, éviter deux bandes identiques (même preset des deux côtés)
		if (this.compareEnabled && this.activePresetId && this.comparePresetId === this.activePresetId) {
			const other = this.presets.find(p => p.id !== this.activePresetId);
			if (other) {
				this.comparePresetId = other.id;
			}
		}
		const params = this.buildParams();
		this.simA = this.sim.simulate(this.taxRates, params);
		this.simB = this.compareEnabled ? this.sim.simulate(this.comparePreset.effectiveByDecile, params) : null;

		this.wealthRef = Math.max(1, this.simA.maxWealth, this.simB ? this.simB.maxWealth : 0);
		if (this.currentYearIndex > this.years) {
			this.currentYearIndex = this.years;
		}
		this.renderFrame();
	}

	private renderFrame(): void {
		const t = Math.min(this.currentYearIndex, this.years);
		this.bubblesA = this.buildBand(this.simA);
		this.ratioFinalA = this.simA.ratioByYear[this.years];
		this.ratioCurrentA = this.simA.ratioByYear[t];

		if (this.simB) {
			this.bubblesB = this.buildBand(this.simB);
			this.ratioFinalB = this.simB.ratioByYear[this.years];
			this.ratioCurrentB = this.simB.ratioByYear[t];
		} else {
			this.bubblesB = [];
			this.ratioFinalB = 0;
			this.ratioCurrentB = 0;
		}
	}

	private buildBand(res: SimResult): Bubble[] {
		const t = Math.min(this.currentYearIndex, this.years);
		const cols = res.wealth.length;
		const colW = VIEW_W / cols;
		return res.wealth.map((row, d) => {
			const w = row[t];
			const r = MAX_RADIUS * Math.sqrt(Math.max(w, 0) / this.wealthRef);
			return {
				cx: colW * (d + 0.5),
				cy: BAND_CENTER_Y,
				r,
				color: this.decileColor(d),
				label: 'D' + (d + 1),
				value: w,
				valueLabel: this.formatMoney(w),
			};
		});
	}

	/** Dégradé bleu (D1) → rouge (D10) pour visualiser la progressivité. */
	decileColor(d: number): string {
		const hue = 210 * (1 - d / 9); // 210 (bleu) → 0 (rouge)
		return `hsl(${hue}, 62%, 48%)`;
	}

	// ----------------------------------------------------------------------------------
	// Interactions
	// ----------------------------------------------------------------------------------
	onTaxRateChange(): void {
		// modification manuelle d'un slider => on annule toute animation de preset en cours
		this.cancelTween();
		this.activePresetId = null;
		this.recompute();
	}

	applyPreset(preset: FiscalPreset): void {
		this.activePresetId = preset.id;
		this.tweenTaxRates(preset.effectiveByDecile.slice());
	}

	private cancelTween(): void {
		if (this.tweenHandle !== null) {
			cancelAnimationFrame(this.tweenHandle);
			this.tweenHandle = null;
		}
	}

	/** Anime tous les sliders vers les valeurs cibles (~0,5 s, easeInOutQuad). */
	private tweenTaxRates(target: number[]): void {
		this.cancelTween();
		const start = this.taxRates.slice();
		const duration = 500;
		let startTime: number | null = null;

		const step = (ts: number) => {
			if (startTime === null) {
				startTime = ts;
			}
			const k = Math.min(1, (ts - startTime) / duration);
			const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
			for (let d = 0; d < this.taxRates.length; d++) {
				this.taxRates[d] = Math.round((start[d] + (target[d] - start[d]) * e) * 10) / 10;
			}
			this.recompute();
			if (k < 1) {
				this.tweenHandle = requestAnimationFrame(step);
			} else {
				this.taxRates = target.slice();
				this.tweenHandle = null;
				this.recompute();
			}
		};
		this.tweenHandle = requestAnimationFrame(step);
	}

	onGrowthChange(): void {
		this.recompute();
	}

	onTopReturnChange(): void {
		// rescale le vecteur de rendement du capital en préservant sa forme
		const factor = (this.topCapitalReturnPct / 100) / DEFAULT_TOP_RETURN;
		this.capitalReturn = DEFAULTS.capitalReturn.map(v => v * factor);
		this.recompute();
	}

	onDurationChange(): void {
		if (this.currentYearIndex > this.years) {
			this.currentYearIndex = this.years;
		}
		this.recompute();
	}

	onIncomeChange(): void {
		this.recompute();
	}

	onScrub(): void {
		this.pause();
		this.renderFrame();
	}

	toggleCompare(): void {
		this.compareEnabled = !this.compareEnabled;
		this.recompute();
	}

	onComparePresetChange(): void {
		this.recompute();
	}

	// ----------------------------------------------------------------------------------
	// Lecture (play / pause / reset)
	// ----------------------------------------------------------------------------------
	togglePlay(): void {
		if (this.isPlaying) {
			this.pause();
		} else {
			this.play();
		}
	}

	play(): void {
		this.stopPlay();
		if (this.currentYearIndex >= this.years) {
			this.currentYearIndex = 0;
		}
		this.isPlaying = true;
		this.playSub = interval(MS_PER_YEAR).subscribe(() => {
			if (this.currentYearIndex >= this.years) {
				this.currentYearIndex = 0; // boucle
			} else {
				this.currentYearIndex++;
			}
			this.renderFrame();
		});
	}

	pause(): void {
		this.isPlaying = false;
		this.stopPlay();
	}

	private stopPlay(): void {
		if (this.playSub) {
			this.playSub.unsubscribe();
			this.playSub = null;
		}
	}

	resetAnimation(): void {
		this.pause();
		this.currentYearIndex = 0;
		this.renderFrame();
	}

	resetAll(): void {
		this.pause();
		this.cancelTween();
		this.decileIncome = DEFAULTS.decileIncome.slice();
		this.savingsRate = DEFAULTS.savingsRate.slice();
		this.capitalReturn = DEFAULTS.capitalReturn.slice();
		this.growthRatePct = DEFAULTS.growthRate * 100;
		this.topCapitalReturnPct = DEFAULTS.capitalReturn[9] * 100;
		this.years = DEFAULTS.years;
		this.initialWealthMultiple = DEFAULTS.initialWealthMultiple;
		this.currentYearIndex = 0;
		this.taxRates = PRESETS[0].effectiveByDecile.slice();
		this.activePresetId = PRESETS[0].id;
		this.recompute();
	}

	// ----------------------------------------------------------------------------------
	// Formatage
	// ----------------------------------------------------------------------------------
	formatMoney(v: number): string {
		if (v >= 1e6) {
			return (v / 1e6).toFixed(v / 1e6 >= 10 ? 0 : 1).replace('.', ',') + ' M€';
		}
		if (v >= 1e3) {
			return Math.round(v / 1e3) + ' k€';
		}
		return Math.round(v) + ' €';
	}

	formatRatio(v: number): string {
		return v >= 10 ? Math.round(v).toString() : v.toFixed(1).replace('.', ',');
	}

	home(): void {
		this.router.navigate(['home']);
	}
}
