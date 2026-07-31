import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { ChartConfiguration, ChartDataset } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { DB_EVENTS, GAME_TYPE } from '@geco/shared';
import { EventService } from '../services/api/event.service';
import { SurveyService, SurveyAnswer } from '../services/api/survey.service';
import { SessionService } from '../services/api/session.service';
import { SessionResultsService, GameResults, PlayerRef, PlayerSeries, SeriesPoint } from '../services/session-results.service';
import { EventFilter, GecoEventV2 } from '../models/geco-event';
import { Session } from '../models/session';

interface SynthesisRow {
	label: string;
	dette: string | number;
	libre: string | number;
}

interface ActionRow {
	label: string;
	icon: string;
	dette: number;
	libre: number;
}

/**
 * ─── SessionResultsCompareComponent ─────────────────────────────────────────
 * Route:  results/:sessionId   (design "2a" — face à face)
 * Fetches the whole session (both gameStates via gamesRules), the raw event
 * stream and the survey answers, then delegates the number crunching to
 * SessionResultsService and plots the ready-to-use series with Chart.js.
 * All filtering is client-side on the raw event stream.
 */
@Component({
	selector: 'app-session-results-compare',
	templateUrl: './session-results-compare.component.html',
	styleUrls: ['./session-results-compare.component.scss'],
})
export class SessionResultsCompareComponent implements OnInit {
	sessionId!: string;
	sessionName = '';
	location = '';

	// raw data
	events: GecoEventV2[] = [];
	answers: SurveyAnswer[] = [];

	// per game
	dette?: GameResults;
	libre?: GameResults;
	detteGsId = '';
	libreGsId = '';
	players: PlayerRef[] = [];
	private libreStartCoins = 5;

	// UI state
	showEvents = false;
	sections = { accounts: false, resources: false, feelings: false };
	legends: { [chart: string]: boolean } = {};
	openTip: string | null = null;

	// synthesis + actions
	synthesisRows: SynthesisRow[] = [];
	goodActions: ActionRow[] = [];
	badActions: ActionRow[] = [];

	// charts
	chartDetteAbs?: ChartConfiguration<'line'>['data'];
	chartLibreAbs?: ChartConfiguration<'line'>['data'];
	chartLibreRel?: ChartConfiguration<'line'>['data'];
	chartDetteRes?: ChartConfiguration<'line'>['data'];
	chartLibreRes?: ChartConfiguration<'line'>['data'];
	chartDetteFeel?: ChartConfiguration<'radar'>['data'];
	chartLibreFeel?: ChartConfiguration<'radar'>['data'];

	private readonly ACTION_META: { [type: string]: { label: string; icon: string } } = {
		[DB_EVENTS.ACTION_GIVE]: { label: 'Don', icon: '🫴' },
		[DB_EVENTS.ACTION_ONG]: { label: 'ONG', icon: '🤝' },
		[DB_EVENTS.ACTION_ASSOCIATION]: { label: 'Association', icon: '🧑‍🤝‍🧑' },
		[DB_EVENTS.ACTION_STEAL]: { label: 'Vol', icon: '💥' },
		[DB_EVENTS.ACTION_SILENT_STEAL]: { label: 'Vol silencieux', icon: '🤫' },
		[DB_EVENTS.ACTION_WAR]: { label: 'Guerre', icon: '⚔️' },
	};

	// le filtrage vit dans EventsV2Component ; le parent est juste notifié
	onEventsFilter(_f: EventFilter): void {
		// hook optionnel : surligner les joueurs filtrés sur les graphes, etc.
	}

	constructor(
		private route: ActivatedRoute,
		private eventService: EventService,
		private surveyService: SurveyService,
		private sessionService: SessionService,
		private results: SessionResultsService
	) {}

	ngOnInit(): void {
		this.sessionId = this.route.snapshot.params['sessionId'];
		// fail-soft per stream: a missing survey (or event) list must not blank the page.
		forkJoin({
			session: this.sessionService.getById(this.sessionId).pipe(catchError(() => of(null as Session | null))),
			events: this.eventService.getBySessionId(this.sessionId).pipe(catchError(() => of([] as GecoEventV2[]))),
			answers: this.surveyService.getBySessionId(this.sessionId).pipe(catchError(() => of([] as SurveyAnswer[]))),
		}).subscribe(({ session, events, answers }) => {
			this.events = events ?? [];
			this.answers = answers ?? [];
			this.applySessionMeta(session);
			this.computeAll();
		});
	}

