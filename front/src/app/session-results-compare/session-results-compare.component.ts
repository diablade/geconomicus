import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
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
	IndicatorSeries,
	LifeRef,
	LifeSeries,
	PodiumEntry,
	SeriesPoint,
} from '../services/session-results.service';
import { GecoEventV2 } from '../models/geco-event';
import { GameState } from '../models/gameState';
import { Rules } from '../models/rules';
import { Session } from '../models/session';
import { Avatar } from '../models/avatar';
import { AddGameDialogComponent, AddGamePick } from '../dialogs/add-game-dialog/add-game-dialog.component';

/** One indicator of one game, already formatted for display. */
interface MetricRow {
	label: string;
	value: string | number;
	growth?: string;
}

interface ChartBlock {
	key: string;
	label: string;
	data: ChartConfiguration<'line'>['data'];
	hasSecondaryAxis: boolean;
	options: ChartConfiguration<'line'>['options'];
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

/** Everything one game contributes to the page, in the order the fiche renders it. */
interface GameCard {
	id: string;
	label: string;
	meta: string;
	color: string;
	isJune: boolean;
	game: GameResults;
	primary: MetricRow[];
	specific: MetricRow[];
	secondary: MetricRow[];
	board?: ScoreBoard;
	charts: ChartBlock[];
	feelings?: ChartConfiguration<'bubble'>['data'];
	feelingsOpts: ChartConfiguration<'bubble'>['options'];
	/** name of the session this game was borrowed from — absent for the session's own games */
	origin?: string;
}

/** Left ladder of the feelings chart, read top (+3, positive) to bottom (-3, negative). */
const FEELINGS_INTENSITIES = ['😊 Très', 'Assez', 'Un peu', 'neutre', 'Un peu', 'Assez', 'Très 😒'];

/** Tones of the two money colours already used by the score bars, one per game of that type. */
const DEBT_TONES = ['#1d5c87', '#2c7fb8', '#6aa9d4', '#9fd0f5'];
const JUNE_TONES = ['#b06407', '#d97e12', '#f0932a', '#f5b970'];

/** Fixed colour per survey dimension so the same question keeps its colour across every fiche. */
const FEELING_COLORS = [
	'#2c7fb8',
	'#d97e12',
	'#2e7d32',
	'#b3261e',
	'#6a4c93',
	'#00897b',
	'#c2185b',
	'#5d4037',
	'#455a64',
	'#7cb342',
];

/**
 * ─── SessionResultsCompareComponent ─────────────────────────────────────────
 * Route:  results/:sessionId   (design "fiches" — one card per game, side by side)
 * Reads three sources with distinct roles (docs/adr/0012): each gameState is
 * authoritative for every end-state number, the persisted event stream supplies
 * the curves, and the survey supplies the feelings chart.
 * Games come from the session's `rules` order (docs/adr/0020), so a session may
 * hold any mix of money types and any number of games.
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

	cards: GameCard[] = [];
	selected = new Set<string>();
	lives: LifeRef[] = [];
	/** identité stable (recréer ce tableau à chaque cycle casse les clics) */
	games: { id: string; label: string }[] = [];

	scoreBars = new Set<string>();
	chartChoice: { [gameStateId: string]: string } = {};
	legends: { [chart: string]: boolean } = {};
	eventsCollapsed = false;
	secondaryOpen = new Set<string>();
	healthOpen = new Set<string>();

	private rules: Rules[] = [];
	private joinedRooms: string[] = [];

