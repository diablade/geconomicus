import { Component } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { I18nService } from '../services/i18n.service';
import {
	SimEvent,
	SimLogEntry,
	SimRequest,
	SimResponse,
	SimResult,
	SimVerdict,
	ToolsService,
} from '../services/api/tools.service';

const LOG_DISPLAY_CAP = 300;
const EVENT_DISPLAY_CAP = 200;
const ROUNDS_PER_MINUTE = 2;

const VIZ = {
	series1: '#2a78d6',
	series2: '#eb6834',
	series3: '#1baf7a',
	deckRamp: ['#ce1421', '#c4bb13', '#14a549', '#3c8fa2', '#e07a1f', '#8b5cc7'],
	divergingLow: '#2a78d6',
	divergingMid: '#f0efec',
	divergingHigh: '#e34948',
	good: '#0ca30c',
	critical: '#d03b3b',
	grid: '#e1e0d9',
	baseline: '#c3c2b7',
	muted: '#898781',
};

const SHAPE_KEYS: { [need: number]: string } = { 3: 'TRIANGLE', 4: 'SQUARE', 5: 'QUINTE' };

const PRICE_PRESETS: { [name: string]: number[] } = {
	debt: [1, 2, 4, 8],
	freeMoney: [3, 6, 9, 12],
};

@Component({
	selector: 'app-tools',
	templateUrl: './tools.component.html',
	styleUrls: ['./tools.component.scss'],
})
export class ToolsComponent {
	readonly viz = VIZ;

	request: SimRequest = {
		players: 14,
		typeMoney: 'june',
		seed: 1,
		rounds: 50,
		encountersPerRound: 3.25,
		animatorCreditsPerRound: 1,
		logActions: true,
		rules: {
			amountCardsForProd: 4,
			generatedIdenticalLetters: 5,
			generateLettersAuto: true,
			generateLettersInDeck: 10,
			distribInitCards: 4,
			autoDeath: true,
			inequalityStart: false,
			startAmountCoins: 5,
			tauxCroissance: 10,
			timerDUInterval: 60,
			durationCredit: 5,
			timerPrison: 5,
			defaultCreditAmount: 3,
			defaultInterestAmount: 1,
			priceWeight1: 1,
			priceWeight2: 2,
			priceWeight3: 4,
			priceWeight4: 8,
			autoBank: false,
			autoSeizure: false,
			firstCreditAcceptance: 0,
			seizureType: 'decote',
			seizureDecote: 33,
			seizureCosts: 2,
			techShiftEnabled: true,
			techShiftExchangeRatio: 1,
		},
		thresholds: { temperatureTolerance: 2, techShiftFloorRound: 25 },
	};

	running = false;
	error = '';
	result?: SimResult;
	verdict?: SimVerdict;
	elapsedMs = 0;

	optionsOpen = true;
	methodOpen = false;
	logOpen = false;
	tableOpen: { [chart: string]: boolean } = {};

	logFilter: { round: number | null; player: number | null; type: string } = {
		round: null,
		player: null,
		type: '',
	};
	readonly logDisplayCap = LOG_DISPLAY_CAP;

	eventsOpen = false;
	eventFilter = '';
	readonly eventDisplayCap = EVENT_DISPLAY_CAP;

	squaresChart?: ChartConfiguration<'line'>['data'];
	strandedChart?: ChartConfiguration<'line'>['data'];
	decksChart?: ChartConfiguration<'line'>['data'];
	moneyChart?: ChartConfiguration<'line'>['data'];
	avatarChart?: ChartConfiguration<'bar'>['data'];

	lineOpts: ChartConfiguration<'line'>['options'] = {};
	soloLineOpts: ChartConfiguration<'line'>['options'] = {};
	barOpts: ChartConfiguration<'bar'>['options'] = {};

	constructor(
		private toolsService: ToolsService,
		private i18n: I18nService
	) {
		this.i18n.loadNamespace('tools', 'en');
	}

