import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DB_EVENTS, GAME_TYPE, LK_KEYS } from '@geco/shared';
import {
	EVENT_GROUP,
	EventFilter,
	EventGroup,
	filterEvents,
	GecoEventV2,
	primaryGroupOfEvent,
} from '../models/geco-event';
import { I18nService } from '../services/i18n.service';
import { LifeRef } from '../services/session-results.service';

interface MiniCard {
	letter: string;
	/** nom de la classe couleur du jeu (red / yellow / green / blue), pas une couleur CSS */
	colorClass: string;
	arrow?: boolean;
}

/** un morceau de la ligne de détail, traduit à l'affichage */
interface DetailBit {
	key: string;
	params?: { [name: string]: string | number };
}

/**
 * ─── EventsV2Component ──────────────────────────────────────────────────────
 * Successeur du events.component v1 : panneau autonome et réutilisable
 * (vue résultats comparés, mais aussi master board, écran replay…).
 *
 * Reçoit le flux BRUT ordonné (toute la session) + le contexte, gère TOUT le
 * filtrage client-side : partie (une seule à la fois), type (chips), émetteur,
 * récepteur. Aucune requête réseau ici — le parent fetch via EventService.
 * Le panneau porte son propre titre et son bouton replier/déplier ; le parent
 * ne fournit que la place (et peut suivre l'état via collapsedChange).
 *
 * Tous les libellés viennent du namespace i18n `events` : les valeurs de
 * DB_EVENTS, EVENT_GROUP, CREDIT_ORIGIN et CREDIT_QUESTION_ANSWER sont les clés.
 *
 * Usage :
 *   <app-events-v2
 *       [events]="events" [players]="lives" [games]="games"
 *       [initialGameId]="games.length ? games[0].id : null"
 *       [(collapsed)]="eventsCollapsed"
 *       (filterChange)="onEventsFilter($event)">
 *   </app-events-v2>
 */
@Component({
	selector: 'app-events-v2',
	templateUrl: './events-v2.component.html',
	styleUrls: ['./events-v2.component.scss'],
})
export class EventsV2Component {
	@Input() events: GecoEventV2[] = [];
	@Input() players: LifeRef[] = [];
	/** `label` est une clé de traduction, pas un texte (ex: EVENTS.TAB_DEBT) */
	@Input() games: { id: string; label: string }[] = [];
	@Input() set initialGameId(id: string | null) {
		if (id && !this.touched) this.filter = { ...this.filter, gameStateId: id };
	}
	@Input() collapsed = false;
	@Output() collapsedChange = new EventEmitter<boolean>();
	/** le parent peut réagir (ex: surligner les joueurs filtrés sur les graphes) */
	@Output() filterChange = new EventEmitter<EventFilter>();

	filter: EventFilter = { gameStateId: null, group: EVENT_GROUP.ALL, emitter: null, receiver: null };
	private touched = false;
	private duSource: GecoEventV2[] = [];
	private duSteps = new Map<string, { at: number; du: number }[]>();

	readonly groups: EventGroup[] = [
		EVENT_GROUP.ALL,
		EVENT_GROUP.TRANSACTION,
		EVENT_GROUP.PRODUCTION,
		EVENT_GROUP.CREDIT,
		EVENT_GROUP.DU,
		EVENT_GROUP.DEATH,
		EVENT_GROUP.SEIZURE,
		EVENT_GROUP.ACTION,
		EVENT_GROUP.SYSTEM,
	];

	constructor(private i18n: I18nService) {
		this.i18n.loadNamespace('events');
	}

	/** le flux réduit aux filtres courants */
	get filtered(): GecoEventV2[] {
		return filterEvents(this.events, this.filter);
	}

	/** les vies de la partie affichée — un idx seul se répète d'une partie à l'autre */
	get gamePlayers(): LifeRef[] {
		if (!this.filter.gameStateId) return this.players;
		return this.players.filter((p) => String(p.gameStateId) === String(this.filter.gameStateId));
	}

	/** replie ou déplie le panneau, et le dit au parent qui lui réserve la place */
	toggle(): void {
		this.collapsed = !this.collapsed;
		this.collapsedChange.emit(this.collapsed);
	}

