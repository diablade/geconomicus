import { Injectable } from '@angular/core';
import { GAME_TYPE, CREDIT_ORIGIN, CREDIT_QUESTION_ANSWER, DB_EVENTS, LK_KEYS, PLAYER_STATUS, isDeathEvent } from '@geco/shared';
import { GecoEventV2, PlayersLk, playersLkOf, lkNumberOf } from '../models/geco-event';
import { GameState, PlayerState } from '../models/gameState';
import { Avatar } from '../models/avatar';
import { SurveyAnswer } from './api/survey.service';

export interface AvatarRef {
	avatarIdx: number;
	name: string;
	color: string;
	/** SVG markup injected by <avatar> ; empty means the component falls back to its '?' placeholder */
	image: string;
	/** left unprefixed, the way <avatar> expects it for the border colour */
	hairColor: string;
}

export interface LifeRef {
	idx: number;
	avatarIdx: number;
	name: string;
	color: string;
	ordinal: number;
	status: string;
	/** the game this life was lived in — idx alone repeats across the two games of a session */
	gameStateId: string;
}

export interface SeriesPoint {
	x: string;
	y: number;
}

export interface LifeSeries {
	life: LifeRef;
	points: SeriesPoint[];
}

export type IndicatorChart = 'coins' | 'cards';
export type IndicatorAxis = 'linear' | 'secondary';

export interface IndicatorSeries {
	key: string;
	chart: IndicatorChart;
	axis: IndicatorAxis;
	points: SeriesPoint[];
}

export interface HealthRow {
	key: string;
	label: string;
	agrees: boolean;
	authoritative: number | null;
	sampled: number | null;
}

export interface DivergenceRow {
	at: string;
	typeEvent: string;
	key: string;
	declared: number;
	derived: number;
	delta: number;
	touched: number[];
}

export interface DataHealth {
	rows: HealthRow[];
	divergences: DivergenceRow[];
}

export interface FeelingPoint {
	x: number;
	y: number;
	count: number;
}

export interface FeelingDimension {
	key: keyof SurveyAnswer;
	negative: string;
	positive: string;
	index: number;
	points: FeelingPoint[];
}

/** Avatar hair colours are stored without their leading '#' (avatar-settings strips it), so give it back. */
const avatarColor = (hairColor: string | undefined): string => {
	const hex = String(hairColor ?? '').replace(/^#/, '');
	return /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex) ? `#${hex}` : '#888888';
};

/** The ten survey questions, in the order they are asked (front/src/app/survey). */
const FEELING_DIMS: { key: keyof SurveyAnswer; negative: string; positive: string }[] = [
	{ key: 'depressedHappy', negative: 'Déprimé·e', positive: 'Joyeux·se' },
	{ key: 'insatisfiedAccomplished', negative: 'Insatisfait·e', positive: 'Accompli·e' },
	{ key: 'poorRich', negative: 'Pauvre', positive: 'Riche' },
	{ key: 'anxiousConfident', negative: 'Anxieux·se', positive: 'Confiant·e' },
	{ key: 'agressiveAvenant', negative: 'Agressif·ve', positive: 'Avenant·e' },
	{ key: 'greedyGenerous', negative: 'Avare', positive: 'Généreux·se' },
	{ key: 'irritableTolerant', negative: 'Irritable', positive: 'Tolérant·e' },
	{ key: 'individualCollective', negative: 'Individuel', positive: 'Collectif' },
	{ key: 'competitiveCooperative', negative: 'Compétitif', positive: 'Coopératif' },
	{ key: 'dependantAutonomous', negative: 'Dépendant·e', positive: 'Autonome' },
];

export interface PodiumEntry {
	avatar: AvatarRef;
	coins: number;
	cardsValue: number;
	score: number;
	rank: number;
}

export interface ActionUsage {
	typeEvent: string;
	good: boolean;
	count: number;
}