	/** Extract both gameStateIds and the shared player list from the session. */
	private applySessionMeta(session: Session | null): void {
		if (!session) return;
		this.sessionName = session.name ?? '';
		this.location = session.location ?? '';

		const rules = session.gamesRules ?? [];
		const detteRule = rules.find((r) => r.typeMoney === GAME_TYPE.DEBT);
		const libreRule = rules.find((r) => r.typeMoney === GAME_TYPE.JUNE);
		this.detteGsId = detteRule?.gameStateId ?? '';
		this.libreGsId = libreRule?.gameStateId ?? '';
		this.libreStartCoins = libreRule?.startAmountCoins ?? 5;

		// playerStateIdx === avatar.idx (see game.state.service.js), shared by both games.
		this.players = (session.avatars ?? []).map((a) => ({
			idx: String(a.idx),
			name: a.name,
			color: a.hairColor || '#888888',
		}));
	}

	private computeAll(): void {
		// debt players start with 0 coins; june with rules.startAmountCoins.
		this.dette = this.results.compute(this.detteGsId, GAME_TYPE.DEBT, this.players, this.events, 0, 0);
		this.libre = this.results.compute(
			this.libreGsId,
			GAME_TYPE.JUNE,
			this.players,
			this.events,
			this.libreStartCoins,
			this.firstDuOf(this.libreGsId)
		);

		this.buildSynthesis();
		this.buildActions();
		this.buildCharts();
	}

	/** First distributed DU value for the june game (fold-fallback seed). */
	private firstDuOf(gsId: string): number {
		if (!gsId) return 0;
		const du = this.events.find(
			(e) => e.gameStateId === gsId && (e.typeEvent === DB_EVENTS.FIRST_DU || e.typeEvent === DB_EVENTS.DISTRIB_DU)
		);
		const p: any = du?.payload ?? {};
		return p.du ?? p.duLK ?? 0;
	}

	private buildSynthesis(): void {
		const d = this.dette?.synthesis;
		const l = this.libre?.synthesis;
		if (!d || !l) {
			this.synthesisRows = [];
			return;
		}
		this.synthesisRows = [
			{ label: '👥 Joueur·euses', dette: d.players, libre: l.players },
			{ label: '💀 Morts', dette: d.deaths, libre: l.deaths },
			{ label: '♻️ Renaissances', dette: d.rebirths, libre: l.rebirths },
			{ label: '🛒 Transactions', dette: d.transactions, libre: l.transactions },
			{ label: '💱 Valeur échangée', dette: d.totalExchangedValue, libre: l.totalExchangedValue },
			{ label: '💰 Masse monétaire finale', dette: d.finalMassMonetary, libre: l.finalMassMonetary },
			{ label: '➗ Masse / joueur·euse', dette: d.massMonetaryPerPlayer, libre: l.massMonetaryPerPlayer },
			{ label: '⚖️ Gini (comptes)', dette: d.giniCoins, libre: l.giniCoins },
			{ label: '⚖️ Gini (ressources)', dette: d.giniResources, libre: l.giniResources },
			{ label: '🏦 Crédits contractés', dette: d.creditsTaken ?? '-', libre: '-' },
			{ label: '📈 Intérêts payés', dette: d.interestPaid ?? '-', libre: '-' },
			{ label: '🔒 Saisies', dette: d.seizures ?? '-', libre: '-' },
			{ label: '☀️ DU final', dette: '-', libre: l.duFinal ?? '-' },
			{ label: '☀️ Nombre de DU', dette: '-', libre: l.duCount ?? '-' },
		];
		// Auto-bank: credit-decision breakdown (debt only). Only shown when the auto-bank
		// actually produced data (a first-question response, a refusal, or a self-service credit).
		const cd = d.creditDecisions;
		if (cd && (cd.acceptSingle || cd.acceptDouble || cd.decline || cd.fromFirstQuestion || cd.fromPlayerRequest || cd.refused)) {
			this.synthesisRows.push(
				{ label: '🙋 1er crédit — oui (simple)', dette: cd.acceptSingle, libre: '-' },
				{ label: '🙌 1er crédit — oui (×2)', dette: cd.acceptDouble, libre: '-' },
				{ label: '🙅 1er crédit — non', dette: cd.decline, libre: '-' },
				{ label: '🧑‍🏫 Crédits (animateur)', dette: cd.fromAnimator, libre: '-' },
				{ label: '❓ Crédits (1re question)', dette: cd.fromFirstQuestion, libre: '-' },
				{ label: '🛎️ Crédits (auto-service)', dette: cd.fromPlayerRequest, libre: '-' },
				{ label: '⛔ Crédits refusés', dette: cd.refused, libre: '-' }
			);
		}
	}

