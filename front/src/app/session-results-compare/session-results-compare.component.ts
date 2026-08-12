import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of, catchError, switchMap } from 'rxjs';
import { ChartConfiguration, ChartDataset } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { DB_EVENTS, GAME_TYPE, IO, LK_KEYS, ROOMS, SESSION_STATUS } from '@geco/shared';
import { EventService } from '../services/api/event.service';
import { SurveyService, SurveyAnswer } from '../services/api/survey.service';
import { SessionService } from '../services/api/session.service';
import { GameStateService } from '../services/api/game-state.service';
import { WebSocketService } from '../services/web-socket.service';
import {
	SessionResultsService,
	FeelingDimension,
	FeelingPoint,
	GameResults,
	IndicatorChart,
	IndicatorSeries,
	LifeRef,
	LifeSeries,
	PodiumEntry,
	SeriesPoint,
} from '../services/session-results.service';
import { EventFilter, GecoEventV2 } from '../models/geco-event';
import { GameState } from '../models/gameState';
import { Session } from '../models/session';
import { Avatar } from '../models/avatar';
import { getRandomColor } from '../services/tools';

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

interface ChartBlock {
	key: string;
	title: string;
	data: ChartConfiguration<'line'>['data'];
	hasSecondaryAxis: boolean;
}

interface ScoreBar {
	entry: PodiumEntry;
	percent: number;
}

/** Every score of one game as bars, plus the two markers the bars are read against. */
interface ScoreBoard {
	bars: ScoreBar[];
	average: number;
	deviation: number;
	averagePercent: number;
	deviationPercent: number;
}

type GameKey = 'dette' | 'libre';

interface PodiumCard {
	key: GameKey;
	title: string;
	game: GameResults;
	board?: ScoreBoard;
}

/** Left ladder of the feelings chart, read top (+3, positive) to bottom (-3, negative). */
const FEELINGS_INTENSITIES = ['😊 Très', 'Assez', 'Un peu', 'neutre', 'Un peu', 'Assez', 'Très 😒'];

/**
 * ─── SessionResultsCompareComponent ─────────────────────────────────────────
 * Route:  results/:sessionId   (design "2a" — face à face)
 * Reads three sources with distinct roles (docs/adr/0012): each gameState is
 * authoritative for every end-state number, the persisted event stream supplies
 * the curves, and the survey supplies the feelings chart.
 */
@Component({
	selector: 'app-session-results-compare',
	templateUrl: './session-results-compare.component.html',
	styleUrls: ['./session-results-compare.component.scss'],
})
export class SessionResultsCompareComponent implements OnInit, OnDestroy {
	sessionId!: string;
	sessionName = '';
	location = '';
	sessionEnded = false;

	events: GecoEventV2[] = [];
	answers: SurveyAnswer[] = [];
	avatars: Avatar[] = [];

	dette?: GameResults;
	libre?: GameResults;
	detteGsId = '';
	libreGsId = '';
	lives: LifeRef[] = [];
	/** identité stable (recréer ce tableau à chaque cycle casse les clics) ; label = clé i18n */
	games: { id: string; label: string }[] = [];

	cardsIncluded = true;
	scoreBars: { [key in GameKey]: boolean } = { dette: false, libre: false };
	podiumCards: PodiumCard[] = [];
	eventsCollapsed = true;
	showHealth = false;
	sections = { accounts: false, feelings: false };
	legends: { [chart: string]: boolean } = {};

	synthesisRows: SynthesisRow[] = [];
	goodActions: ActionRow[] = [];
	badActions: ActionRow[] = [];
	detteCharts: ChartBlock[] = [];
	libreCharts: ChartBlock[] = [];
	chartRows: { dette?: ChartBlock; libre?: ChartBlock }[] = [];
	chartDetteFeel?: ChartConfiguration<'bubble'>['data'];
	chartLibreFeel?: ChartConfiguration<'bubble'>['data'];
	feelingsOpts: ChartConfiguration<'bubble'>['options'] = {};

	private joinedRooms: string[] = [];