export interface CreditDecisions {
	acceptSingle: number;
	acceptDouble: number;
	decline: number;
	noAnswer: number;
	fromAnimator: number;
	fromFirstQuestion: number;
	fromPlayerRequest: number;
	refused: number;
}

export interface GameSynthesis {
	avatars: number;
	lives: number;
	deaths: number;
	rebirths: number;
	transactions: number;
	totalExchangedValue: number;
	finalMassMonetary: number;
	averageMoney: number;
	ghostMoney: number;
	ghostCards: number;
	goodsInPlay: number;
	creditsTaken?: number;
	interestPaid?: number;
	seizures?: number;
	bankMoneyLost?: number;
	bankMoneyDestroyed?: number;
	bankGoodsEarned?: number;
	totalDebt?: number;
	creditDecisions?: CreditDecisions;
	duFinal?: number;
	duCount?: number;
	ghostMoneyInDu?: number;
}

export interface GameResults {
	gameStateId: string;
	typeMoney: string;
	isJune: boolean;
	lives: LifeRef[];
	coins: LifeSeries[];
	cardsValue: LifeSeries[];
	combined: LifeSeries[];
	third: LifeSeries[];
	indicators: IndicatorSeries[];
	synthesis: GameSynthesis;
	actions: ActionUsage[];
	podium: PodiumEntry[];
	mostActive: { avatar: AvatarRef; count: number } | null;
	health: DataHealth;
}

const GOOD_ACTIONS = new Set<string>([DB_EVENTS.ACTION_GIVE, DB_EVENTS.ACTION_ASSOCIATION, DB_EVENTS.ACTION_ONG]);

const cardsValueOf = (playerState: PlayerState): number =>
	(playerState.cards ?? []).reduce((sum: number, card: any) => sum + (card?.price ?? 0), 0);

