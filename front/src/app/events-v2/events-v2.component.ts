import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
	EVENT_GROUP,
	EventFilter,
	EventGroup,
	filterEvents,
	GecoEventV2,
	groupOfEvent,
} from '../models/geco-event';
import { PlayerRef } from '../services/session-results.service';

/**
 * ─── EventsV2Component ──────────────────────────────────────────────────────
 * Successeur du events.component v1 : panneau autonome et réutilisable
 * (vue résultats comparés, mais aussi master board, écran replay…).
 *
 * Reçoit le flux BRUT ordonné (toute la session) + le contexte, gère TOUT le
 * filtrage client-side : partie (une seule à la fois), type (chips), émetteur,
 * récepteur. Aucune requête réseau ici — le parent fetch via EventService.
 *
 * Usage :
 *   <app-events-v2
 *       [events]="events" [players]="players"
 *       [games]="[{id: detteGsId, label: '🪙 Dette'}, {id: libreGsId, label: '☀️ Libre'}]"
 *       [initialGameId]="detteGsId"
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
	@Input() players: PlayerRef[] = [];
	@Input() games: { id: string; label: string }[] = [];
	@Input() set initialGameId(id: string | null) {
		if (id && !this.touched) this.filter = { ...this.filter, gameStateId: id };
	}
	/** le parent peut réagir (ex: surligner les joueurs filtrés sur les graphes) */
	@Output() filterChange = new EventEmitter<EventFilter>();

	filter: EventFilter = { gameStateId: null, group: EVENT_GROUP.ALL, emitter: null, receiver: null };
	private touched = false;

	readonly groups: { id: EventGroup; label: string }[] = [
		{ id: EVENT_GROUP.ALL, label: 'Tous' },
		{ id: EVENT_GROUP.TRANSACTION, label: 'Achats' },
		{ id: EVENT_GROUP.PRODUCTION, label: 'Productions' },
		{ id: EVENT_GROUP.CREDIT, label: 'Crédits' },
		{ id: EVENT_GROUP.INTEREST, label: 'Intérêts' },
		{ id: EVENT_GROUP.DU, label: 'DU' },
		{ id: EVENT_GROUP.DEATH, label: 'Morts' },
		{ id: EVENT_GROUP.SEIZURE, label: 'Saisies' },
		{ id: EVENT_GROUP.ACTION, label: 'Actions' },
	];

	get filtered(): GecoEventV2[] {
		return filterEvents(this.events, this.filter);
	}

	setGame(id: string): void { this.patch({ gameStateId: id }); }
	setGroup(g: EventGroup): void { this.patch({ group: g }); }
	setEmitter(e: string | null): void { this.patch({ emitter: e }); }
	setReceiver(r: string | null): void { this.patch({ receiver: r }); }

	private patch(p: Partial<EventFilter>): void {
		this.touched = true;
		this.filter = { ...this.filter, ...p };
		this.filterChange.emit(this.filter);
	}

	/* ── présentation d'une ligne ── */
	groupOf = groupOfEvent;

	nameOf(idx?: string): string {
		if (!idx) return '';
		if (idx === 'bank') return 'Banque';
		if (idx === 'master') return 'Animateur';
		if (idx === 'all') return 'Tous';
		return this.players.find((p) => p.idx === idx)?.name ?? idx;
	}

	/** cartes miniatures à afficher sous la ligne (transaction / production / saisie / action) */
	cardsOf(ev: GecoEventV2): { letter: string; color: string }[] {
		const p: any = ev.payload ?? {};
		const toMini = (c: any) => ({ letter: c?.letter ?? '?', color: c?.color ?? '#ccc' });
		if (p.card) return [toMini(p.card)];
		if (Array.isArray(p.cards)) return p.cards.map(toMini);
		if (Array.isArray(p.discards)) return [...p.discards.map(toMini), { letter: '→', color: 'transparent' }, ...(p.newCards ?? []).map(toMini)];
		if (Array.isArray(p.stolen)) return p.stolen.map(toMini);
		return [];
	}

	amountOf(ev: GecoEventV2): string {
		const p: any = ev.payload ?? {};
		if (p.cost != null) return `${p.cost}`;
		if (p.amount != null) return `${p.amount}${p.interest ? ' +' + p.interest : ''}`;
		if (p.du != null) return `DU ${p.du}`;
		return '';
	}

	badgeColor(ev: GecoEventV2): string {
		const COLORS: { [g: string]: string } = {
			[EVENT_GROUP.TRANSACTION]: '#2c7fb8',
			[EVENT_GROUP.PRODUCTION]: '#7cb342',
			[EVENT_GROUP.CREDIT]: '#8e24aa',
			[EVENT_GROUP.INTEREST]: '#d81b60',
			[EVENT_GROUP.DU]: '#f0932a',
			[EVENT_GROUP.DEATH]: '#455a64',
			[EVENT_GROUP.SEIZURE]: '#b3261e',
			[EVENT_GROUP.ACTION]: '#00897b',
		};
		return COLORS[groupOfEvent(ev.typeEvent)] ?? '#14142b';
	}
}
