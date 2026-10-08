import { DB_EVENTS, DbEvent, LK_KEYS } from '@geco/shared';
import { Card } from './game';

/**
 * ─── GecoEventV2 ──────────────────────────────────────────────────────────────
 * Front mirror of back/src/event/event.schema.js (v2).
 * emitter / receiver are playerStateIdx serialized as string, or a SPECIAL_ACTOR.
 */
export interface GecoEventV2<P = EventPayload> {
	_id: string;
	typeEvent: DbEvent | string;
	sessionId: string;
	gameStateId?: string;
	emitter?: string;
	receiver?: string;
	payload?: P;
	at: string; // ISO date
	createdAt?: string;
	updatedAt?: string;
}

export const SPECIAL_ACTOR = {
	BANK: 'bank',
	MASTER: 'master',
	ALL: 'all',
} as const;

/**
 * ─── LAST-KNOWN, AS THE CONTRACT PRODUCES IT ─────────────────────────────────
 * EVENT_LK_CONTRACT declares which pieces each event type carries, and the
 * backend event builder extracts them from the gameState. Per-life values are
 * keyed by playerStateIdx under `playersLK`; aggregates sit beside it as flat
 * numbers under their LK_KEYS name. `emitter` / `receiver` are role pointers
 * only and carry no values. See docs/adr/0012 and CONTEXT.md → Last-Known.
 */
export interface LifeSnapshot {
	coins: number;
	cardsValue: number;
	debt?: number;
}

export type PlayersLk = { [playerStateIdx: string]: LifeSnapshot };

export function playersLkOf(payload: Record<string, any> | undefined): PlayersLk {
	const raw = payload?.[LK_KEYS.PLAYERS];
	if (!raw || typeof raw !== 'object') return {};
	const out: PlayersLk = {};
	for (const [idx, snapshot] of Object.entries(raw as Record<string, any>)) {
		if (!snapshot || typeof snapshot !== 'object') continue;
		if (!Number.isFinite(snapshot.coins) || !Number.isFinite(snapshot.cardsValue)) continue;
		out[idx] = {
			coins: snapshot.coins,
			cardsValue: snapshot.cardsValue,
			...(Number.isFinite(snapshot.debt) ? { debt: snapshot.debt } : {}),
		};
	}
	return out;
}

export function lkNumberOf(payload: Record<string, any> | undefined, key: string): number | undefined {
	const value = payload?.[key];
	return Number.isFinite(value) ? (value as number) : undefined;
}

export interface TransactionPayload {
	cost: number;
	card: Card;
}

export interface CreditPayload {
	creditId?: string;
	amount: number;
	interest: number;
	/** CREDIT_ORIGIN on a credit-new event: how the credit came to be. */
	origin?: string;
}

export interface DistribDuPayload {
	du: number;
}

/** player-died and player-died-with-seizure; `seizure` only on the latter. */
export interface DeathPayload {
	cards: Card[];
	seizure?: {
		totalCoinSeized: number;
		interest: number;
		amount: number;
		cards: Card[];
		notPayed: number;
	};
}

/** action-give / action-steal / action-silent-steal / action-war / action-ong */
export interface ActionPayload {
	card?: Card;
	cards?: Card[];
	stolen?: Card[];
	victims?: number[];
	recipients?: number[];
}

/**
 * `consumed` are the cards handed in, `produced` the higher-weight card they bought,
 * `newCards` the same-weight cards redrawn to refill the hand. Events written before
 * 2026-08-12 carry `newCards` only.
 */
export interface ProductionPayload {
	consumed?: Card[];
	produced?: Card;
	newCards: Card[];
}

export type EventPayload =
	| TransactionPayload
	| CreditPayload
	| DistribDuPayload
	| DeathPayload
	| ActionPayload
	| ProductionPayload
	| Record<string, unknown>;

/**
 * ─── EVENT GROUPS (client-side filter chips) ─────────────────────────────────
 * All type/emitter/receiver filtering happens on the client; the back only
 * ships the raw ordered event list of the session.
 *
 * These values double as i18n keys: `EVENTS.EVENT_GROUP.<value>` in
 * assets/i18n/events/*.json, as DB_EVENTS does under `EVENTS.DB_EVENTS.<value>`.
 */
export const EVENT_GROUP = {
	ALL: 'all',
	TRANSACTION: 'transaction',
	CREDIT: 'credit',
	DU: 'du',
	PRODUCTION: 'production',
	DEATH: 'death',
	SEIZURE: 'seizure',
	ACTION: 'action',
	SYSTEM: 'system',
} as const;
export type EventGroup = (typeof EVENT_GROUP)[keyof typeof EVENT_GROUP];