@Injectable({ providedIn: 'root' })
export class SessionResultsService {
	compute(gameState: GameState, events: GecoEventV2[], avatars: Avatar[]): GameResults {
		const gameStateId = String(gameState._id);
		const isJune = gameState.typeMoney === GAME_TYPE.JUNE;
		const stream = events
			.filter((e) => e.gameStateId === gameStateId)
			.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

		const avatarByIdx = new Map<number, AvatarRef>(
			(avatars ?? []).map((a) => [
				Number(a.idx),
				{
					avatarIdx: Number(a.idx),
					name: a.name,
					color: avatarColor(a.hairColor),
					image: a.image ?? '',
					hairColor: String(a.hairColor ?? ''),
				},
			])
		);
		const lives = this.buildLives(gameState, avatarByIdx);
		const lifeByIdx = new Map<number, LifeRef>(lives.map((l) => [l.idx, l]));

		const coinsPts = new Map<number, SeriesPoint[]>(lives.map((l) => [l.idx, []]));
		const cardsPts = new Map<number, SeriesPoint[]>(lives.map((l) => [l.idx, []]));
		const debtPts = new Map<number, SeriesPoint[]>(lives.map((l) => [l.idx, []]));

		const declared = new Map<string, SeriesPoint[]>();
		const pushDeclared = (key: string, at: string, y: number) => {
			if (!declared.has(key)) declared.set(key, []);
			declared.get(key)!.push({ x: at, y });
		};

		const heldCoins = new Map<number, number>();
		const heldCards = new Map<number, number>();
		const heldDebt = new Map<number, number>();
		const deadLives = new Set<number>();

		const ghostMoneyPts: SeriesPoint[] = [];
		const ghostCardsPts: SeriesPoint[] = [];
		const goodsInPlayPts: SeriesPoint[] = [];
		const totalDebtPts: SeriesPoint[] = [];
		const averageMoneyPts: SeriesPoint[] = [];
		const divergences: DivergenceRow[] = [];
		const seenLives = new Set<number>();

		const tally = {
			transactions: 0,
			totalExchangedValue: 0,
			deaths: 0,
			rebirths: 0,
			creditsTaken: 0,
			seizures: 0,
			refused: 0,
		};
		const firstQ = { acceptSingle: 0, acceptDouble: 0, decline: 0, noAnswer: 0 };
		const origin = { animator: 0, firstQuestion: 0, playerRequest: 0 };
		const actionCounts = new Map<string, number>();
		const activityByAvatar = new Map<number, number>();
		const duTimestamps = new Set<string>();

		const lastInitIndex = stream.reduce((last, ev, i) => (ev.typeEvent === DB_EVENTS.PLAYER_INIT ? i : last), -1);

		stream.forEach((ev, index) => {
			const payload = (ev.payload ?? {}) as Record<string, any>;
			this.tallyEvent(ev, payload, tally, firstQ, origin, actionCounts, activityByAvatar, lifeByIdx, duTimestamps);
			if (isDeathEvent(ev.typeEvent)) {
				const died = Number(ev.receiver);
				if (lifeByIdx.has(died)) deadLives.add(died);
			}

			const playersLk: PlayersLk = playersLkOf(payload);
			const touched: number[] = [];
			for (const [rawIdx, snapshot] of Object.entries(playersLk)) {
				const idx = Number(rawIdx);
				if (!lifeByIdx.has(idx)) continue;
				touched.push(idx);
				seenLives.add(idx);
				heldCoins.set(idx, snapshot.coins);
				heldCards.set(idx, snapshot.cardsValue);
				if (snapshot.debt !== undefined) heldDebt.set(idx, snapshot.debt);
				coinsPts.get(idx)!.push({ x: ev.at, y: snapshot.coins });
				cardsPts.get(idx)!.push({ x: ev.at, y: snapshot.cardsValue });
				if (snapshot.debt !== undefined) debtPts.get(idx)!.push({ x: ev.at, y: snapshot.debt });
			}

			for (const key of Object.values(LK_KEYS)) {
				if (key === LK_KEYS.PLAYERS) continue;
				const value = lkNumberOf(payload, key);
				if (value !== undefined) pushDeclared(key, ev.at, value);
			}

			if (touched.length === 0) return;

			const sums = this.sumHeld(lives, heldCoins, heldCards, heldDebt, deadLives);
			ghostMoneyPts.push({ x: ev.at, y: sums.ghostCoins });
			ghostCardsPts.push({ x: ev.at, y: sums.ghostCards });
			goodsInPlayPts.push({ x: ev.at, y: sums.goodsInPlay });
			if (!isJune) totalDebtPts.push({ x: ev.at, y: sums.debt });

			const declaredMass = lkNumberOf(payload, LK_KEYS.MASS_MONETARY);
			if (declaredMass === undefined || index <= lastInitIndex) return;

			const aliveNow = seenLives.size - deadLives.size;
			if (aliveNow > 0) averageMoneyPts.push({ x: ev.at, y: this.round2(declaredMass / aliveNow) });

			if (sums.coins !== declaredMass) {
				divergences.push({
					at: ev.at,
					typeEvent: ev.typeEvent,
					key: LK_KEYS.MASS_MONETARY,
					declared: declaredMass,
					derived: sums.coins,
					delta: this.round2(sums.coins - declaredMass),
					touched: [...touched],
				});
			}
		});

		const endAt = this.gameEndAt(gameState, stream);
		lives.forEach((life) => {
			const state = gameState.playersStates.find((p) => Number(p.idx) === life.idx);
			if (!state) return;
			this.closeSeries(coinsPts.get(life.idx)!, endAt, state.coins ?? 0);
			this.closeSeries(cardsPts.get(life.idx)!, endAt, cardsValueOf(state));
		});

		const duSeries = declared.get(LK_KEYS.DU) ?? [];
		const coinsSeries = lives.map((life) => ({ life, points: coinsPts.get(life.idx)! }));
		const cardsSeries = lives.map((life) => ({ life, points: cardsPts.get(life.idx)! }));
		const debtSeries = lives.map((life) => ({ life, points: debtPts.get(life.idx)! }));

		return {
			gameStateId,
			typeMoney: gameState.typeMoney,
			isJune,
			lives,
			coins: coinsSeries,
			cardsValue: cardsSeries,
			combined: this.combineSeries(coinsSeries, cardsSeries),
			third: isJune
				? this.relativeSeries(coinsSeries, duSeries)
				: this.netWealthSeries(coinsSeries, cardsSeries, debtSeries),
			indicators: this.buildIndicators(declared, isJune, {
				ghostMoney: ghostMoneyPts,
				ghostCards: ghostCardsPts,
				goodsInPlay: goodsInPlayPts,
				totalDebt: totalDebtPts,
				averageMoney: averageMoneyPts,
			}),
			synthesis: this.buildSynthesis(gameState, lives, isJune, tally, firstQ, origin, duTimestamps.size),
			actions: [...actionCounts.entries()].map(([typeEvent, count]) => ({
				typeEvent,
				count,
				good: GOOD_ACTIONS.has(typeEvent),
			})),
			podium: this.buildPodium(gameState, avatarByIdx),
			mostActive: this.buildMostActive(activityByAvatar, avatarByIdx),
			health: {
				rows: this.buildHealthRows(gameState, lives, declared, heldCoins, heldCards, isJune),
				divergences,
			},
		};
	}