	private readonly ACTION_META: { [type: string]: { label: string; icon: string } } = {
		[DB_EVENTS.ACTION_GIVE]: { label: 'Don', icon: '🫴' },
		[DB_EVENTS.ACTION_ONG]: { label: 'ONG', icon: '🤝' },
		[DB_EVENTS.ACTION_ASSOCIATION]: { label: 'Association', icon: '👥' },
		[DB_EVENTS.ACTION_STEAL]: { label: 'Vol', icon: '💥' },
		[DB_EVENTS.ACTION_SILENT_STEAL]: { label: 'Vol silencieux', icon: '🤫' },
		[DB_EVENTS.ACTION_WAR]: { label: 'Guerre', icon: '⚔' },
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

	constructor(
		private route: ActivatedRoute,
		private eventService: EventService,
		private surveyService: SurveyService,
		private sessionService: SessionService,
		private gameStateService: GameStateService,
		private wsService: WebSocketService,
		private results: SessionResultsService,
		private dialog: MatDialog
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
					const gameStates = this.rules.map((rule) => this.fetchGameState(rule.gameStateId));
					return gameStates.length ? forkJoin(gameStates) : of([] as (GameState | null)[]);
				})
			)
			.subscribe((gameStates) => {
				this.buildCards(gameStates);
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
		this.rules = (session.gamesRules ?? []).filter((rule) => !!rule.gameStateId);
	}

	/**
	 * Builds one card per played game, in rules order, and selects them all.
	 * Identity comes from the rules index, never from the money type: a session
	 * running two debt games would otherwise collapse them into one.
	 */
	private buildCards(gameStates: (GameState | null)[]): void {
		const seen = { debt: 0, june: 0 };
		this.cards = this.rules
			.map((rule, index) => ({ rule, gameState: gameStates[index] }))
			.filter((pair): pair is { rule: Rules; gameState: GameState } => !!pair.gameState)
			.map(({ rule, gameState }) => {
				const isJune = gameState.typeMoney === GAME_TYPE.JUNE;
				const ordinal = isJune ? ++seen.june : ++seen.debt;
				return this.makeCard(rule, gameState, isJune, ordinal, this.events, this.avatars);
			});

		this.selected = new Set(this.cards.map((card) => card.id));
		this.refreshDerived();
	}

	/** Everything one game contributes, computed once against the events and avatars of its own session. */
	private makeCard(
		rule: Rules,
		gameState: GameState,
		isJune: boolean,
		ordinal: number,
		events: GecoEventV2[],
		avatars: Avatar[],
		origin?: string
	): GameCard {
		const tones = isJune ? JUNE_TONES : DEBT_TONES;
		const game = this.results.compute(gameState, events, avatars);
		const onPage = this.cards.filter((card) => card.isJune === isJune).length;
		return {
			id: game.gameStateId,
			label: `${isJune ? 'Libre' : 'Dette'} ${ordinal}`,
			meta: this.metaOf(rule, game, isJune),
			color: tones[(origin ? onPage : ordinal - 1) % tones.length],
			isJune,
			game,
			primary: this.tidy(this.primaryRows(game)),
			specific: this.tidy(this.specificRows(game, isJune)),
			secondary: this.tidy(this.secondaryRows(game, isJune)),
			board: this.scoreBoard(game),
			charts: this.chartsFor(game, isJune),
			feelings: undefined,
			feelingsOpts: {},
			origin,
		};
	}

	/** Re-derives everything keyed off the card list, after cards are added or removed. */
	private refreshDerived(): void {
		this.cards.forEach((card) => {
			if (!this.chartChoice[card.id]) this.chartChoice[card.id] = card.charts[0]?.key ?? '';
		});
		this.lives = this.cards.flatMap((card) => card.game.lives);
		this.games = this.cards.map((card) => ({
			id: card.id,
			label: card.origin ? `${card.label} — ${card.origin}` : card.label,
		}));
		this.buildFeelings();
	}

	/** Identity line under a fiche title: what was configured, then how long it actually ran. */
	private metaOf(rule: Rules, game: GameResults, isJune: boolean): string {
		const parts: string[] = [];
		if (isJune && rule.tauxCroissance) parts.push(`croissance ${rule.tauxCroissance} %`);
		if (!isJune && rule.defaultInterestAmount) parts.push(`intérêt ${rule.defaultInterestAmount}`);
		if (!isJune && rule.autoBank) parts.push('banque auto');
		if (rule.roundMax) parts.push(`${rule.roundMax} tours`);
		if (game.synthesis.durationMin) parts.push(`${game.synthesis.durationMin} min`);
		return parts.join(' · ');
	}

	get shown(): GameCard[] {
		return this.cards.filter((card) => this.selected.has(card.id));
	}

	/** Counts one game's health problems: rows the two sources disagree on, plus divergences. */
	healthIssues(card: GameCard): number {
		return card.game.health.rows.filter((row) => !row.agrees).length + card.game.health.divergences.length;
	}

	/** Borrows one game of another session, for this visit only. */
	addGame(): void {
		this.dialog
			.open(AddGameDialogComponent, {
				data: { excludeSessionId: this.sessionId, alreadyShown: this.cards.map((card) => card.id) },
			})
			.afterClosed()
			.subscribe((pick?: AddGamePick) => {
				if (pick) this.attach(pick);
			});
	}

	/**
	 * Computes a borrowed game against its OWN session's events and avatars, then drops it
	 * beside the others. Nothing is stored, so a reload comes back to this session's games.
	 */
	private attach(pick: AddGamePick): void {
		const sessionId = String(pick.session._id ?? '');
		const rules = (pick.session.gamesRules ?? []).filter((rule) => !!rule.gameStateId);
		const rule = rules.find((r) => r.gameStateId === pick.gameStateId);
		if (!rule || !sessionId) return;
		forkJoin({
			gameState: this.fetchGameState(pick.gameStateId),
			events: this.eventService.getBySessionId(sessionId).pipe(catchError(() => of([] as GecoEventV2[]))),
			answers: this.surveyService.getBySessionId(sessionId).pipe(catchError(() => of([] as SurveyAnswer[]))),
		}).subscribe(({ gameState, events, answers }) => {
			if (!gameState) return;
			const isJune = gameState.typeMoney === GAME_TYPE.JUNE;
			const ordinal =
				rules.filter((r) => (r.typeMoney === GAME_TYPE.JUNE) === isJune).findIndex((r) => r.gameStateId === pick.gameStateId) + 1;
			const card = this.makeCard(
				rule,
				gameState,
				isJune,
				ordinal,
				events ?? [],
				pick.session.avatars ?? [],
				pick.session.name || 'autre session'
			);
			this.cards = [...this.cards, card];
			this.selected.add(card.id);
			this.events = [...this.events, ...(events ?? [])];
			this.answers = [...this.answers, ...(answers ?? [])];
			this.refreshDerived();
		});
	}

	/** Drops a borrowed game — the same thing a reload does, since none of it is stored. */
	removeCard(card: GameCard): void {
		if (!card.origin) return;
		this.cards = this.cards.filter((c) => c.id !== card.id);
		this.selected.delete(card.id);
		this.events = this.events.filter((e) => e.gameStateId !== card.id);
		this.answers = this.answers.filter((a) => a.gameStateId !== card.id);
		delete this.chartChoice[card.id];
		this.refreshDerived();
	}

	/** Toggles a game off the page, never letting the last one go. */
	toggle(card: GameCard): void {
		if (this.selected.has(card.id)) {
			if (this.selected.size === 1) return;
			this.selected.delete(card.id);
		} else {
			this.selected.add(card.id);
		}
	}

	/** The four indicators every game has, whatever its money type. */
	private primaryRows(game: GameResults): MetricRow[] {
		const s = game.synthesis;
		return [
			{ label: 'Transactions', value: s.transactions },
			{ label: 'Productions', value: s.productions },
			{
				label: 'Ressources en jeu',
				value: this.range(s.goodsFirst, s.goodsInPlay),
				growth: this.growth(s.goodsFirst, s.goodsInPlay),
			},
			{
				label: 'Masse monétaire',
				value: this.range(s.massFirst, s.finalMassMonetary),
				growth: this.growth(s.massFirst, s.finalMassMonetary),
			},
		];
	}

	/** What only this money type can have — the bank side, or the dividend side. */
	private specificRows(game: GameResults, isJune: boolean): MetricRow[] {
		const s = game.synthesis;
		if (isJune) {
			return [
				{
					label: 'Dividende Universel',
					value: this.range(s.duFirst, s.duFinal),
					growth: this.growth(s.duFirst, s.duFinal),
				},
				{ label: 'Nombre de DU', value: s.duCount ?? 0 },
				{ label: 'Monnaie fantôme (en DU)', value: s.ghostMoneyInDu ?? 0 },
			];
		}
		return [
			{
				label: 'Dette totale',
				value: this.range(s.debtFirst, s.totalDebt),
				growth: this.growth(s.debtFirst, s.totalDebt),
			},
			{ label: 'Crédits contractés', value: s.creditsTaken ?? 0 },
			{ label: 'Intérêts encaissés', value: s.interestPaid ?? 0 },
			{ label: 'Saisies', value: s.seizures ?? 0 },
			{ label: 'Monnaie perdue', value: s.bankMoneyLost ?? 0 },
			{ label: 'Monnaie détruite', value: s.bankMoneyDestroyed ?? 0 },
			{ label: 'Biens saisis', value: s.bankGoodsEarned ?? 0 },
		];
	}

	/** Everything worth keeping but not worth the top of the fiche, including the good and bad actions. */
	private secondaryRows(game: GameResults, isJune: boolean): MetricRow[] {
		const s = game.synthesis;
		const rows: MetricRow[] = [
			{ label: 'Valeur échangée', value: s.totalExchangedValue },
			{ label: 'Monnaie moyenne / vie', value: s.averageMoney },
			{ label: 'Monnaie fantôme', value: s.ghostMoney },
			{ label: 'Biens fantômes', value: s.ghostCards },
			{ label: 'Joueur·euses', value: s.avatars },
			{ label: 'Vies', value: s.lives },
			{ label: 'Morts', value: s.deaths },
			{ label: 'Renaissances', value: s.rebirths },
		];
		game.actions.forEach((action) => {
			const meta = this.ACTION_META[action.typeEvent] ?? { label: action.typeEvent, icon: '•' };
			rows.push({ label: `${meta.icon} ${meta.label}`, value: action.count });
		});
		const cd = !isJune ? s.creditDecisions : undefined;
		if (cd) {
			rows.push(
				{ label: '1er crédit — oui (simple)', value: cd.acceptSingle },
				{ label: '1er crédit — oui (×2)', value: cd.acceptDouble },
				{ label: '1er crédit — non', value: cd.decline },
				{ label: '1er crédit — sans réponse', value: cd.noAnswer },
				{ label: 'Crédits (animateur)', value: cd.fromAnimator },
				{ label: 'Crédits (1re question)', value: cd.fromFirstQuestion },
				{ label: 'Crédits (auto-service)', value: cd.fromPlayerRequest },
				{ label: 'Crédits refusés', value: cd.refused }
			);
		}
		return rows;
	}

	/** Start → end of an indicator, its whole run in one reading. */
	private range(first: number | undefined, last: number | undefined): string {
		if (last === undefined) return '—';
		return `${this.num(first ?? 0)} → ${this.num(last)}`;
	}

	/**
	 * Displays a number with at most two decimals, so float arithmetic noise never reaches the page.
	 * @returns an em dash when there is no number to show.
	 */
	num(value: number | undefined | null): string {
		if (value === undefined || value === null || !isFinite(value)) return '—';
		return String(Math.round(value * 100) / 100);
	}

	/** Runs every numeric cell of a metric list through the two-decimal display rule. */
	private tidy(rows: MetricRow[]): MetricRow[] {
		return rows.map((row) => (typeof row.value === 'number' ? { ...row, value: this.num(row.value) } : row));
	}

	/**
	 * Growth from start to end as a percentage.
	 * @returns undefined when there is nothing to divide by, which is why debt shows none.
	 */
	private growth(first: number | undefined, last: number | undefined): string | undefined {
		if (!first || last === undefined) return undefined;
		const pct = Math.round(((last - first) / first) * 100);
		return `${pct >= 0 ? '+' : ''}${pct} %`;
	}

	/**
	 * Turns the whole ranking into bars scaled against the same axis as the two markers,
	 * so the écart type marker stays inside the plot even when it overshoots the best score.
	 * @returns undefined when the game has no ranked avatar to chart.
	 */
	private scoreBoard(game: GameResults): ScoreBoard | undefined {
		const entries = game.podium ?? [];
		if (entries.length === 0) return undefined;
		const scores = entries.map((e) => e.score);
		const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
		const variance = scores.reduce((sum, s) => sum + (s - average) ** 2, 0) / scores.length;
		const deviation = Math.sqrt(variance);
		const scale = Math.max(1, ...scores, average + deviation);
		const round = (v: number) => Math.round(v * 100) / 100;
		return {
			bars: entries.map((entry) => ({ entry, percent: (entry.score / scale) * 100 })),
			average: round(average),
			deviation: round(deviation),
			averagePercent: (average / scale) * 100,
			deviationPercent: ((average + deviation) / scale) * 100,
		};
	}

	toggleScoreBars(card: GameCard): void {
		if (this.scoreBars.has(card.id)) this.scoreBars.delete(card.id);
		else this.scoreBars.add(card.id);
	}

	/** Opens or closes the secondary metrics of one fiche. */
	toggleSecondary(card: GameCard): void {
		if (this.secondaryOpen.has(card.id)) this.secondaryOpen.delete(card.id);
		else this.secondaryOpen.add(card.id);
	}

	/** Opens or closes the data-health block of one fiche. */
	toggleHealth(card: GameCard): void {
		if (this.healthOpen.has(card.id)) this.healthOpen.delete(card.id);
		else this.healthOpen.add(card.id);
	}

	/**
	 * The wealth views one fiche can switch between, money type deciding the last one.
	 * Options are built here rather than from the template: a fresh options object per
	 * change-detection cycle would re-render every chart of every fiche.
	 */
	private chartsFor(game: GameResults, isJune: boolean): ChartBlock[] {
		const coinsIndicators = game.indicators.filter((i) => i.chart === 'coins');
		const cardsIndicators = game.indicators.filter((i) => i.chart === 'cards');
		const blocks: ChartBlock[] = [
			{
				key: `${game.gameStateId}-combined`,
				label: 'Richesse',
				data: { datasets: this.toLines(game.combined) },
				hasSecondaryAxis: false,
				options: {},
			},
			{
				key: `${game.gameStateId}-coins`,
				label: 'Monnaie',
				data: { datasets: [...this.toLines(game.coins), ...this.toIndicatorLines(coinsIndicators)] },
				hasSecondaryAxis: coinsIndicators.some((i) => i.axis === 'secondary'),
				options: {},
			},
			{
				key: `${game.gameStateId}-cards`,
				label: 'Ressources',
				data: { datasets: [...this.toLines(game.cardsValue), ...this.toIndicatorLines(cardsIndicators)] },
				hasSecondaryAxis: cardsIndicators.some((i) => i.axis === 'secondary'),
				options: {},
			},
			{
				key: `${game.gameStateId}-third`,
				label: isJune ? 'Relatif (DU)' : 'Richesse nette',
				data: { datasets: this.toLines(game.third) },
				hasSecondaryAxis: false,
				options: {},
			},
		];
		blocks.forEach((block) => (block.options = this.lineOpts(block)));
		return blocks;
	}

	chartOf(card: GameCard): ChartBlock | undefined {
		return card.charts.find((block) => block.key === this.chartChoice[card.id]) ?? card.charts[0];
	}

	chooseChart(card: GameCard, block: ChartBlock): void {
		this.chartChoice[card.id] = block.key;
	}

	private buildFeelings(): void {
		this.cards.forEach((card) => {
			const dims = this.results.feelings(this.answers, card.id);
			card.feelings = dims.length ? this.feelingsData(dims) : undefined;
			card.feelingsOpts = this.feelingsOptions(dims);
		});
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
		this.cards.forEach((card) => {
			const room = ROOMS.gameState(card.id);
			this.joinedRooms.push(room);
			this.wsService.joinRoom(room);
		});
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

	/**
	 * One bubble per (dimension, answered value) ; its radius grows with how many players picked it.
	 * The colour is fixed per dimension so the same question is the same colour in every fiche.
	 */
	private feelingsData(dims: FeelingDimension[]): ChartConfiguration<'bubble'>['data'] {
		return {
			datasets: dims.map((dim) => ({
				label: `${dim.negative} ↔ ${dim.positive}`,
				data: dim.points.map((pt) => ({ x: pt.x, y: pt.y, r: Math.log(pt.count * 2) * 6, count: pt.count })),
				backgroundColor: FEELING_COLORS[dim.index % FEELING_COLORS.length],
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

	private lineOpts(block: ChartBlock): ChartConfiguration<'line'>['options'] {
		return {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			elements: { line: { tension: 0 } },
			plugins: {
				legend: { display: !!this.legends[block.key] },
				tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label} : ${this.num(ctx.parsed.y)}` } },
			},
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

	/** Flips the legend of one chart and rebuilds only that chart's options. */
	toggleLegend(block: ChartBlock): void {
		this.legends[block.key] = !this.legends[block.key];
		block.options = this.lineOpts(block);
	}

	medalOf(rank: number): string {
		return ['🥇', '🥈', '🥉'][rank - 1] ?? '';
	}

	timeOf(iso: string): string {
		const d = new Date(iso);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
	}
}