	/** change de partie ; les acteurs choisis appartenaient à l'autre, ils sautent */
	setGame(id: string): void { this.patch({ gameStateId: id, emitter: null, receiver: null }); }
	/** ne garde que les évènements du groupe cliqué */
	setGroup(g: EventGroup): void { this.patch({ group: g }); }
	/** ne garde que ce qu'un acteur a fait */
	setEmitter(e: string | null): void { this.patch({ emitter: e }); }
	/** ne garde que ce qu'un acteur a subi */
	setReceiver(r: string | null): void { this.patch({ receiver: r }); }

	/** applique un morceau de filtre et prévient le parent */
	private patch(p: Partial<EventFilter>): void {
		this.touched = true;
		this.filter = { ...this.filter, ...p };
		this.filterChange.emit(this.filter);
	}

	/** garde les boutons en place d'un cycle à l'autre, sinon un clic peut se perdre */
	trackById(_i: number, item: { id: string }): string { return item.id; }
	/** garde les chips en place d'un cycle à l'autre */
	trackByGroup(_i: number, group: EventGroup): string { return group; }
	/** garde les lignes en place d'un cycle à l'autre */
	trackByEvent(_i: number, ev: GecoEventV2): string { return ev._id; }

	/* ── présentation d'une ligne ── */
	/** groupe dessiné par la pastille colorée */
	groupOf(ev: GecoEventV2): EventGroup {
		return primaryGroupOfEvent(ev.typeEvent);
	}

	/** nom lisible d'un acteur : vie, banque, animateur, ou rien */
	nameOf(idx?: string): string {
		if (!idx || idx === '-') return '';
		if (idx === 'bank') return this.i18n.instant('EVENTS.BANK');
		if (idx === 'master') return this.i18n.instant('EVENTS.MASTER');
		if (idx === 'all') return this.i18n.instant('EVENTS.ALL');
		const life = this.gamePlayers.find((p) => String(p.idx) === String(idx));
		return life ? this.labelOf(life) : idx;
	}

	/** nom d'une vie, numéroté à partir de la deuxième vie d'un même avatar */
	labelOf(life: LifeRef): string {
		return life.ordinal > 1 ? `${life.name} (${life.ordinal})` : life.name;
	}

	/** émetteur → récepteur, réduit à un seul nom quand c'est la même personne (production, mort…) */
	whoOf(ev: GecoEventV2): string {
		const from = this.nameOf(ev.emitter);
		const to = this.nameOf(ev.receiver);
		if (from && to && from !== to) return `${from} → ${to}`;
		return from || to;
	}

	/** cartes miniatures à afficher sous la ligne (transaction / production / saisie / action) */
	cardsOf(ev: GecoEventV2): MiniCard[] {
		const p: any = ev.payload ?? {};
		const toMini = (c: any): MiniCard => ({ letter: c?.letter ?? '?', colorClass: c?.color ?? '' });
		const arrow: MiniCard = { letter: '→', colorClass: '', arrow: true };
		if (Array.isArray(p.consumed) && p.produced) return [...p.consumed.map(toMini), arrow, toMini(p.produced)];
		if (p.card) return [toMini(p.card)];
		if (Array.isArray(p.stolen)) return p.stolen.map(toMini);
		if (Array.isArray(p.cards)) return p.cards.map(toMini);
		if (Array.isArray(p.discards)) return [...p.discards.map(toMini), arrow, ...(p.newCards ?? []).map(toMini)];
		if (Array.isArray(p.newCards)) return p.newCards.map(toMini);
		return [];
	}

	/** la somme en jeu, quand l'évènement en porte une ; un achat porte la sienne sous ses cartes */
	amountOf(ev: GecoEventV2): string {
		const p: any = ev.payload ?? {};
		if (ev.typeEvent === DB_EVENTS.TRANSACTION) return '';
		if (p.cost != null) return `${p.cost}`;
		if (p.amount != null) return `${p.amount}${p.interest ? ' +' + p.interest : ''}`;
		if (p.du != null) return `DU ${p.du}`;
		return '';
	}

	/** les paliers de DU de chaque partie, recalculés seulement quand le flux change */
	private stepsOf(gameStateId?: string): { at: number; du: number }[] {
		if (this.duSource !== this.events) {
			this.duSource = this.events;
			this.duSteps = new Map();
			this.events.forEach((ev) => {
				const payload: any = ev.payload ?? {};
				const du = [payload[LK_KEYS.DU], payload.du, payload.firstDU].find((value) => Number.isFinite(value));
				if (du === undefined) return;
				const key = String(ev.gameStateId ?? '');
				const steps = this.duSteps.get(key) ?? [];
				steps.push({ at: new Date(ev.at).getTime(), du });
				this.duSteps.set(key, steps);
			});
			this.duSteps.forEach((steps) => steps.sort((a, b) => a.at - b.at));
		}
		return this.duSteps.get(String(gameStateId ?? '')) ?? [];
	}