	/**
	 * Distribution of the survey answers, one entry per feeling dimension, in the
	 * order the survey asks them: each answered value (-3..3, 0 never offered)
	 * keeps its count so the chart can size a bubble per (dimension, value).
	 */
	feelings(answers: SurveyAnswer[], gameStateId: string): FeelingDimension[] {
		const rows = answers.filter((a) => a.gameStateId === gameStateId);
		return FEELING_DIMS.map((dim, index) => {
			const counts = new Map<number, number>();
			rows.forEach((row) => {
				const value = Number(row[dim.key]);
				if (!value) return;
				counts.set(value, (counts.get(value) ?? 0) + 1);
			});
			return {
				...dim,
				index,
				points: [...counts.entries()]
					.sort((a, b) => a[0] - b[0])
					.map(([value, count]) => ({ x: index, y: value, count })),
			};
		});
	}

	private buildLives(gameState: GameState, avatarByIdx: Map<number, AvatarRef>): LifeRef[] {
		const ordinals = new Map<number, number>();
		return [...(gameState.playersStates ?? [])]
			.sort((a, b) => Number(a.idx) - Number(b.idx))
			.map((state) => {
				const avatarIdx = Number(state.avatarIdx);
				const ordinal = (ordinals.get(avatarIdx) ?? 0) + 1;
				ordinals.set(avatarIdx, ordinal);
				const avatar = avatarByIdx.get(avatarIdx);
				return {
					idx: Number(state.idx),
					avatarIdx,
					name: avatar ? avatar.name : `#${avatarIdx}`,
					color: avatar ? avatar.color : '#888888',
					ordinal,
					status: String(state.status ?? ''),
					gameStateId: String(gameState._id),
				};
			});
	}

