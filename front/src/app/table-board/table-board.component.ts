import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Subscription, combineLatest, map } from 'rxjs';
import { GameStateService } from '../services/api/game-state.service';
import { I18nService } from '../services/i18n.service';
import { environment } from '../../environments/environment';
import { Card, ConnectionStatus, Credit, PlayerState } from '../models/gameState';
import { Avatar } from '../models/avatar';
import { getActionIcon } from '../models/rules';
import { CREDIT_STATUS, GAME_TYPE, PLAYER_STATUS } from '@geco/shared';
import * as _ from 'lodash-es';
import { getBackgroundStyle } from '../services/avatarTools';

type SortKey = 'coins' | 'cards' | 'name';
type ViewMode = 'table' | 'boards';

const VIEW_MODE_STORAGE_KEY = 'geco-table-board-view';

export interface TableRow extends PlayerState {
	avatar?: Avatar;
	connection?: ConnectionStatus;
	dedupedCards: Card[];
	nbCards: number;
	debt: number;
	credits: Credit[];
}

@Component({
	selector: 'app-table-board',
	templateUrl: './table-board.component.html',
	styleUrls: ['./table-board.component.scss'],
})
export class TableBoardComponent implements OnInit, OnDestroy {
	protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly DEAD = PLAYER_STATUS.DEAD;
	protected readonly PRISON = PLAYER_STATUS.PRISON;
	protected readonly getActionIcon = getActionIcon;

    getBackgroundStyle = getBackgroundStyle;

	sessionId = '';
	gameStateId = '';
	private subscription: Subscription | undefined;

	sortBy$ = new BehaviorSubject<SortKey>('coins');
	viewMode: ViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'boards' ? 'boards' : 'table';
	decksOpen = true;
	rulesOpen = true;

	masterConnection$ = this.gameStateService.masterConnection$;
	minutes$ = this.gameStateService.minutes$;
	seconds$ = this.gameStateService.seconds$;

	// one card per (weight, letter) with a count badge, like master-admin
	decks$ = this.gameStateService.gameState$.pipe(
		map((gs) => (gs.decks ?? []).map((deck) => this.countOccurrencesAndHideDuplicates([...deck])))
	);

	rows$ = combineLatest({
		players: this.gameStateService.playersAC$,
		credits: this.gameStateService.credits$,
		sortBy: this.sortBy$,
	}).pipe(map(({ players, credits, sortBy }) => this.buildRows(players, credits, sortBy)));

	vm$ = combineLatest({
		gameState: this.gameStateService.gameState$,
		rules: this.gameStateService.rules$,
		session: this.gameStateService.session$,
		credits: this.gameStateService.credits$,
		rows: this.rows$,
		decks: this.decks$,
		minutes: this.minutes$,
		seconds: this.seconds$,
	}).pipe(
		map((vm) => ({
			...vm,
			alive: vm.rows.filter((r) => r.status !== PLAYER_STATUS.DEAD),
			dead: vm.rows.filter((r) => r.status === PLAYER_STATUS.DEAD),
			connectedCount: vm.rows.filter((r) => r.status !== PLAYER_STATUS.DEAD && r.connection?.isConnected).length,
			totalTokens: vm.rows.reduce(
				(sum, r) => (r.status !== PLAYER_STATUS.DEAD ? sum + (r.actionTokens ?? 0) : sum),
				0
			),
			activeCreditsCount: vm.credits.filter((c) => this.isCreditActive(c)).length,
		}))
	);

