import { Injectable } from '@angular/core';
import { GAME_TYPE } from '@geco/shared';
import {
	ActionPayload,
	CreditPayload,
	DistribDuPayload,
	EVENT_GROUP,
	GecoEventV2,
	groupOfEvent,
	LkSnapshot,
	SPECIAL_ACTOR,
	TransactionPayload,
} from '../models/geco-event';
import { SurveyAnswer } from './api/survey.service';

/* ──────────────────────────────────────────────────────────────────────────
 * SessionResultsService — pure client-side computation layer.
 * Input:  the raw ordered event stream of ONE gameState + its players.
 * Output: ready-to-plot series (Chart.js {x: Date, y: number}[]) and the
 *         synthesis numbers of the comparison table.
 *
 * DESIGN RULE: whenever an event carries LK (Last-Knowledge) absolute values
 * we USE THEM AS-IS as the graph point. The fold (reconstruction from the
 * previous point) is only the fallback for legacy events. This kills the
 * boilerplate of replaying credits/DU/death rules in the front and keeps
 * front/back rule drift impossible.
 * ────────────────────────────────────────────────────────────────────────── */

export interface PlayerRef {
	idx: string; // playerStateIdx as string == event.emitter/receiver
	name: string;
	color: string; // hex — reused as dataset color
}

export interface SeriesPoint {
	x: string; // ISO date
	y: number;
}

export interface PlayerSeries {
	player: PlayerRef;
	points: SeriesPoint[];
}

export interface GameResults {
	gameStateId: string;
	typeMoney: string; // GAME_TYPE.DEBT | GAME_TYPE.JUNE
	/** coins per player over time (absolute) */
	coins: PlayerSeries[];
	/** june only: coins / DU(t) — "relative" view */
	coinsRelative: PlayerSeries[];
	/** hand VALUE per player over time (Σ card.price) */
	resources: PlayerSeries[];
	/** total money in circulation over time */
	massMonetary: SeriesPoint[];
	/** DU value over time (june) */
	du: SeriesPoint[];
	synthesis: GameSynthesis;
	actions: ActionUsage[];
	podium: PodiumEntry[];
	mostActive: { player: PlayerRef; transactions: number } | null;
}

export interface GameSynthesis {
	players: number;
	deaths: number;
	rebirths: number;
	transactions: number;
	totalExchangedValue: number;
	finalMassMonetary: number;
	massMonetaryPerPlayer: number;
	giniCoins: number; // 0..1 — inequality of final coins
	giniResources: number;
	// debt only
	creditsTaken?: number;
	interestPaid?: number;
	seizures?: number;
	bankFinalCoins?: number;
	// june only
	duFinal?: number;
	duCount?: number;
}

export interface ActionUsage {
	typeEvent: string; // DB_EVENTS.ACTION_*
	good: boolean; // give/ong left column, steal/war right column
	count: number;
}

export interface PodiumEntry {
	player: PlayerRef;
	score: number; // coins + resources value at game end
	rank: 1 | 2 | 3;
}

interface FoldState {
	coins: Map<string, number>;
	cardsValue: Map<string, number>;
	mass: number;
	du: number;
}