	get shapeKey(): string {
		return SHAPE_KEYS[this.request.rules.amountCardsForProd] ?? 'CUSTOM';
	}

	get lettersMinted(): number {
		const rules = this.request.rules;
		const base = rules.generateLettersAuto
			? Math.round(1.25 * this.request.players)
			: (rules.generateLettersInDeck ?? 0);
		return base + 1;
	}

	get cardsPerLevel(): number {
		return this.lettersMinted * this.request.rules.generatedIdenticalLetters;
	}

	get alphabetOverflow(): number {
		return Math.max(0, this.lettersMinted - 52);
	}

	get roundsResolved(): number {
		return this.request.rounds;
	}

	get approxMinutes(): number {
		return Math.round(this.request.rounds / ROUNDS_PER_MINUTE);
	}

	get latentFloorResolved(): number {
		return this.request.thresholds.latentFloor ?? Math.max(1, Math.ceil(this.request.players / 2));
	}

	get isDebt(): boolean {
		return this.request.typeMoney !== 'june';
	}

	get temperatureBandKey(): string {
		return (this.result?.temperature.band ?? 'neutral').toUpperCase();
	}

	get temperatureNeedlePercent(): number {
		return this.ratioToPercent(this.result?.temperature.ratio ?? 1);
	}

	get deckLevels(): number[] {
		const levels = (this.result?.samples ?? []).reduce((max, s) => Math.max(max, s.deckSizes.length), 0);
		return Array.from({ length: levels }, (_, level) => level);
	}

	deckTotalOf(sample: { deckSizes: number[] }): number {
		return sample.deckSizes.reduce((sum, n) => sum + n, 0);
	}

	get retiredTotals(): { returned: number; drawn: number } | null {
		const shifts = this.result?.techShifts ?? [];
		if (!shifts.length) return null;
		const returned = shifts.reduce((sum, s) => sum + (s.retiredCards ?? 0), 0);
		if (!returned) return null;
		return { returned, drawn: shifts.reduce((sum, s) => sum + (s.replacementCards ?? 0), 0) };
	}

	get failedChecks(): { labelKey: string; labelParams?: object; detailKey: string; detailParams?: object }[] {
		return (this.verdict?.checks ?? []).filter((c) => !c.passed);
	}

	private ratioToPercent(ratio: number): number {
		const clamped = Math.min(8, Math.max(0.125, ratio));
		return ((Math.log2(clamped) + 3) / 6) * 100;
	}

	get toleranceBandStyle(): { left: string; width: string } {
		const tolerance = this.request.thresholds.temperatureTolerance ?? 2;
		const left = this.ratioToPercent(1 / tolerance);
		return { left: `${left}%`, width: `${this.ratioToPercent(tolerance) - left}%` };
	}

	get logTypes(): string[] {
		return [...new Set((this.result?.log ?? []).map((e) => e.type))].sort();
	}