	private readonly ACTION_META: { [type: string]: { label: string; icon: string } } = {
		[DB_EVENTS.ACTION_GIVE]: { label: 'Don', icon: '🫴' },
		[DB_EVENTS.ACTION_ONG]: { label: 'ONG', icon: '🤝' },
		[DB_EVENTS.ACTION_ASSOCIATION]: { label: 'Association', icon: '🧑‍🤝‍🧑' },
		[DB_EVENTS.ACTION_STEAL]: { label: 'Vol', icon: '💥' },
		[DB_EVENTS.ACTION_SILENT_STEAL]: { label: 'Vol silencieux', icon: '🤫' },
		[DB_EVENTS.ACTION_WAR]: { label: 'Guerre', icon: '⚔️' },
	};

	private readonly INDICATOR_META: { [key: string]: { label: string; color: string; dash: boolean } } = {
		[LK_KEYS.MASS_MONETARY]: { label: 'Masse monétaire', color: '#000000', dash: true },
		[LK_KEYS.DU]: { label: 'DU', color: '#f0932a', dash: true },
		ghostMoney: { label: 'Monnaie fantôme', color: '#9e9e9e', dash: true },
		averageMoney: { label: 'Monnaie moyenne / vie', color: '#5c6bc0', dash: true },
		goodsInPlay: { label: 'Biens en jeu', color: '#2e7d32', dash: true },
		ghostCards: { label: 'Biens fantômes', color: '#9e9e9e', dash: true },
		totalDebt: { label: 'Dette totale', color: '#b3261e', dash: true },
		[LK_KEYS.BANK_INTEREST_EARNED]: { label: 'Intérêts encaissés', color: '#8e24aa', dash: true },
		[LK_KEYS.BANK_MONEY_LOST]: { label: 'Monnaie perdue', color: '#d81b60', dash: true },
		[LK_KEYS.BANK_MONEY_DESTROYED]: { label: 'Monnaie détruite', color: '#6d4c41', dash: true },
		[LK_KEYS.BANK_GOODS_EARNED]: { label: 'Biens saisis', color: '#00897b', dash: true },
	};

	onEventsFilter(_f: EventFilter): void {}

	constructor(
		private route: ActivatedRoute,
		private eventService: EventService,
		private surveyService: SurveyService,
		private sessionService: SessionService,
		private gameStateService: GameStateService,
		private wsService: WebSocketService,
		private results: SessionResultsService
	) {}

	ngOnInit(): void {
		this.sessionId = this.route.snapshot.params['sessionId'];
		forkJoin({
			session: this.sessionService.getById(this.sessionId).pipe(catchError(() => of(null as Session | null))),
			events: this.eventService.getBySessionId(this.sessionId).pipe(catchError(() => of([] as GecoEventV2[]))),
			answers: this.surveyService.getBySessionId(this.sessionId).pipe(catchError(() => of([] as SurveyAnswer[]))),
		})
			.pipe(
				switchMap((loaded) => {
					this.events = loaded.events ?? [];
					this.answers = loaded.answers ?? [];
					this.applySessionMeta(loaded.session);
					return forkJoin({
						dette: this.fetchGameState(this.detteGsId),
						libre: this.fetchGameState(this.libreGsId),
					});
				})
			)
			.subscribe(({ dette, libre }) => {
				this.computeAll(dette, libre);
				this.joinFeedbackRooms();
			});
	}

	ngOnDestroy(): void {
		this.wsService.off(IO.SESSION.NEW_FEEDBACK);
		this.joinedRooms.forEach((room) => this.wsService.leaveRoom(room));
		this.joinedRooms = [];
	}

	private fetchGameState(gameStateId: string) {
		if (!gameStateId) return of(null as GameState | null);
		return this.gameStateService.get(gameStateId, false).pipe(
			catchError(() => of(null)),
			switchMap((payload) => of((payload?.gameState ?? null) as GameState | null))
		);
	}

	private applySessionMeta(session: Session | null): void {
		if (!session) return;
		this.sessionName = session.name ?? '';
		this.location = session.location ?? '';
		this.sessionEnded = String(session.status ?? '') === SESSION_STATUS.ENDED;
		this.avatars = session.avatars ?? [];

		const rules = session.gamesRules ?? [];
		this.detteGsId = rules.find((r) => r.typeMoney === GAME_TYPE.DEBT)?.gameStateId ?? '';
		this.libreGsId = rules.find((r) => r.typeMoney === GAME_TYPE.JUNE)?.gameStateId ?? '';
		this.games = [
			...(this.detteGsId ? [{ id: this.detteGsId, label: 'EVENTS.TAB_DEBT' }] : []),
			...(this.libreGsId ? [{ id: this.libreGsId, label: 'EVENTS.TAB_FREE' }] : []),
		];
	}