@Injectable({ providedIn: 'root' })
export class SessionResultsService {
	/** Main entry: one call per game, then the component zips both results. */
	compute(
		gameStateId: string,
		typeMoney: string,
		players: PlayerRef[],
		events: GecoEventV2[],
		startAmountCoins: number,
		firstDU: number
	): GameResults {
		const evts = events
			.filter((e) => e.gameStateId === gameStateId)
			.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

		const byIdx = new Map(players.map((p) => [p.idx, p]));
		const coins = new Map<string, SeriesPoint[]>(players.map((p) => [p.idx, []]));
		const resources = new Map<string, SeriesPoint[]>(players.map((p) => [p.idx, []]));
		const mass: SeriesPoint[] = [];
		const du: SeriesPoint[] = [];

		// fold fallback state (used ONLY when an event has no LK snapshot)
		const fold: FoldState = {
			coins: new Map(players.map((p) => [p.idx, startAmountCoins])),
			cardsValue: new Map(players.map((p) => [p.idx, 0])),
			mass: startAmountCoins * players.length,
			du: firstDU,
		};

		let transactions = 0;
		let totalExchangedValue = 0;
		let deaths = 0;
		let rebirths = 0;
		let creditsTaken = 0;
		let interestPaid = 0;
		let seizures = 0;
		let duCount = 0;
		const txByPlayer = new Map<string, number>();
		const actionCounts = new Map<string, number>();

		const pushCoin = (idx: string | undefined, at: string, lkVal: number | undefined, foldDelta: number) => {
			if (!idx || !byIdx.has(idx)) return;
			const y = lkVal ?? (fold.coins.get(idx) ?? 0) + foldDelta;
			fold.coins.set(idx, y);
			coins.get(idx)!.push({ x: at, y });
		};
		const pushRes = (idx: string | undefined, at: string, lkVal: number | undefined, foldDelta: number) => {
			if (!idx || !byIdx.has(idx)) return;
			const y = lkVal ?? (fold.cardsValue.get(idx) ?? 0) + foldDelta;
			fold.cardsValue.set(idx, y);
			resources.get(idx)!.push({ x: at, y });
		};
		const pushMass = (at: string, lk: LkSnapshot | undefined, foldDelta: number) => {
			const y = lk?.massMonetaryLK ?? fold.mass + foldDelta;
			fold.mass = y;
			mass.push({ x: at, y });
		};

		for (const ev of evts) {
			const group = groupOfEvent(ev.typeEvent);
			const p = (ev.payload ?? {}) as LkSnapshot & Record<string, any>;

			switch (group) {
				case EVENT_GROUP.TRANSACTION: {
					const tp = p as TransactionPayload;
					transactions++;
					totalExchangedValue += tp.cost ?? 0;
					txByPlayer.set(ev.emitter!, (txByPlayer.get(ev.emitter!) ?? 0) + 1);
					txByPlayer.set(ev.receiver!, (txByPlayer.get(ev.receiver!) ?? 0) + 1);
					// buyer = emitter loses coins gains card; seller = receiver
					pushCoin(ev.emitter, ev.at, tp.emitterCoinsLK, -(tp.cost ?? 0));
					pushCoin(ev.receiver, ev.at, tp.receiverCoinsLK, +(tp.cost ?? 0));
					pushRes(ev.emitter, ev.at, tp.emitterCardsValueLK, +(tp.card?.price ?? 0));
					pushRes(ev.receiver, ev.at, tp.receiverCardsValueLK, -(tp.card?.price ?? 0));
					break;
				}
				case EVENT_GROUP.CREDIT: {
					const cp = p as CreditPayload;
					if (ev.typeEvent.includes('new') || ev.typeEvent.includes('free-money')) {
						creditsTaken += ev.typeEvent.includes('new') ? 1 : 0;
						pushCoin(ev.receiver, ev.at, cp.receiverCoinsLK, +(cp.amount ?? 0));
						pushMass(ev.at, cp, +(cp.amount ?? 0));
					} else if (ev.typeEvent.includes('settled')) {
						interestPaid += cp.interest ?? 0;
						pushCoin(ev.emitter, ev.at, cp.emitterCoinsLK, -((cp.amount ?? 0) + (cp.interest ?? 0)));
						pushMass(ev.at, cp, -(cp.amount ?? 0));
					}
					break;
				}
				case EVENT_GROUP.INTEREST: {
					const cp = p as CreditPayload;
					interestPaid += cp.interest ?? 0;
					pushCoin(ev.emitter, ev.at, cp.emitterCoinsLK, -(cp.interest ?? 0));
					break;
				}
				case EVENT_GROUP.SEIZURE: {
					seizures++;
					pushRes(ev.emitter, ev.at, p.emitterCardsValueLK, 0 /* TODO(back): seized value in payload */);
					break;
				}
				case EVENT_GROUP.DU: {
					const dp = p as DistribDuPayload;
					duCount++;
					fold.du = dp.du ?? p.duLK ?? fold.du;
					du.push({ x: ev.at, y: fold.du });
					if (dp.coinsByPlayerLK) {
						// broadcast variant — one event, all players (preferred, see TODO in geco-event.ts)
						for (const [idx, val] of Object.entries(dp.coinsByPlayerLK)) pushCoin(idx, ev.at, val, 0);
					} else {
						pushCoin(ev.receiver, ev.at, dp.receiverCoinsLK, +fold.du);
					}
					pushMass(ev.at, dp, +fold.du * (dp.coinsByPlayerLK ? Object.keys(dp.coinsByPlayerLK).length : 1));
					break;
				}
				case EVENT_GROUP.PRODUCTION: {
					pushRes(ev.emitter, ev.at, p.emitterCardsValueLK, 0 /* fallback can't know new value */);
					break;
				}
				case EVENT_GROUP.DEATH: {
					if (ev.typeEvent.includes('died')) deaths++;
					else rebirths++;
					pushCoin(ev.emitter, ev.at, p.emitterCoinsLK, 0);
					pushRes(ev.emitter, ev.at, p.emitterCardsValueLK, 0);
					break;
				}
				case EVENT_GROUP.ACTION: {
					actionCounts.set(ev.typeEvent, (actionCounts.get(ev.typeEvent) ?? 0) + 1);
					const ap = p as ActionPayload;
					pushRes(ev.emitter, ev.at, ap.emitterCardsValueLK, 0);
					pushRes(ev.receiver, ev.at, ap.receiverCardsValueLK, 0);
					break;
				}
			}
		}

		const isJune = typeMoney === GAME_TYPE.JUNE;
		const coinsSeries: PlayerSeries[] = players.map((pl) => ({ player: pl, points: coins.get(pl.idx)! }));
		const resSeries: PlayerSeries[] = players.map((pl) => ({ player: pl, points: resources.get(pl.idx)! }));

		// relative view: divide each point by DU(t) (step function over du[])
		const coinsRelative: PlayerSeries[] = !isJune
			? []
			: coinsSeries.map((s) => ({
					player: s.player,
					points: s.points.map((pt) => ({ x: pt.x, y: this.round2(pt.y / this.duAt(du, pt.x, firstDU)) })),
				}));

		const finalCoins = players.map((pl) => this.last(coins.get(pl.idx)!) ?? startAmountCoins);
		const finalRes = players.map((pl) => this.last(resources.get(pl.idx)!) ?? 0);

		const podium: PodiumEntry[] = players
			.map((pl, i) => ({ player: pl, score: finalCoins[i] + finalRes[i] }))
			.sort((a, b) => b.score - a.score)
			.slice(0, 3)
			.map((e, i) => ({ ...e, rank: (i + 1) as 1 | 2 | 3 }));

		const mostActiveIdx = [...txByPlayer.entries()].filter(([idx]) => byIdx.has(idx)).sort((a, b) => b[1] - a[1])[0];

		const GOOD = new Set(['action-give', 'action-ong']);
		const actions: ActionUsage[] = [...actionCounts.entries()].map(([typeEvent, count]) => ({
			typeEvent,
			count,
			good: GOOD.has(typeEvent),
		}));

		return {
			gameStateId,
			typeMoney,
			coins: coinsSeries,
			coinsRelative,
			resources: resSeries,
			massMonetary: mass,
			du,
			synthesis: {
				players: players.length,
				deaths,
				rebirths,
				transactions,
				totalExchangedValue,
				finalMassMonetary: this.last(mass) ?? fold.mass,
				massMonetaryPerPlayer: this.round2((this.last(mass) ?? fold.mass) / Math.max(players.length, 1)),
				giniCoins: this.gini(finalCoins),
				giniResources: this.gini(finalRes),
				...(isJune
					? { duFinal: fold.du, duCount }
					: {
							creditsTaken,
							interestPaid,
							seizures,
							bankFinalCoins: undefined, // TODO(back): bankCoinsLK on last credit event, or ship gameState.bank in results payload
						}),
			},
			actions,
			podium,
			mostActive: mostActiveIdx ? { player: byIdx.get(mostActiveIdx[0])!, transactions: mostActiveIdx[1] } : null,
		};
	}