	private buildActions(): void {
		const goodTypes = [DB_EVENTS.ACTION_GIVE, DB_EVENTS.ACTION_ASSOCIATION, DB_EVENTS.ACTION_ONG];
		const badTypes = [DB_EVENTS.ACTION_STEAL, DB_EVENTS.ACTION_SILENT_STEAL, DB_EVENTS.ACTION_WAR];
		this.goodActions = goodTypes.map((t) => this.actionRow(t));
		this.badActions = badTypes.map((t) => this.actionRow(t));
	}

	private actionRow(typeEvent: string): ActionRow {
		const meta = this.ACTION_META[typeEvent] ?? { label: typeEvent, icon: '•' };
		return {
			label: meta.label,
			icon: meta.icon,
			dette: this.dette?.actions.find((a) => a.typeEvent === typeEvent)?.count ?? 0,
			libre: this.libre?.actions.find((a) => a.typeEvent === typeEvent)?.count ?? 0,
		};
	}

	/** max count across both games for a set of action rows (bar scaling). */
	maxActionCount(rows: ActionRow[]): number {
		return Math.max(1, ...rows.map((r) => Math.max(r.dette, r.libre)));
	}

	private buildCharts(): void {
		if (this.dette) {
			this.chartDetteAbs = {
				datasets: [...this.toLines(this.dette.coins), this.massLine(this.dette.massMonetary)],
			};
			this.chartDetteRes = { datasets: this.toLines(this.dette.resources) };
			this.chartDetteFeel = this.feelingsData(this.detteGsId, '#2c7fb8');
		}
		if (this.libre) {
			this.chartLibreAbs = {
				datasets: [...this.toLines(this.libre.coins), this.massLine(this.libre.massMonetary)],
			};
			this.chartLibreRel = { datasets: this.toLines(this.libre.coinsRelative) };
			this.chartLibreRes = { datasets: this.toLines(this.libre.resources) };
			this.chartLibreFeel = this.feelingsData(this.libreGsId, '#f0932a');
		}
	}

	private toLines(series: PlayerSeries[]): ChartDataset<'line'>[] {
		return series
			.filter((s) => s.points.length > 0)
			.map((s) => ({
				label: s.player.name,
				data: s.points.map((pt) => ({ x: pt.x as any, y: pt.y })),
				borderColor: s.player.color,
				backgroundColor: s.player.color,
				pointBackgroundColor: s.player.color,
				pointBorderColor: s.player.color,
				borderWidth: 2,
				pointRadius: 1,
				tension: 0,
			})) as ChartDataset<'line'>[];
	}

	private massLine(points: SeriesPoint[]): ChartDataset<'line'> {
		return {
			label: 'Masse monétaire',
			data: points.map((pt) => ({ x: pt.x as any, y: pt.y })),
			borderColor: '#000000',
			backgroundColor: '#000000',
			borderDash: [6, 4],
			borderWidth: 2,
			pointRadius: 0,
			tension: 0,
		} as ChartDataset<'line'>;
	}

	private feelingsData(gsId: string, color: string): ChartConfiguration<'radar'>['data'] {
		const dims = this.results.feelings(this.answers, gsId);
		return {
			labels: dims.map((d) => d.label),
			datasets: [
				{
					data: dims.map((d) => d.avg),
					label: 'Moyenne',
					borderColor: color,
					backgroundColor: color + '55',
					pointBackgroundColor: color,
				},
			],
		};
	}

	/* ── chart options (cached per legend state to avoid rebuilds) ── */
	private readonly lineOptsBase: ChartConfiguration<'line'>['options'] = {
		responsive: true,
		maintainAspectRatio: false,
		animation: false,
		elements: { line: { tension: 0 } },
		scales: {
			x: {
				type: 'time',
				time: { unit: 'minute', displayFormats: { minute: 'HH:mm' } },
				ticks: { source: 'auto' },
			},
			y: { min: 0 },
		},
	};

	lineOpts(showLegend?: boolean): ChartConfiguration<'line'>['options'] {
		return {
			...this.lineOptsBase,
			plugins: { legend: { display: !!showLegend } },
		};
	}

	readonly radarOpts: ChartConfiguration<'radar'>['options'] = {
		responsive: true,
		maintainAspectRatio: false,
		scales: { r: { min: 0, max: 5, ticks: { stepSize: 1 } } },
		plugins: { legend: { display: false } },
	};

	toggleSection(k: keyof SessionResultsCompareComponent['sections']): void {
		this.sections[k] = !this.sections[k];
	}
	toggleLegend(chart: string): void {
		this.legends[chart] = !this.legends[chart];
	}
	toggleTip(id: string): void {
		this.openTip = this.openTip === id ? null : id;
	}
}
