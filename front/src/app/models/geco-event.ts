import { DB_EVENTS, DbEvent } from '@geco/shared';
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
 * ─── "LK" SNAPSHOT CONVENTION (LK = Last Knowledge) ──────────────────────────
 * Every event that CHANGES a balance should carry the ABSOLUTE state right
 * AFTER the mutation, so the results view plots points directly instead of
 * re-folding the whole event history (less boilerplate, no drift when an
 * event is missing or a game was recovered mid-way).
 *
 *   emitterCoinsLK / receiverCoinsLK   coins of each side after the event
 *   emitterCardsCountLK / receiverCardsCountLK   hand size after
 *   emitterCardsValueLK / receiverCardsValueLK   hand value (Σ card.price) after
 *   massMonetaryLK   gameState.currentMassMonetary after the event
 *   duLK             gameState.currentDU at the event date (june only)
 *   bankCoinsLK      bank balance after the event (debt only)
 *
 * The front (SessionResultsService) uses these when present and only falls
 * back to fold-reconstruction when absent (legacy events).
 *
 * TODO(back): enrich EventHelper.createEvent call sites with the LK fields:
 *   - player.state.service.js  transaction → { cost, card, emitterCoinsLK,
 *     receiverCoinsLK, emitterCardsCountLK, receiverCardsCountLK, massMonetaryLK, duLK }
 *   - bank.state.service.js    credit-new / credit-settled / credit-fault /
 *     credit-seized-dead / free-money → { ..., receiverCoinsLK, bankCoinsLK, massMonetaryLK }
 *   - game.state.service.js    distrib-du → { du, receiverCoinsLK?, massMonetaryLK, duLK }
 *     (a single 'distrib-du' event with receiver='all' + per-player coinsLK map
 *      `coinsByPlayerLK: { [playerStateIdx]: number }` is even better than N events)
 *   - action.state.service.js  action-* → add emitter/receiver CardsCountLK + CardsValueLK
 */
export interface LkSnapshot {
	emitterCoinsLK?: number;
	receiverCoinsLK?: number;
	emitterCardsCountLK?: number;
	receiverCardsCountLK?: number;
	emitterCardsValueLK?: number;
	receiverCardsValueLK?: number;
	massMonetaryLK?: number;
	duLK?: number;
	bankCoinsLK?: number;
	/** distrib-du broadcast variant: absolute coins per player after DU */
	coinsByPlayerLK?: { [playerStateIdx: string]: number };
}

export interface TransactionPayload extends LkSnapshot {
	cost: number;
	card: Card;
}

export interface CreditPayload extends LkSnapshot {
	creditId?: string;
	amount: number;
	interest: number;
}

export interface DistribDuPayload extends LkSnapshot {
	du: number;
}

export interface DeathPayload extends LkSnapshot {
	coins: number;
	cards: Card[];
}

/** action-give / action-steal / action-silent-steal / action-war / action-ong */
export interface ActionPayload extends LkSnapshot {
	card?: Card;
	cards?: Card[];
	stolen?: Card[];
	victims?: number[];
	recipients?: number[];
}

/**
 * TODO(back): production is not persisted as a DB_EVENT in v2 yet
 * (IO.PLAYER.PROD_DISCARDS / PROD_DRAW_CARDS exist but no DB_EVENTS.PRODUCTION).
 * Add DB_EVENTS.PRODUCTION = 'production' emitted from the produce flow with:
 *   { discards: Card[], newCards: Card[], emitterCardsCountLK, emitterCardsValueLK }
 */
export interface ProductionPayload extends LkSnapshot {
	discards: Card[];
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
 */
export const EVENT_GROUP = {
	ALL: 'all',
	TRANSACTION: 'transaction',
	CREDIT: 'credit',
	INTEREST: 'interest',
	DU: 'du',
	PRODUCTION: 'production',
	DEATH: 'death',
	SEIZURE: 'seizure',
	ACTION: 'action',
	SYSTEM: 'system',
} as const;
export type EventGroup = (typeof EVENT_GROUP)[keyof typeof EVENT_GROUP];

const GROUP_BY_TYPE: { [typeEvent: string]: EventGroup } = {
	[DB_EVENTS.TRANSACTION]: EVENT_GROUP.TRANSACTION,
	[DB_EVENTS.FREE_MONEY]: EVENT_GROUP.CREDIT,
	[DB_EVENTS.CREDIT_NEW]: EVENT_GROUP.CREDIT,
	[DB_EVENTS.CREDIT_REQUEST]: EVENT_GROUP.CREDIT,
	[DB_EVENTS.CREDIT_EXTENDED]: EVENT_GROUP.CREDIT,
	[DB_EVENTS.CREDIT_SETTLED]: EVENT_GROUP.CREDIT,
	[DB_EVENTS.CREDIT_FAULT]: EVENT_GROUP.CREDIT,
	[DB_EVENTS.CREDIT_CANCELED]: EVENT_GROUP.CREDIT,
	[DB_EVENTS.CREDIT_SEIZED_DEAD]: EVENT_GROUP.SEIZURE,
	// TODO(back): DB_EVENTS.CREDIT_INTEREST_PAID is missing (interest is only an IO event today).
	// Persist it so the "Intérêts" filter has data: map it here to EVENT_GROUP.INTEREST.
	'credit-interest-paid': EVENT_GROUP.INTEREST,
	[DB_EVENTS.DISTRIB_DU]: EVENT_GROUP.DU,
	[DB_EVENTS.FIRST_DU]: EVENT_GROUP.DU,
	// TODO(back): see ProductionPayload note.
	'production': EVENT_GROUP.PRODUCTION,
	[DB_EVENTS.PLAYER_DIED]: EVENT_GROUP.DEATH,
	[DB_EVENTS.PLAYER_BIRTH]: EVENT_GROUP.DEATH,
	[DB_EVENTS.ACTION_GIVE]: EVENT_GROUP.ACTION,
	[DB_EVENTS.ACTION_STEAL]: EVENT_GROUP.ACTION,
	[DB_EVENTS.ACTION_SILENT_STEAL]: EVENT_GROUP.ACTION,
	[DB_EVENTS.ACTION_WAR]: EVENT_GROUP.ACTION,
	[DB_EVENTS.ACTION_ONG]: EVENT_GROUP.ACTION,
};

export function groupOfEvent(typeEvent: string): EventGroup {
	return GROUP_BY_TYPE[typeEvent] ?? EVENT_GROUP.SYSTEM;
}

/** Client-side filter state of the events panel */
export interface EventFilter {
	gameStateId: string | null; // one game at a time (no "both" — see review 2a)
	group: EventGroup;
	emitter: string | null; // playerStateIdx / 'bank' / null = all
	receiver: string | null;
}

export function filterEvents(events: GecoEventV2[], f: EventFilter): GecoEventV2[] {
	return events.filter(
		(ev) =>
			(!f.gameStateId || ev.gameStateId === f.gameStateId) &&
			(f.group === EVENT_GROUP.ALL || groupOfEvent(ev.typeEvent) === f.group) &&
			(!f.emitter || ev.emitter === f.emitter) &&
			(!f.receiver || ev.receiver === f.receiver)
	);
}