	/** Split survey answers by game and average each Feedback dimension (1..5). */
	feelings(answers: SurveyAnswer[], gameStateId: string): { label: string; avg: number }[] {
		const DIMS: [keyof SurveyAnswer, string][] = [
			['individualCollective', 'Individuel ↔ Collectif'],
			['greedyGenerous', 'Avare ↔ Généreux'],
			['competitiveCooperative', 'Compétitif ↔ Coopératif'],
			['anxiousConfident', 'Anxieux ↔ Confiant'],
			['agressiveAvenant', 'Agressif ↔ Avenant'],
			['irritableTolerant', 'Irritable ↔ Tolérant'],
			['dependantAutonomous', 'Dépendant ↔ Autonome'],
		];
        // depressedHappy: 2,
		// 		individualCollective: 2,
		// 		insatisfiedAccomplished: 2,
		// 		greedyGenerous: 2,
		// 		competitiveCooperative: 2,
		// 		anxiousConfident: 2,
		// 		agressiveAvenant: 2,
		// 		irritableTolerant: 2,
		// 		dependantAutonomous: 2,
		// 		poorRich: 2,
		const rows = answers.filter((a) => a.gameStateId === gameStateId);
		return DIMS.map(([k, label]) => ({
			label,
			avg: rows.length ? this.round2(rows.reduce((s, a) => s + (Number(a[k]) || 0), 0) / rows.length) : 0,
		}));
	}

	/* ── helpers ── */
	private duAt(du: SeriesPoint[], atIso: string, firstDU: number): number {
		const at = new Date(atIso).getTime();
		let v = firstDU;
		for (const pt of du) {
			if (new Date(pt.x).getTime() > at) break;
			v = pt.y;
		}
		return v || firstDU || 1;
	}

	private last(pts: SeriesPoint[]): number | undefined {
		return pts.length ? pts[pts.length - 1].y : undefined;
	}

	private gini(values: number[]): number {
		const v = values.filter((x) => x >= 0).sort((a, b) => a - b);
		const n = v.length;
		const sum = v.reduce((s, x) => s + x, 0);
		if (!n || !sum) return 0;
		let cum = 0;
		for (let i = 0; i < n; i++) cum += (i + 1) * v[i];
		return this.round2((2 * cum) / (n * sum) - (n + 1) / n);
	}

	private round2(x: number): number {
		return Math.round(x * 100) / 100;
	}
}