const GROUPS_BY_TYPE: { [typeEvent: string]: EventGroup[] } = {
	[DB_EVENTS.TRANSACTION]: [EVENT_GROUP.TRANSACTION],
	[DB_EVENTS.FREE_MONEY]: [EVENT_GROUP.CREDIT],
	[DB_EVENTS.CREDIT_NEW]: [EVENT_GROUP.CREDIT],
	[DB_EVENTS.CREDIT_REQUEST]: [EVENT_GROUP.CREDIT],
	[DB_EVENTS.CREDIT_EXTENDED]: [EVENT_GROUP.CREDIT],
	[DB_EVENTS.CREDIT_SETTLED]: [EVENT_GROUP.CREDIT],
	[DB_EVENTS.CREDIT_FAULT]: [EVENT_GROUP.CREDIT],
	[DB_EVENTS.CREDIT_CANCELED]: [EVENT_GROUP.CREDIT],
	[DB_EVENTS.CREDIT_REFUSED]: [EVENT_GROUP.CREDIT],
	[DB_EVENTS.CREDIT_QUESTION_ASKED]: [EVENT_GROUP.CREDIT],
	[DB_EVENTS.CREDIT_QUESTION_ANSWERED]: [EVENT_GROUP.CREDIT],
	[DB_EVENTS.CREDIT_SEIZURE]: [EVENT_GROUP.SEIZURE],
	[DB_EVENTS.PRISON]: [EVENT_GROUP.SEIZURE],
	[DB_EVENTS.PRISON_ENDED]: [EVENT_GROUP.SEIZURE],
	[DB_EVENTS.DISTRIB_DU]: [EVENT_GROUP.DU],
	[DB_EVENTS.FIRST_DU]: [EVENT_GROUP.DU],
	[DB_EVENTS.PRODUCTION]: [EVENT_GROUP.PRODUCTION],
	[DB_EVENTS.PLAYER_DIED]: [EVENT_GROUP.DEATH],
	[DB_EVENTS.PLAYER_DIED_WITH_SEIZURE]: [EVENT_GROUP.DEATH, EVENT_GROUP.SEIZURE],
	[DB_EVENTS.PLAYER_BIRTH]: [EVENT_GROUP.DEATH],
	[DB_EVENTS.ACTION_GIVE]: [EVENT_GROUP.ACTION],
	[DB_EVENTS.ACTION_STEAL]: [EVENT_GROUP.ACTION],
	[DB_EVENTS.ACTION_SILENT_STEAL]: [EVENT_GROUP.ACTION],
	[DB_EVENTS.ACTION_ASSOCIATION]: [EVENT_GROUP.ACTION],
	[DB_EVENTS.ACTION_WAR]: [EVENT_GROUP.ACTION],
	[DB_EVENTS.ACTION_ONG]: [EVENT_GROUP.ACTION],
};

/** Every group an event belongs to — a type can be in several, so filtering tests membership. */
export function groupsOfEvent(typeEvent: string): EventGroup[] {
	return GROUPS_BY_TYPE[typeEvent] ?? [EVENT_GROUP.SYSTEM];
}

/** The group an event is drawn as. Display only — never tally or count on this. */
export function primaryGroupOfEvent(typeEvent: string): EventGroup {
	return groupsOfEvent(typeEvent)[0];
}

/** Client-side filter state of the events panel */
export interface EventFilter {
	gameStateId: string | null; // one game at a time (no "both" — see review 2a)
	group: EventGroup;
	emitter: string | null; // playerStateIdx / 'bank' / null = all
	receiver: string | null;
}

/**
 * Apply the events panel's filter chips, testing group membership rather than equality.
 * Session-scoped events carry no gameStateId (session-started / -ended) and stay visible
 * under either game. Ids are compared as strings — they reach the client from two routes.
 */
export function filterEvents(events: GecoEventV2[], f: EventFilter): GecoEventV2[] {
	const sameId = (a?: string | null, b?: string | null) => String(a ?? '') === String(b ?? '');
	return events.filter(
		(ev) =>
			(!f.gameStateId || !ev.gameStateId || sameId(ev.gameStateId, f.gameStateId)) &&
			(f.group === EVENT_GROUP.ALL || groupsOfEvent(ev.typeEvent).includes(f.group)) &&
			(!f.emitter || sameId(ev.emitter, f.emitter)) &&
			(!f.receiver || sameId(ev.receiver, f.receiver))
	);
}