	private tallyEvent(
		ev: GecoEventV2,
		payload: Record<string, any>,
		tally: any,
		firstQ: any,
		origin: any,
		actionCounts: Map<string, number>,
		activityByAvatar: Map<number, number>,
		lifeByIdx: Map<number, LifeRef>,
		duTimestamps: Set<string>
	): void {
		if (isDeathEvent(ev.typeEvent)) tally.deaths++;
		if (ev.typeEvent === DB_EVENTS.PLAYER_BIRTH) tally.rebirths++;
		if (ev.typeEvent === DB_EVENTS.CREDIT_SEIZURE || ev.typeEvent === DB_EVENTS.PLAYER_DIED_WITH_SEIZURE) {
			tally.seizures++;
		}
		if (ev.typeEvent === DB_EVENTS.DISTRIB_DU) duTimestamps.add(ev.at);

		if (ev.typeEvent === DB_EVENTS.TRANSACTION) {
			tally.transactions++;
			tally.totalExchangedValue += payload['cost'] ?? 0;
		}
		if (ev.typeEvent === DB_EVENTS.CREDIT_NEW) {
			tally.creditsTaken++;
			const o = payload['origin'];
			if (o === CREDIT_ORIGIN.FIRST_QUESTION) origin.firstQuestion++;
			else if (o === CREDIT_ORIGIN.PLAYER_REQUEST) origin.playerRequest++;
			else origin.animator++;
		}
		if (ev.typeEvent === DB_EVENTS.CREDIT_REFUSED) tally.refused++;
		if (ev.typeEvent === DB_EVENTS.CREDIT_QUESTION_ANSWERED) {
			const answer = payload['answer'] ?? payload['firstCreditAnswer'];
			if (answer === CREDIT_QUESTION_ANSWER.ACCEPT_SINGLE) firstQ.acceptSingle++;
			else if (answer === CREDIT_QUESTION_ANSWER.ACCEPT_DOUBLE) firstQ.acceptDouble++;
			else if (answer === CREDIT_QUESTION_ANSWER.DECLINE) firstQ.decline++;
			else firstQ.noAnswer++;
		}
		if (ev.typeEvent.startsWith('action-')) {
			actionCounts.set(ev.typeEvent, (actionCounts.get(ev.typeEvent) ?? 0) + 1);
		}

		const emitter = Number(ev.emitter);
		const receiver = Number(ev.receiver);
		if (Number.isInteger(emitter) && Number.isInteger(receiver) && lifeByIdx.has(emitter) && lifeByIdx.has(receiver)) {
			const avatarIdx = lifeByIdx.get(emitter)!.avatarIdx;
			activityByAvatar.set(avatarIdx, (activityByAvatar.get(avatarIdx) ?? 0) + 1);
		}
	}

	private sumHeld(
		lives: LifeRef[],
		heldCoins: Map<number, number>,
		heldCards: Map<number, number>,
		heldDebt: Map<number, number>,
		deadLives: Set<number>
	): { coins: number; ghostCoins: number; ghostCards: number; goodsInPlay: number; debt: number } {
		let coins = 0;
		let ghostCoins = 0;
		let ghostCards = 0;
		let goodsInPlay = 0;
		let debt = 0;
		for (const life of lives) {
			const c = heldCoins.get(life.idx);
			const v = heldCards.get(life.idx);
			const d = heldDebt.get(life.idx);
			const wasDead = deadLives.has(life.idx);
			if (c !== undefined) {
				coins += c;
				if (wasDead) ghostCoins += c;
			}
			if (v !== undefined) {
				if (wasDead) ghostCards += v;
				else goodsInPlay += v;
			}
			if (d !== undefined) debt += d;
		}
		return {
			coins: this.round2(coins),
			ghostCoins: this.round2(ghostCoins),
			ghostCards: this.round2(ghostCards),
			goodsInPlay: this.round2(goodsInPlay),
			debt: this.round2(debt),
		};
	}