	/**
	 * Le DU en vigueur à cet instant.
	 * @returns undefined en monnaie dette, où aucun DU n'a jamais été distribué.
	 */
	private duAt(ev: GecoEventV2): number | undefined {
		const steps = this.stepsOf(ev.gameStateId);
		if (!steps.length) return undefined;
		const at = new Date(ev.at).getTime();
		const passed = steps.filter((step) => step.at <= at);
		return passed.length ? passed[passed.length - 1].du : steps[0].du;
	}

	/** prix d'un achat, dans sa monnaie et — en monnaie libre — aussi en dividendes */
	priceOf(ev: GecoEventV2): string {
		if (ev.typeEvent !== DB_EVENTS.TRANSACTION) return '';
		const cost = (ev.payload as any)?.cost;
		if (!Number.isFinite(cost)) return '';
		const du = this.duAt(ev);
		if (!du) return `${cost} ${this.i18n.instant('CURRENCY.EURO')}`;
		const inDu = Math.round((cost / du) * 100) / 100;
		return `${cost} ${this.i18n.instant('CURRENCY.JUNE')} · ${inDu} ${this.i18n.instant('CURRENCY.DU')}`;
	}

	/** seconde ligne en clair : ce que le payload dit de plus que le titre */
	detailOf(ev: GecoEventV2): DetailBit[] {
		const p: any = ev.payload ?? {};
		const bits: DetailBit[] = [];
		if (p.typeMoney) bits.push({ key: p.typeMoney === GAME_TYPE.JUNE ? 'EVENTS.MONEY_FREE' : 'EVENTS.MONEY_DEBT' });
		if (p.prisonTime != null) bits.push({ key: 'EVENTS.PRISON_TIME', params: { minutes: p.prisonTime } });
		if (p.origin) bits.push({ key: `EVENTS.CREDIT_ORIGIN.${p.origin}` });
		if (p.answer) bits.push({ key: `EVENTS.CREDIT_QUESTION_ANSWER.${p.answer}` });
		if (Array.isArray(p.victims) && p.victims.length) {
			bits.push({ key: 'EVENTS.VICTIMS', params: { names: this.namesOf(p.victims) } });
		}
		if (Array.isArray(p.recipients) && p.recipients.length) {
			bits.push({ key: 'EVENTS.RECIPIENTS', params: { names: this.namesOf(p.recipients) } });
		}
		if (p.seizure) {
			bits.push({
				key: 'EVENTS.SEIZED',
				params: { coins: p.seizure.totalCoinSeized, cards: p.seizure.cards?.length ?? 0 },
			});
			if (p.seizure.notPayed) bits.push({ key: 'EVENTS.UNPAID', params: { amount: p.seizure.notPayed } });
		}
		if (Array.isArray(p.gamesRules_idx)) {
			bits.push({ key: 'EVENTS.GAMES_PLANNED', params: { count: p.gamesRules_idx.length } });
		}
		return bits;
	}

	/** liste de noms lisible, pour les victimes et les bénéficiaires d'une action */
	private namesOf(indexes: any[]): string {
		return indexes.map((i) => this.nameOf(String(i))).join(', ');
	}

	/** couleur du groupe, portée par la pastille et le liseré de la ligne */
	badgeColor(ev: GecoEventV2): string {
		const COLORS: { [g: string]: string } = {
			[EVENT_GROUP.TRANSACTION]: '#2c7fb8',
			[EVENT_GROUP.PRODUCTION]: '#7cb342',
			[EVENT_GROUP.CREDIT]: '#8e24aa',
			[EVENT_GROUP.DU]: '#f0932a',
			[EVENT_GROUP.DEATH]: '#455a64',
			[EVENT_GROUP.SEIZURE]: '#b3261e',
			[EVENT_GROUP.ACTION]: '#00897b',
		};
		return COLORS[primaryGroupOfEvent(ev.typeEvent)] ?? '#14142b';
	}
}
