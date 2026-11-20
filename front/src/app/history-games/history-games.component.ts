import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DeprecatedBackService } from '../services/deprecated-back.service';
import { SESSION_STATUS, GAME_TYPE } from '@geco/shared';
// @ts-ignore
import * as C from '../../../../back/config/constantes_deprecated.cjs';

import * as _ from 'lodash-es';
import {
	faTrashCan,
	faArrowUpWideShort,
	faArrowDownShortWide,
	faArrowLeft,
	faMagnifyingGlass,
	faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { SnackbarService } from '../services/snackbar.service';
import { I18nService } from '../services/i18n.service';
import { SessionService } from '../services/api/session.service';
import { Session } from '../models/session';
import { ThemesService } from '../services/themes.service';

const STATE_KEY = 'historyGamesState';

interface HistoryState {
	filterByName: string;
	filterByStatus: string;
	sortBy: string;
	sortOrder: 'asc' | 'desc';
	legacyOpen: boolean;
	scrollTop: number;
}

/** Reads the page state saved on the last visit, falling back to defaults. */
function loadState(): HistoryState {
	const defaults: HistoryState = {
		filterByName: '',
		filterByStatus: '',
		sortBy: 'createdAt',
		sortOrder: 'desc',
		legacyOpen: false,
		scrollTop: 0,
	};
	try {
		return { ...defaults, ...JSON.parse(sessionStorage.getItem(STATE_KEY) || '{}') };
	} catch {
		return defaults;
	}
}

@Component({
	selector: 'app-history-games',
	templateUrl: './history-games.component.html',
	styleUrls: ['./history-games.component.scss'],
})
export class HistoryGamesComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild('scroller') scroller!: ElementRef<HTMLElement>;
	protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly OPEN = SESSION_STATUS.OPEN;
	protected readonly IN_PROGRESS = SESSION_STATUS.IN_PROGRESS;
	protected readonly ENDED = SESSION_STATUS.ENDED;
	protected readonly statusOptions = [
		{ value: '', label: 'ALL' },
		{ value: SESSION_STATUS.OPEN, label: 'HISTORY.STATUS.OPEN' },
		{ value: SESSION_STATUS.IN_PROGRESS, label: 'HISTORY.STATUS.IN_PROGRESS' },
		{ value: SESSION_STATUS.ENDED, label: 'HISTORY.STATUS.ENDED' },
	];
	C = C;
	faTrashCan = faTrashCan;
	faArrowUpWideShort = faArrowUpWideShort;
	faArrowDownShortWide = faArrowDownShortWide;
	faArrowLeft = faArrowLeft;
	faMagnifyingGlass = faMagnifyingGlass;
	faChevronRight = faChevronRight;
	deleteGames = false;
	games: any;
	sessions: Session[] | null = null;
	statusCounts: Record<string, number> = {};
	private readonly savedState = loadState();
	filterByName = this.savedState.filterByName;
	filterByStatus = this.savedState.filterByStatus;
	sortBy = this.savedState.sortBy;
	sortOrder = this.savedState.sortOrder;
	legacyOpen = this.savedState.legacyOpen;
	private scrollTop = this.savedState.scrollTop;

	constructor(
		private backService: DeprecatedBackService,
		public dialog: MatDialog,
		private snackbarService: SnackbarService,
		private i18nService: I18nService,
		private themesService: ThemesService,
		private sessionService: SessionService,
		private ngZone: NgZone
	) {
		this.i18nService.loadNamespace('history');
	}

	/** Sessions matching the name and status filters, in the chosen order. */
	get filteredSessions(): Session[] {
		const name = this.filterByName.trim().toLowerCase();
		return _.orderBy(
			_.filter(
				this.sessions,
				(session: Session) =>
					(!name || (session.name || '').toLowerCase().includes(name)) &&
					(!this.filterByStatus || session.status === this.filterByStatus)
			),
			this.sortBy,
			this.sortOrder
		) as Session[];
	}

	/** Loads v2 sessions and legacy v1 games, then restores the saved scroll position. */
	ngOnInit() {
		this.backService.getGames().subscribe((data) => {
			this.games = _.orderBy(data.games, 'created', 'desc');
			this.restoreScroll();
		});
		this.sessionService.getAll().subscribe((data) => {
			this.setSessions(_.orderBy(data, 'createdAt', 'desc'));
			this.restoreScroll();
		});
	}

	/** Tracks the scroll position outside Angular so scrolling does not trigger change detection. */
	ngAfterViewInit() {
		const element = this.scroller.nativeElement;
		this.ngZone.runOutsideAngular(() =>
			element.addEventListener('scroll', () => (this.scrollTop = element.scrollTop), { passive: true })
		);
	}

	/** Saves filters, sort, legacy panel and scroll position for the next visit. */
	ngOnDestroy() {
		const state: HistoryState = {
			filterByName: this.filterByName,
			filterByStatus: this.filterByStatus,
			sortBy: this.sortBy,
			sortOrder: this.sortOrder,
			legacyOpen: this.legacyOpen,
			scrollTop: this.scrollTop,
		};
		sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
	}

	/** Scrolls back to where the user left the page once the freshly loaded list has rendered. */
	private restoreScroll() {
		setTimeout(() => (this.scroller.nativeElement.scrollTop = this.savedState.scrollTop));
	}

	/** Stores the session list and recounts sessions per status. */
	private setSessions(sessions: Session[]) {
		this.sessions = sessions;
		this.statusCounts = _.countBy(sessions, 'status');
	}

	/** Identifies a session or legacy game by its id for ngFor. */
	trackById(_index: number, item: { _id: string }): string {
		return item._id;
	}

	/** Returns the display name of a theme, or its raw id when unknown. */
	getThemeName(theme: string): string {
		const themeName = this.themesService.getThemeName(theme);
		return themeName || theme;
	}

	/** Returns the translation key for a session status. */
	getStatus(status: string): string {
		switch (status) {
			case this.ENDED:
				return 'HISTORY.STATUS.ENDED';
			case this.OPEN:
				return 'HISTORY.STATUS.OPEN';
			case this.IN_PROGRESS:
				return 'HISTORY.STATUS.IN_PROGRESS';
			default:
				return '-';
		}
	}

	/** Returns the CSS class coloring a session status. */
	getStatusClass(status: string): string {
		switch (status) {
			case this.ENDED:
				return 'tone-ended';
			case this.OPEN:
				return 'tone-open';
			case this.IN_PROGRESS:
				return 'tone-playing';
			default:
				return '';
		}
	}

	/** Maps a legacy game status (open, start-game, start-round, stop-round, end-game) onto a v2 session status. */
	private legacyToSessionStatus(status: string): string {
		if (status === C.OPEN) return this.OPEN;
		if (status === C.END_GAME) return this.ENDED;
		return this.IN_PROGRESS;
	}

	/** Returns the translation key for a legacy game status. */
	getStatusLegacy(status: string): string {
		return this.getStatus(this.legacyToSessionStatus(status));
	}

	/** Returns the CSS class coloring a legacy game status. */
	getStatusClassLegacy(status: string): string {
		return this.getStatusClass(this.legacyToSessionStatus(status));
	}

	/** Asks for the delete password, then deletes a legacy game. */
	onDeleteGame(game: any) {
		const dialogRef = this.dialog.open(GameDeleteDialog, {});
		dialogRef.afterClosed().subscribe((dataRaw) => {
			if (dataRaw) {
				this.backService.deleteGame(game._id, dataRaw).subscribe(() => {
					this.snackbarService.showSuccess(this.i18nService.instant('HISTORY.DELETE_GAME'));
					this.games = _.filter(this.games, (g) => g._id !== game._id);
				});
			}
		});
	}

	/** Asks for the delete password, then deletes a session. */
	onDeleteSession(session: Session) {
		const dialogRef = this.dialog.open(GameDeleteDialog, {});
		dialogRef.afterClosed().subscribe((dataRaw) => {
			if (dataRaw) {
				this.sessionService.delete(session._id, dataRaw).subscribe(() => {
					this.snackbarService.showSuccess(this.i18nService.instant('HISTORY.DELETE_SESSION'));
					this.setSessions(_.filter(this.sessions, (s) => s._id !== session._id));
				});
			}
		});
	}
}

@Component({
	selector: 'game-delete-dialog',
	templateUrl: './game-delete-dialog.html',
})
export class GameDeleteDialog {
	value = '';

	constructor(public dialogRef: MatDialogRef<GameDeleteDialog>) {}
}