	private buildIndicators(
		declared: Map<string, SeriesPoint[]>,
		isJune: boolean,
		derived: {
			ghostMoney: SeriesPoint[];
			ghostCards: SeriesPoint[];
			goodsInPlay: SeriesPoint[];
			totalDebt: SeriesPoint[];
			averageMoney: SeriesPoint[];
		}
	): IndicatorSeries[] {
		const out: IndicatorSeries[] = [];
		const add = (key: string, chart: IndicatorChart, axis: IndicatorAxis, points: SeriesPoint[]) => {
			if (points.length) out.push({ key, chart, axis, points });
		};

		add(LK_KEYS.MASS_MONETARY, 'coins', 'linear', declared.get(LK_KEYS.MASS_MONETARY) ?? []);
		add('ghostMoney', 'coins', 'linear', derived.ghostMoney);
		add('averageMoney', 'coins', 'secondary', derived.averageMoney);
		add('goodsInPlay', 'cards', 'linear', derived.goodsInPlay);
		add('ghostCards', 'cards', 'linear', derived.ghostCards);

		if (isJune) {
			add(LK_KEYS.DU, 'coins', 'secondary', declared.get(LK_KEYS.DU) ?? []);
		} else {
			add('totalDebt', 'coins', 'linear', derived.totalDebt);
			add(LK_KEYS.BANK_INTEREST_EARNED, 'coins', 'linear', declared.get(LK_KEYS.BANK_INTEREST_EARNED) ?? []);
			add(LK_KEYS.BANK_MONEY_LOST, 'coins', 'linear', declared.get(LK_KEYS.BANK_MONEY_LOST) ?? []);
			add(LK_KEYS.BANK_MONEY_DESTROYED, 'coins', 'linear', declared.get(LK_KEYS.BANK_MONEY_DESTROYED) ?? []);
			add(LK_KEYS.BANK_GOODS_EARNED, 'cards', 'linear', declared.get(LK_KEYS.BANK_GOODS_EARNED) ?? []);
		}
		return out;
	}

	private relativeSeries(coins: LifeSeries[], du: SeriesPoint[]): LifeSeries[] {
		if (!du.length) return [];
		return coins.map((series) => {
			const vertices = this.mergeTimestamps(series.points, du);
			const points = vertices
				.map((x) => {
					const value = this.stepValueAt(series.points, x);
					const duValue = this.stepValueAt(du, x);
					if (value === undefined || !duValue) return null;
					return { x, y: this.round2(value / duValue) };
				})
				.filter((p): p is SeriesPoint => p !== null);
			return { life: series.life, points };
		});
	}

	private netWealthSeries(coins: LifeSeries[], cards: LifeSeries[], debt: LifeSeries[]): LifeSeries[] {
		return coins.map((series, i) => {
			const cardPoints = cards[i]?.points ?? [];
			const debtPoints = debt[i]?.points ?? [];
			const vertices = this.mergeTimestamps(series.points, cardPoints, debtPoints);
			const points = vertices
				.map((x) => {
					const c = this.stepValueAt(series.points, x);
					if (c === undefined) return null;
					const v = this.stepValueAt(cardPoints, x) ?? 0;
					const d = this.stepValueAt(debtPoints, x) ?? 0;
					return { x, y: this.round2(c + v - d) };
				})
				.filter((p): p is SeriesPoint => p !== null);
			return { life: series.life, points };
		});
	}

	private combineSeries(coins: LifeSeries[], cards: LifeSeries[]): LifeSeries[] {
		return coins.map((series, i) => {
			const cardPoints = cards[i]?.points ?? [];
			const vertices = this.mergeTimestamps(series.points, cardPoints);
			const points = vertices
				.map((x) => {
					const c = this.stepValueAt(series.points, x);
					if (c === undefined) return null;
					return { x, y: this.round2(c + (this.stepValueAt(cardPoints, x) ?? 0)) };
				})
				.filter((p): p is SeriesPoint => p !== null);
			return { life: series.life, points };
		});
	}