	get logTypeCounts(): { type: string; count: number }[] {
		const counts = new Map<string, number>();
		for (const entry of this.result?.log ?? []) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
		return [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
	}

	get searchReasonRows(): { reason: string; count: number; sample: { price?: number; coins?: number } }[] {
		const reasons = this.result?.searchReasons ?? {};
		return Object.entries(reasons)
			.map(([reason, count]) => {
				const example = (this.result?.log ?? []).find((e) => e.reason === reason);
				return { reason, count, sample: { price: example?.reasonPrice, coins: example?.coins } };
			})
			.sort((a, b) => b.count - a.count);
	}

	get filteredLog(): SimLogEntry[] {
		const { round, player, type } = this.logFilter;
		return (this.result?.log ?? []).filter(
			(entry) =>
				(round === null || entry.round === Number(round)) &&
				(player === null || entry.playerIdx === Number(player)) &&
				(!type || entry.type === type)
		);
	}

	get visibleLog(): SimLogEntry[] {
		return this.filteredLog.slice(0, LOG_DISPLAY_CAP);
	}

	get eventTypeCounts(): { type: string; count: number }[] {
		const counts = new Map<string, number>();
		for (const event of this.result?.events ?? []) counts.set(event.typeEvent, (counts.get(event.typeEvent) ?? 0) + 1);
		return [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
	}

	get filteredEvents(): SimEvent[] {
		const events = this.result?.events ?? [];
		return this.eventFilter ? events.filter((e) => e.typeEvent === this.eventFilter) : events;
	}

	get visibleEvents(): SimEvent[] {
		return this.filteredEvents.slice(0, EVENT_DISPLAY_CAP);
	}

	eventPayloadOf(event: SimEvent): string {
		const domain = Object.entries(event.payload).filter(([key]) => !key.endsWith('LK'));
		return domain.length ? JSON.stringify(Object.fromEntries(domain)) : '—';
	}

	eventPartyOf(party: number | string): string {
		return typeof party === 'number' ? `#${party}` : String(party);
	}

	get roundActionCounts(): { round: number; costing: number; free: number; players: number }[] {
		const rows = new Map<number, { costing: number; free: number; players: Set<number> }>();
		for (const entry of this.result?.log ?? []) {
			if (!rows.has(entry.round)) rows.set(entry.round, { costing: 0, free: 0, players: new Set() });
			const row = rows.get(entry.round)!;
			if (entry.free) row.free++;
			else {
				row.costing++;
				row.players.add(entry.playerIdx);
			}
		}
		return [...rows.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([round, row]) => ({ round, costing: row.costing, free: row.free, players: row.players.size }));
	}

	get doubleActionRounds(): number[] {
		const seen = new Map<string, number>();
		for (const entry of this.result?.log ?? []) {
			if (entry.free || entry.playerIdx < 0) continue;
			const key = `${entry.round}|${entry.playerIdx}`;
			seen.set(key, (seen.get(key) ?? 0) + 1);
		}
		return [...new Set([...seen.entries()].filter(([, n]) => n > 1).map(([key]) => Number(key.split('|')[0])))];
	}

	get worstAvatarIdx(): number {
		const per = this.result?.productionsPerAvatar ?? [];
		return per.indexOf(Math.min(...per));
	}

	clearLogFilter(): void {
		this.logFilter = { round: null, player: null, type: '' };
	}

	toggleTable(chart: string): void {
		this.tableOpen[chart] = !this.tableOpen[chart];
	}

	applyPricePreset(preset: string): void {
		const [w1, w2, w3, w4] = PRICE_PRESETS[preset];
		this.request.rules.priceWeight1 = w1;
		this.request.rules.priceWeight2 = w2;
		this.request.rules.priceWeight3 = w3;
		this.request.rules.priceWeight4 = w4;
	}

	get activePricePreset(): string {
		const { priceWeight1, priceWeight2, priceWeight3, priceWeight4 } = this.request.rules;
		const current = [priceWeight1, priceWeight2, priceWeight3, priceWeight4].join(',');
		return Object.keys(PRICE_PRESETS).find((name) => PRICE_PRESETS[name].join(',') === current) ?? '';
	}

	get priceInDu(): number[] {
		const du = this.result?.finalDU ?? 0;
		const { priceWeight1, priceWeight2, priceWeight3, priceWeight4 } = this.request.rules;
		return [priceWeight1, priceWeight2, priceWeight3, priceWeight4].map((p) => Math.round(p * du * 100) / 100);
	}

	run(): void {
		this.running = true;
		this.error = '';
		this.toolsService.simulate(this.request).subscribe({
			next: (response: SimResponse) => {
				this.result = response.result;
				this.verdict = response.verdict;
				this.elapsedMs = response.elapsedMs;
				this.buildChartOptions();
				this.buildCharts(response.result);
				this.optionsOpen = false;
				this.running = false;
			},
			error: (err) => {
				this.error = err?.error?.message ?? err?.message ?? 'simulation failed';
				this.running = false;
			},
		});
	}

	randomSeed(): void {
		this.request.seed = Math.floor(Math.random() * 100000);
	}

	sessionRun(): void {
		this.run();
	}

	private scaleBase() {
		return {
			grid: { color: VIZ.grid, drawTicks: false },
			border: { color: VIZ.baseline },
			ticks: { color: VIZ.muted, font: { size: 11 } },
		};
	}

	private buildChartOptions(): void {
		const shared: ChartConfiguration<'line'>['options'] = {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			interaction: { mode: 'index', intersect: false },
			elements: { point: { radius: 0, hitRadius: 24, hoverRadius: 4 } },
			scales: {
				x: {
					type: 'linear',
					title: { display: true, text: this.i18n.instant('TOOLS.CHART.ROUND'), color: VIZ.muted },
					...this.scaleBase(),
				},
				y: { min: 0, ...this.scaleBase() },
			},
		};

		this.lineOpts = {
			...shared,
			plugins: {
				legend: { display: true, position: 'bottom', labels: { color: VIZ.muted, boxWidth: 10, boxHeight: 10 } },
			},
		};
		this.soloLineOpts = { ...shared, plugins: { legend: { display: false } } };
		this.barOpts = {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			scales: {
				x: {
					title: { display: true, text: this.i18n.instant('TOOLS.CHART.AVATAR'), color: VIZ.muted },
					...this.scaleBase(),
				},
				y: { min: 0, ...this.scaleBase() },
			},
			plugins: { legend: { display: false } },
		};
	}

	private line(label: string, points: number[], rounds: number[], colour: string) {
		return {
			label,
			data: points.map((y, i) => ({ x: rounds[i], y })),
			borderColor: colour,
			backgroundColor: colour,
			borderWidth: 2,
			stepped: true as const,
			tension: 0,
		};
	}

	private buildCharts(result: SimResult): void {
		const rounds = result.samples.map((s) => s.round);

		this.squaresChart = {
			datasets: [
				this.line(
					this.i18n.instant('TOOLS.CHART.THEORETICAL'),
					result.samples.map((s) => s.theoreticalSquares),
					rounds,
					VIZ.series1
				),
				this.line(
					this.i18n.instant('TOOLS.CHART.LATENT'),
					result.samples.map((s) => s.latentSquares),
					rounds,
					VIZ.series2
				),
				this.line(
					this.i18n.instant('TOOLS.CHART.READY'),
					result.samples.map((s) => s.readySquares),
					rounds,
					VIZ.series3
				),
			],
		};

		this.strandedChart = {
			datasets: [
				this.line(
					this.i18n.instant('TOOLS.CHART.STRANDED_SERIES'),
					result.samples.map((s) => Math.round(s.strandedShare * 1000) / 10),
					rounds,
					VIZ.series1
				),
			],
		};

		const deckLevels = result.samples.reduce((max, s) => Math.max(max, s.deckSizes.length), 0);
		this.decksChart = {
			datasets: Array.from({ length: deckLevels }, (_, level) =>
				this.line(
					this.i18n.instant('TOOLS.CHART.DECK_LEVEL', { level }),
					result.samples.map((s) => s.deckSizes[level] ?? 0),
					rounds,
					VIZ.deckRamp[level]
				)
			),
		};

		this.moneyChart = {
			datasets: [
				this.line(
					this.i18n.instant('TOOLS.CHART.MASS'),
					result.samples.map((s) => s.massMonetary),
					rounds,
					VIZ.series1
				),
			],
		};

		const worst = Math.min(...result.productionsPerAvatar);
		this.avatarChart = {
			labels: result.productionsPerAvatar.map((_, i) => String(i)),
			datasets: [
				{
					label: this.i18n.instant('TOOLS.CHART.PRODUCTIONS'),
					data: result.productionsPerAvatar,
					backgroundColor: result.productionsPerAvatar.map((n) => (n === worst ? VIZ.critical : VIZ.series1)),
					borderRadius: 4,
				},
			],
		};
	}
}