	private computeAll(dette: GameState | null, libre: GameState | null): void {
		this.dette = dette ? this.results.compute(dette, this.events, this.avatars) : undefined;
		this.libre = libre ? this.results.compute(libre, this.events, this.avatars) : undefined;
		this.lives = [...(this.dette?.lives ?? []), ...(this.libre?.lives ?? [])];

		this.buildSynthesis();
		this.buildActions();
		this.buildPodiumCards();
		this.buildCharts();
		this.buildFeelings();
	}

	private joinFeedbackRooms(): void {
		this.wsService.on(IO.SESSION.NEW_FEEDBACK, () => {
			this.surveyService
				.getBySessionId(this.sessionId)
				.pipe(catchError(() => of([] as SurveyAnswer[])))
				.subscribe((answers) => {
					this.answers = answers ?? [];
					this.buildFeelings();
				});
		});
		[this.detteGsId, this.libreGsId]
			.filter((id) => !!id)
			.forEach((id) => {
				const room = ROOMS.gameState(id);
				this.joinedRooms.push(room);
				this.wsService.joinRoom(room);
			});
	}

	get partial(): boolean {
		return !this.dette || !this.libre;
	}

	get healthDivergences(): number {
		return (this.dette?.health.divergences.length ?? 0) + (this.libre?.health.divergences.length ?? 0);
	}

	get healthMismatches(): number {
		const count = (r?: GameResults) => (r ? r.health.rows.filter((row) => !row.agrees).length : 0);
		return count(this.dette) + count(this.libre);
	}

	toggleCardsIncluded(): void {
		this.cardsIncluded = !this.cardsIncluded;
		this.buildCharts();
	}