	private buildSynthesis(
		gameState: GameState,
		lives: LifeRef[],
		isJune: boolean,
		tally: any,
		firstQ: any,
		origin: any,
		duCount: number
	): GameSynthesis {
		const states = gameState.playersStates ?? [];
		const aliveCount = states.filter((p) => p.status !== PLAYER_STATUS.DEAD).length;
		const ghostMoney = states
			.filter((p) => p.status === PLAYER_STATUS.DEAD)
			.reduce((sum, p) => sum + (p.coins ?? 0), 0);
		const ghostCards = states
			.filter((p) => p.status === PLAYER_STATUS.DEAD)
			.reduce((sum, p) => sum + cardsValueOf(p), 0);
		const goodsInPlay = states
			.filter((p) => p.status !== PLAYER_STATUS.DEAD)
			.reduce((sum, p) => sum + cardsValueOf(p), 0);
		const avatars = new Set(lives.map((l) => l.avatarIdx));

		const base: GameSynthesis = {
			avatars: avatars.size,
			lives: lives.length,
			deaths: tally.deaths,
			rebirths: tally.rebirths,
			transactions: tally.transactions,
			totalExchangedValue: this.round2(tally.totalExchangedValue),
			finalMassMonetary: gameState.currentMassMonetary ?? 0,
			averageMoney: aliveCount ? this.round2((gameState.currentMassMonetary ?? 0) / aliveCount) : 0,
			ghostMoney: this.round2(ghostMoney),
			ghostCards: this.round2(ghostCards),
			goodsInPlay: this.round2(goodsInPlay),
		};

		if (isJune) {
			const duFinal = gameState.currentDU ?? 0;
			return {
				...base,
				duFinal,
				duCount,
				ghostMoneyInDu: duFinal ? this.round2(ghostMoney / duFinal) : 0,
			};
		}

		const totalDebt = (gameState.credits ?? [])
			.filter((c) => c.status !== 'done' && c.status !== 'canceled')
			.reduce((sum, c) => sum + (c.amount ?? 0) + (c.interest ?? 0), 0);

		return {
			...base,
			creditsTaken: tally.creditsTaken,
			interestPaid: gameState.bankInterestEarned ?? 0,
			seizures: tally.seizures,
			bankMoneyLost: gameState.bankMoneyLost ?? 0,
			bankMoneyDestroyed: gameState.bankMoneyDestroyed ?? 0,
			bankGoodsEarned: gameState.bankGoodsEarned ?? 0,
			totalDebt: this.round2(totalDebt),
			creditDecisions: {
				acceptSingle: firstQ.acceptSingle,
				acceptDouble: firstQ.acceptDouble,
				decline: firstQ.decline,
				noAnswer: firstQ.noAnswer,
				fromAnimator: origin.animator,
				fromFirstQuestion: origin.firstQuestion,
				fromPlayerRequest: origin.playerRequest,
				refused: tally.refused,
			},
		};
	}

	private buildPodium(gameState: GameState, avatarByIdx: Map<number, AvatarRef>): PodiumEntry[] {
		const byAvatar = new Map<number, { coins: number; cardsValue: number }>();
		for (const state of gameState.playersStates ?? []) {
			const avatarIdx = Number(state.avatarIdx);
			const acc = byAvatar.get(avatarIdx) ?? { coins: 0, cardsValue: 0 };
			acc.coins += state.coins ?? 0;
			acc.cardsValue += cardsValueOf(state);
			byAvatar.set(avatarIdx, acc);
		}
		return [...byAvatar.entries()]
			.map(([avatarIdx, acc]) => ({
				avatar: avatarByIdx.get(avatarIdx) ?? {
					avatarIdx,
					name: `#${avatarIdx}`,
					color: '#888888',
					image: '',
					hairColor: '',
				},
				coins: this.round2(acc.coins),
				cardsValue: this.round2(acc.cardsValue),
				score: this.round2(acc.coins + acc.cardsValue),
			}))
			.sort((a, b) => b.score - a.score)
			.map((entry, i) => ({ ...entry, rank: i + 1 }));
	}

	private buildMostActive(
		activityByAvatar: Map<number, number>,
		avatarByIdx: Map<number, AvatarRef>
	): { avatar: AvatarRef; count: number } | null {
		const top = [...activityByAvatar.entries()].sort((a, b) => b[1] - a[1])[0];
		if (!top) return null;
		const avatar = avatarByIdx.get(top[0]);
		return avatar ? { avatar, count: top[1] } : null;
	}

