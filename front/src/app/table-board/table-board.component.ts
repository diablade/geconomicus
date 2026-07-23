import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Subscription, combineLatest, map, take } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { GameStateService } from '../services/api/game-state.service';
import { I18nService } from '../services/i18n.service';
import { SnackbarService } from '../services/snackbar.service';
import { environment } from '../../environments/environment';
import { Card, ConnectionStatus, Credit, PlayerState } from '../models/gameState';
import { Avatar } from '../models/avatar';
import { getActionIcon } from '../models/rules';
import { CREDIT_STATUS, GAME_TYPE, PLAYER_STATUS } from '@geco/shared';
import * as _ from 'lodash-es';
import { getBackgroundStyle } from '../services/avatarTools';
import { ContractDialogComponent } from '../dialogs/contract-dialog/contract-dialog.component';
import { FreeMoneyDialogComponent } from '../dialogs/free-money-dialog/free-money-dialog.component';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { SeizureDialogComponent } from '../dialogs/seizure-dialog/seizure-dialog.component';
import { ReJoinQrDialogComponent } from '../dialogs/re-join-qr-dialog/re-join-qr-dialog.component';

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
	protected readonly ALIVE = PLAYER_STATUS.ALIVE;
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
	bankOpen = true;

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
		map((vm) => {
			const alive = vm.rows.filter((r) => r.status !== PLAYER_STATUS.DEAD);
			const totalDebt = vm.rows.reduce((sum, r) => sum + r.debt, 0);
			return {
				...vm,
				alive,
				dead: vm.rows.filter((r) => r.status === PLAYER_STATUS.DEAD),
				connectedCount: vm.rows.filter((r) => r.status !== PLAYER_STATUS.DEAD && r.connection?.isConnected).length,
				totalTokens: vm.rows.reduce(
					(sum, r) => (r.status !== PLAYER_STATUS.DEAD ? sum + (r.actionTokens ?? 0) : sum),
					0
				),
				activeCreditsCount: vm.credits.filter((c) => this.isCreditActive(c)).length,
				totalDebt,
				avgCurrency: alive.length ? (vm.gameState.currentMassMonetary || 0) / alive.length : 0,
			};
		})
	);

	constructor(
		private route: ActivatedRoute,
		private gameStateService: GameStateService,
		private i18nService: I18nService,
		private snackbarService: SnackbarService,
		private dialog: MatDialog
	) {
		this.i18nService.loadNamespace('action');
		this.i18nService.loadNamespace('master');
		this.i18nService.loadNamespace('table');
		this.i18nService.loadNamespace('bank');
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
			const playerCredits = credits.filter((c) => c.playerStateIdx === ps.idx);
			const active = playerCredits.filter((c) => this.isCreditActive(c));
			const closed = playerCredits
				.filter((c) => c.status === CREDIT_STATUS.DONE || c.status === CREDIT_STATUS.CANCELED)
				.sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime());
			return {
				...ps,
				dedupedCards: this.countOccurrencesAndHideDuplicates([...(ps.cards ?? [])]),
				nbCards: (ps.cards ?? []).length,
				// active first, then closed (greyed) history
				credits: [...active, ...closed],
				debt: active.reduce((sum, c) => sum + c.amount + c.interest, 0),
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

	private alivePlayers$() {
		return this.gameStateService.playersAC$.pipe(map((players) => players.filter((p) => p.status === this.ALIVE)));
	}

	/** Chip menu callback: route the per-credit action to its dialog flow. */
	onChipAction(event: { action: string; credit: Credit }): void {
		if (event.action === 'cancel') {
			this.cancelCredit(event.credit);
		} else if (event.action === 'seize') {
			this.seizureProcedure(event.credit);
		}
	}

	// ── bank actions ───────────────────────────────────────────────────────────────

	/** Give a credit. When `player` is set (launched from a row) the target is pre-filled + locked. */
	showContract(player?: any): void {
		const dialogRef = this.dialog.open(ContractDialogComponent, {
			data: {
				rules: this.gameStateService.rules$,
				players: this.alivePlayers$(),
				player,
			},
		});
		dialogRef.afterClosed().subscribe((contrat) => {
			if (contrat) {
				this.gameStateService.createCredit(contrat);
			}
		});
	}

	creditForAll(): void {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant('BANK.CREDIT_FOR_ALL'),
				message: this.i18nService.instant('BANK.CREDIT_FOR_ALL_MESSAGE'),
			},
		});
		dialogRef.afterClosed().subscribe((result) => {
			if (result === 'btnConfirm') {
				this.gameStateService.creditForAll();
			}
		});
	}

	/** Free money. When `player` is set (launched from a row) the target is pre-filled + locked. */
	freeMoney(player?: any): void {
		const dialogRef = this.dialog.open(FreeMoneyDialogComponent, {
			data: {
				players: this.alivePlayers$(),
				player,
			},
		});
		dialogRef.afterClosed().subscribe((give) => {
			if (give && give.amount > 0) {
				this.gameStateService.giveFreeMoney(give);
			}
		});
	}

	cancelCredit(credit: Credit): void {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant('CREDIT.CANCEL'),
				message: this.i18nService.instant('CREDIT.CANCEL_MESSAGE', {
					amount: credit.amount,
					username: this.gameStateService.getAvatar(credit.playerStateIdx)?.name,
				}),
				message2: this.i18nService.instant('CREDIT.CANCEL_MESSAGE2'),
			},
		});
		dialogRef.afterClosed().subscribe((result) => {
			if (result === 'btnConfirm') {
				this.gameStateService.cancelCredit(credit);
			}
		});
	}

	seizureProcedure(credit: Credit): void {
		combineLatest({
			rules: this.gameStateService.rules$,
			playersAC: this.gameStateService.playersAC$,
		})
			.pipe(take(1))
			.subscribe(({ rules, playersAC }) => {
				const targetPlayer = playersAC.find((p) => p.idx === credit.playerStateIdx);
				if (!targetPlayer) {
					this.snackbarService.showError('ERROR.PLAYER_NOT_FOUND');
					return;
				}
				const confDialogRef = this.dialog.open(SeizureDialogComponent, {
					data: {
						credit,
						seizureType: rules.seizureType,
						seizureCosts: rules.seizureCosts,
						seizureDecote: rules.seizureDecote,
						timerPrison: rules.timerPrison,
						playerState: targetPlayer,
						playerCards: targetPlayer.cards || [],
						playerCoins: targetPlayer.coins || 0,
						avatar: targetPlayer.avatar,
					},
				});
				confDialogRef.afterClosed().subscribe((seizure) => {
					if (seizure) {
						this.gameStateService.seizureOnCredit(seizure, credit);
					} else {
						this.snackbarService.showError('ERROR.SEIZURE_CANCELLED');
					}
				});
			});
	}

	breakFree(playerStateIdx: number): void {
		this.gameStateService.prisonBreak(playerStateIdx);
	}

	killPlayer(row: TableRow): void {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant('MASTER.KILL_USER'),
				message: this.i18nService.instant('MASTER.KILL_CONFIRM', { username: row.avatar?.name }),
			},
		});
		dialogRef.afterClosed().subscribe((result) => {
			if (result === 'btnConfirm') {
				this.gameStateService.killPlayer(row.idx);
			}
		});
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

	refreshPlayer(row: TableRow): void {
		this.gameStateService.refreshPlayer(this.gameStateId, row.idx).subscribe(() => {
			this.snackbarService.showSuccess(this.i18nService.instant('AVATAR.UPDATED'));
		});
	}

	refreshAllPlayers(): void {
		this.gameStateService.refreshAllPlayers(this.gameStateId).subscribe(() => {
			this.snackbarService.showSuccess(this.i18nService.instant('AVATAR.UPDATED'));
		});
	}

	playUser(row: TableRow): void {
		window.open(this.getPlayerStateUrl(row), '_blank');
	}

	copyPlayerLink(row: TableRow): void {
		navigator.clipboard.writeText(this.getPlayerStateUrl(row));
		this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.COPY_SUCCESS'));
	}

	reJoin(row: TableRow): void {
		this.dialog.open(ReJoinQrDialogComponent, {
			data: {
				text: row.avatar?.name || '',
				url: this.getPlayerStateUrl(row),
			},
		});
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

	trackByCredit(index: number, credit: Credit): string {
		return credit.id;
	}
}