	constructor(
		private route: ActivatedRoute,
		private gameStateService: GameStateService,
		private i18nService: I18nService
	) {
		this.i18nService.loadNamespace('action');
		this.i18nService.loadNamespace('master');
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.gameStateId = params['gameStateId'];
			// isBank=true so credit socket events keep the credits column live
			this.gameStateService.loadForMaster(this.sessionId, this.gameStateId, true);
		});
	}

	ngOnDestroy(): void {
		this.gameStateService.leaveRooms();
		this.gameStateService.offAll();
		if (this.subscription) this.subscription.unsubscribe();
	}

	// ── rows ─────────────────────────────────────────────────────────────────────

	private buildRows(players: any[], credits: Credit[], sortBy: SortKey): TableRow[] {
		const rows: TableRow[] = players.map((ps) => {
			const playerCredits = credits.filter(
				(c) =>
					c.playerStateIdx === ps.idx &&
					c.status !== CREDIT_STATUS.DONE &&
					c.status !== CREDIT_STATUS.CANCELED
			);
			return {
				...ps,
				dedupedCards: this.countOccurrencesAndHideDuplicates([...(ps.cards ?? [])]),
				nbCards: (ps.cards ?? []).length,
				credits: playerCredits,
				debt: playerCredits
					.filter((c) => this.isCreditActive(c))
					.reduce((sum, c) => sum + c.amount + c.interest, 0),
			};
		});
		return rows.sort((a, b) => {
			const aDead = a.status === PLAYER_STATUS.DEAD ? 1 : 0;
			const bDead = b.status === PLAYER_STATUS.DEAD ? 1 : 0;
			if (aDead !== bDead) return aDead - bDead;
			if (sortBy === 'coins') return b.coins - a.coins;
			if (sortBy === 'cards') return b.nbCards - a.nbCards;
			return (a.name || '').localeCompare(b.name || '', 'fr');
		});
	}

	countOccurrencesAndHideDuplicates(cards: Card[]): Card[] {
		cards = _.orderBy(cards, ['weight', 'letter'], ['asc', 'asc']);
		const countByResult = _.countBy(cards, (c: Card) => c.weight + '-' + c.letter);
		const seen: string[] = [];
		for (const c of cards) {
			const countKey = c.weight + '-' + c.letter;
			c.count = countByResult[countKey] || 0;
			const alreadySeen = seen.includes(countKey);
			c.displayed = !alreadySeen;
			if (!alreadySeen) seen.push(countKey);
		}
		return cards;
	}

	// ── credits ──────────────────────────────────────────────────────────────────

	isCreditActive(credit: Credit): boolean {
		return (
			credit.status === CREDIT_STATUS.RUNNING ||
			credit.status === CREDIT_STATUS.REQUESTING ||
			credit.status === CREDIT_STATUS.PAUSED ||
			credit.status === CREDIT_STATUS.IDLE ||
			credit.status === CREDIT_STATUS.FAULT
		);
	}

	creditChipClass(status: string): string {
		switch (status) {
			case CREDIT_STATUS.RUNNING:
				return 'running';
			case CREDIT_STATUS.REQUESTING:
				return 'requesting';
			case CREDIT_STATUS.PAUSED:
			case CREDIT_STATUS.IDLE:
				return 'paused';
			case CREDIT_STATUS.FAULT:
				return 'fault';
			case CREDIT_STATUS.CANCELED:
				return 'canceled';
			case CREDIT_STATUS.DONE:
				return 'credit-done';
			default:
				return 'running';
		}
	}

	creditChipLabel(status: string): string {
		switch (status) {
			case CREDIT_STATUS.RUNNING:
				return 'en cours';
			case CREDIT_STATUS.REQUESTING:
				return 'demande';
			case CREDIT_STATUS.PAUSED:
				return 'en pause';
			case CREDIT_STATUS.IDLE:
				return 'en attente';
			case CREDIT_STATUS.FAULT:
				return 'DEFAUT';
			case CREDIT_STATUS.CANCELED:
				return 'annule';
			case CREDIT_STATUS.DONE:
				return 'solde';
			default:
				return status;
		}
	}

	// ── ui ───────────────────────────────────────────────────────────────────────

	setSort(key: SortKey): void {
		this.sortBy$.next(key);
	}

	setViewMode(mode: ViewMode): void {
		this.viewMode = mode;
		localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
	}

	refresh(): void {
		window.location.reload();
	}

	getPlayerStateUrl(row: TableRow): string {
		return (
			environment.WEB_HOST +
			'player/' +
			this.sessionId +
			'/' +
			row.avatarIdx +
			'/' +
			this.gameStateId +
			'/' +
			row.idx
		);
	}

	trackByRow(index: number, row: TableRow): number {
		return row.idx;
	}

	trackByCard(index: number, card: Card): string {
		return card.key;
	}
}