	private buildSynthesis(): void {
		const d = this.dette?.synthesis;
		const l = this.libre?.synthesis;
		const dash = '-';
		const row = (label: string, dv: string | number | undefined, lv: string | number | undefined): SynthesisRow => ({
			label,
			dette: dv ?? dash,
			libre: lv ?? dash,
		});
		if (!d && !l) {
			this.synthesisRows = [];
			return;
		}
		this.synthesisRows = [
			row('👥 Joueur·euses', d?.avatars, l?.avatars),
			row('🧬 Vies', d?.lives, l?.lives),
			row('💀 Morts', d?.deaths, l?.deaths),
			row('♻️ Renaissances', d?.rebirths, l?.rebirths),
			row('🛒 Transactions', d?.transactions, l?.transactions),
			row('💱 Valeur échangée', d?.totalExchangedValue, l?.totalExchangedValue),
			row('💰 Masse monétaire finale', d?.finalMassMonetary, l?.finalMassMonetary),
			row('➗ Monnaie moyenne / vie', d?.averageMoney, l?.averageMoney),
			row('👻 Monnaie fantôme', d?.ghostMoney, l?.ghostMoney),
			row('☀️ Monnaie fantôme (en DU)', dash, l?.ghostMoneyInDu),
			row('📦 Biens en jeu', d?.goodsInPlay, l?.goodsInPlay),
			row('🃏 Biens fantômes', d?.ghostCards, l?.ghostCards),
			row('🏦 Crédits contractés', d?.creditsTaken, dash),
			row('🧾 Dette restante', d?.totalDebt, dash),
			row('📈 Intérêts encaissés', d?.interestPaid, dash),
			row('🔒 Saisies', d?.seizures, dash),
			row('🕳️ Monnaie perdue', d?.bankMoneyLost, dash),
			row('🔥 Monnaie détruite', d?.bankMoneyDestroyed, dash),
			row('⚖️ Biens saisis', d?.bankGoodsEarned, dash),
			row('☀️ DU final', dash, l?.duFinal),
			row('☀️ Nombre de DU', dash, l?.duCount),
		];

		const cd = d?.creditDecisions;
		if (cd) {
			this.synthesisRows.push(
				row('🙋 1er crédit — oui (simple)', cd.acceptSingle, dash),
				row('🙌 1er crédit — oui (×2)', cd.acceptDouble, dash),
				row('🙅 1er crédit — non', cd.decline, dash),
				row('🤐 1er crédit — sans réponse', cd.noAnswer, dash),
				row('🧑‍🏫 Crédits (animateur)', cd.fromAnimator, dash),
				row('❓ Crédits (1re question)', cd.fromFirstQuestion, dash),
				row('🛎️ Crédits (auto-service)', cd.fromPlayerRequest, dash),
				row('⛔ Crédits refusés', cd.refused, dash)
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

	maxActionCount(rows: ActionRow[]): number {
		return Math.max(1, ...rows.map((r) => Math.max(r.dette, r.libre)));
	}

	/** One card per played game, each carrying both readings of the same ranking. */
	private buildPodiumCards(): void {
		this.podiumCards = [
			...(this.dette ? [{ key: 'dette' as GameKey, title: '🪙 MONNAIE DETTE', game: this.dette }] : []),
			...(this.libre ? [{ key: 'libre' as GameKey, title: '☀️ MONNAIE LIBRE', game: this.libre }] : []),
		].map((card) => ({ ...card, board: this.scoreBoard(card.game) }));
	}

	/**
	 * Turns the whole ranking into bars scaled against the same axis as the two markers,
	 * so the écart type marker stays inside the plot even when it overshoots the best score.
	 * @returns undefined when the game has no ranked avatar to chart.
	 */
	private scoreBoard(game?: GameResults): ScoreBoard | undefined {
		const entries = game?.podium ?? [];
		if (entries.length === 0) return undefined;
		const scores = entries.map((e) => e.score);
		const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
		const variance = scores.reduce((sum, s) => sum + (s - average) ** 2, 0) / scores.length;
		const deviation = Math.sqrt(variance);
		const scale = Math.max(1, ...scores, average + deviation);
		const round = (v: number) => Math.round(v * 10) / 10;
		return {
			bars: entries.map((entry) => ({ entry, percent: (entry.score / scale) * 100 })),
			average: round(average),
			deviation: round(deviation),
			averagePercent: (average / scale) * 100,
			deviationPercent: ((average + deviation) / scale) * 100,
		};
	}

	toggleScoreBars(key: GameKey): void {
		this.scoreBars[key] = !this.scoreBars[key];
	}

	/** Both games are charted side by side, so the blocks are paired by rank instead of poured into one grid. */
	private buildCharts(): void {
		this.detteCharts = this.dette ? this.chartsFor(this.dette, '🪙 Dette') : [];
		this.libreCharts = this.libre ? this.chartsFor(this.libre, '☀️ Libre') : [];
		const rows = Math.max(this.detteCharts.length, this.libreCharts.length);
		this.chartRows = Array.from({ length: rows }, (_, i) => ({
			dette: this.detteCharts[i],
			libre: this.libreCharts[i],
		}));
	}

	private chartsFor(game: GameResults, prefix: string): ChartBlock[] {
		if (this.cardsIncluded) {
			return [
				{
					key: `${game.gameStateId}-combined`,
					title: `${prefix} — Richesse (pièces + biens)`,
					data: { datasets: this.toLines(game.combined) },
					hasSecondaryAxis: false,
				},
			];
		}
		const coinsIndicators = game.indicators.filter((i) => i.chart === 'coins');
		const cardsIndicators = game.indicators.filter((i) => i.chart === 'cards');
		return [
			{
				key: `${game.gameStateId}-coins`,
				title: `${prefix} — Pièces`,
				data: { datasets: [...this.toLines(game.coins), ...this.toIndicatorLines(coinsIndicators)] },
				hasSecondaryAxis: coinsIndicators.some((i) => i.axis === 'secondary'),
			},
			{
				key: `${game.gameStateId}-cards`,
				title: `${prefix} — Biens`,
				data: { datasets: [...this.toLines(game.cardsValue), ...this.toIndicatorLines(cardsIndicators)] },
				hasSecondaryAxis: cardsIndicators.some((i) => i.axis === 'secondary'),
			},
			{
				key: `${game.gameStateId}-third`,
				title: game.isJune ? `${prefix} — Pièces rapportées au DU` : `${prefix} — Richesse nette (pièces + biens − dette)`,
				data: { datasets: this.toLines(game.third) },
				hasSecondaryAxis: false,
			},
		];
	}

	private buildFeelings(): void {
		const dette = this.detteGsId ? this.results.feelings(this.answers, this.detteGsId) : [];
		const libre = this.libreGsId ? this.results.feelings(this.answers, this.libreGsId) : [];
		this.chartDetteFeel = dette.length ? this.feelingsData(dette) : undefined;
		this.chartLibreFeel = libre.length ? this.feelingsData(libre) : undefined;
		this.feelingsOpts = this.feelingsOptions(dette.length ? dette : libre);
	}

	private toLines(series: LifeSeries[]): ChartDataset<'line'>[] {
		return series
			.filter((s) => s.points.length > 0)
			.map((s) => ({
				label: s.life.ordinal > 1 ? `${s.life.name} (${s.life.ordinal})` : s.life.name,
				data: s.points.map((pt) => ({ x: pt.x as any, y: pt.y })),
				borderColor: s.life.color,
				backgroundColor: s.life.color,
				pointBackgroundColor: s.life.color,
				pointBorderColor: s.life.color,
				borderWidth: 2,
				borderDash: s.life.ordinal > 1 ? [4, 3] : undefined,
				pointRadius: 1,
				stepped: 'before',
				tension: 0,
			})) as ChartDataset<'line'>[];
	}

	private toIndicatorLines(indicators: IndicatorSeries[]): ChartDataset<'line'>[] {
		return indicators.map((indicator) => {
			const meta = this.INDICATOR_META[indicator.key] ?? { label: indicator.key, color: '#455a64', dash: true };
			return {
				label: meta.label,
				data: indicator.points.map((pt: SeriesPoint) => ({ x: pt.x as any, y: pt.y })),
				borderColor: meta.color,
				backgroundColor: meta.color,
				borderDash: meta.dash ? [6, 4] : undefined,
				borderWidth: 2,
				pointRadius: 0,
				stepped: 'before',
				tension: 0,
				yAxisID: indicator.axis === 'secondary' ? 'y1' : 'y',
			} as ChartDataset<'line'>;
		});
	}

	/** One bubble per (dimension, answered value) ; its radius grows with how many players picked it, and each dimension draws a random colour. */
	private feelingsData(dims: FeelingDimension[]): ChartConfiguration<'bubble'>['data'] {
		return {
			datasets: dims.map((dim) => ({
				label: `${dim.negative} ↔ ${dim.positive}`,
				data: dim.points.map((pt) => ({ x: pt.x, y: pt.y, r: Math.log(pt.count * 2) * 6, count: pt.count })),
				backgroundColor: getRandomColor(),
			})),
		} as ChartConfiguration<'bubble'>['data'];
	}

	/**
	 * Hidden linear axes carry the values ; the visible category axes only label them —
	 * positive pole on top, negative pole at the bottom, intensity on the left.
	 * Their ranges are half a slot wider than the data so bubbles land on label centres.
	 */
	private feelingsOptions(dims: FeelingDimension[]): ChartConfiguration<'bubble'>['options'] {
		return {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						title: (items) => String(items[0]?.dataset?.label ?? ''),
						label: (item) => {
							const point = item.raw as FeelingPoint;
							return `${point.count} réponse(s) · ${point.y > 0 ? '+' : ''}${point.y}`;
						},
					},
				},
			},
			scales: {
				x: { display: false, min: -0.5, max: dims.length - 0.5 },
				y: { display: false, type: 'linear', min: -3.5, max: 3.5 },
				xPositive: {
					position: 'top',
					type: 'category',
					labels: dims.map((d) => d.positive),
					grid: { display: false },
				},
				xNegative: {
					position: 'bottom',
					type: 'category',
					labels: dims.map((d) => d.negative),
					grid: { display: false },
				},
				yIntensity: { position: 'left', type: 'category', labels: FEELINGS_INTENSITIES },
			},
		};
	}

	lineOpts(block: ChartBlock): ChartConfiguration<'line'>['options'] {
		return {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			elements: { line: { tension: 0 } },
			plugins: { legend: { display: !!this.legends[block.key] } },
			scales: {
				x: {
					type: 'time',
					time: { unit: 'minute', displayFormats: { minute: 'HH:mm' } },
					ticks: { source: 'auto' },
				},
				y: { min: 0, position: 'left' },
				...(block.hasSecondaryAxis
					? { y1: { min: 0, position: 'right' as const, grid: { drawOnChartArea: false } } }
					: {}),
			},
		};
	}

	toggleSection(k: keyof SessionResultsCompareComponent['sections']): void {
		this.sections[k] = !this.sections[k];
	}

	toggleLegend(chart: string): void {
		this.legends[chart] = !this.legends[chart];
	}

	timeOf(iso: string): string {
		const d = new Date(iso);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
	}
}