	private buildHealthRows(
		gameState: GameState,
		lives: LifeRef[],
		declared: Map<string, SeriesPoint[]>,
		heldCoins: Map<number, number>,
		heldCards: Map<number, number>,
		isJune: boolean
	): HealthRow[] {
		const rows: HealthRow[] = [];
		const record = (key: string, label: string, authoritative: number, sampled: number | null) => {
			rows.push({ key, label, authoritative, sampled, agrees: sampled !== null && sampled === authoritative });
		};
		const compare = (key: string, label: string, authoritative: number, samples: SeriesPoint[]) => {
			record(key, label, authoritative, samples.length ? samples[samples.length - 1].y : null);
		};

		compare(
			LK_KEYS.MASS_MONETARY,
			'Masse monétaire',
			gameState.currentMassMonetary ?? 0,
			declared.get(LK_KEYS.MASS_MONETARY) ?? []
		);
		if (isJune) {
			compare(LK_KEYS.DU, 'DU', gameState.currentDU ?? 0, declared.get(LK_KEYS.DU) ?? []);
		} else {
			compare(
				LK_KEYS.BANK_INTEREST_EARNED,
				'Intérêts encaissés',
				gameState.bankInterestEarned ?? 0,
				declared.get(LK_KEYS.BANK_INTEREST_EARNED) ?? []
			);
			compare(
				LK_KEYS.BANK_MONEY_LOST,
				'Monnaie perdue',
				gameState.bankMoneyLost ?? 0,
				declared.get(LK_KEYS.BANK_MONEY_LOST) ?? []
			);
			compare(
				LK_KEYS.BANK_MONEY_DESTROYED,
				'Monnaie détruite',
				gameState.bankMoneyDestroyed ?? 0,
				declared.get(LK_KEYS.BANK_MONEY_DESTROYED) ?? []
			);
			compare(
				LK_KEYS.BANK_GOODS_EARNED,
				'Biens saisis',
				gameState.bankGoodsEarned ?? 0,
				declared.get(LK_KEYS.BANK_GOODS_EARNED) ?? []
			);
		}
		compare(
			LK_KEYS.ALIVE_COUNT,
			'Vies en jeu',
			(gameState.playersStates ?? []).filter((p) => p.status !== PLAYER_STATUS.DEAD).length,
			declared.get(LK_KEYS.ALIVE_COUNT) ?? []
		);

		for (const life of lives) {
			const state = (gameState.playersStates ?? []).find((p) => Number(p.idx) === life.idx);
			if (!state) continue;
			const label = `${life.name} — vie ${life.ordinal}`;
			record(`life-${life.idx}-coins`, `${label} · pièces`, state.coins ?? 0, heldCoins.get(life.idx) ?? null);
			record(`life-${life.idx}-cards`, `${label} · biens`, cardsValueOf(state), heldCards.get(life.idx) ?? null);
		}
		return rows;
	}

	private closeSeries(points: SeriesPoint[], endAt: string, authoritative: number): void {
		if (!points.length) return;
		const last = points[points.length - 1];
		if (new Date(last.x).getTime() >= new Date(endAt).getTime()) return;
		points.push({ x: endAt, y: authoritative });
	}

	private gameEndAt(gameState: GameState, stream: GecoEventV2[]): string {
		const ended = gameState.gameTimers?.endedAt;
		if (ended) return new Date(ended).toISOString();
		if (stream.length) return stream[stream.length - 1].at;
		return new Date().toISOString();
	}

	private mergeTimestamps(...series: SeriesPoint[][]): string[] {
		const seen = new Set<string>();
		for (const points of series) for (const p of points) seen.add(p.x);
		return [...seen].sort((x, y) => new Date(x).getTime() - new Date(y).getTime());
	}

	private stepValueAt(points: SeriesPoint[], atIso: string): number | undefined {
		const at = new Date(atIso).getTime();
		let value: number | undefined;
		for (const point of points) {
			if (new Date(point.x).getTime() > at) break;
			value = point.y;
		}
		return value;
	}

	private round2(x: number): number {
		return Math.round(x * 100) / 100;
	}
}
