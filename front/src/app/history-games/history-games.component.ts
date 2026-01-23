import {Component, OnInit} from '@angular/core';
import {DeprecatedBackService} from "../services/deprecated-back.service";
import C from "../../../../back/shared/constantes.mjs";
import * as _ from 'lodash-es';
import {faTrashCan, faArrowUpWideShort, faArrowDownShortWide} from "@fortawesome/free-solid-svg-icons";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {SnackbarService} from "../services/snackbar.service";
import {I18nService} from '../services/i18n.service';
import {SessionService} from '../services/api/session.service';
import {Session} from '../models/session';

@Component({
	selector: 'app-history-games',
	templateUrl: './history-games.component.html',
	styleUrls: ['./history-games.component.scss']
})
export class HistoryGamesComponent implements OnInit {
	faTrashCan = faTrashCan;
	faArrowUpWideShort = faArrowUpWideShort;
	faArrowDownShortWide = faArrowDownShortWide;
	deleteGames = false;
	games: any;
	sessions: Session[] = [];
	C = C;
	filterByName = "";
	filterByStatus = "";
	sortBy = "createdAt";
	sortOrder: "asc" | "desc" = "desc";

	constructor(private backService: DeprecatedBackService,
	            public dialog: MatDialog,
	            private snackbarService: SnackbarService,
	            private i18nService: I18nService,
	            private sessionService: SessionService) {
		this.i18nService.loadNamespace("history");
	}

	get filteredSessions(): Session[] {
		return _.orderBy(_.filter(this.sessions, (session: any) =>
			(!this.filterByName || session.name.includes(this.filterByName)) &&
			(!this.filterByStatus || session.status === this.filterByStatus)
		), this.sortBy, this.sortOrder) as Session[];
	}

	ngOnInit() {
		this.backService.getGames().subscribe(async data => {
			this.games = _.orderBy(data.games, "created", "desc");
		});
		this.sessionService.getAll().subscribe(async data => {
			this.sessions = data;
			this.sessions = _.orderBy(data, "createdAt", "desc");
		});
	}

	getStatus(status: string): string {
		switch (status) {
			case C.END_GAME:
				return "HISTORY.STATUS.ENDED";
			case C.OPEN:
				return "HISTORY.STATUS.OPEN";
			case C.IN_PROGRESS:
				return "HISTORY.STATUS.IN_PROGRESS";
			default:
				return "-";
		}
	}

	getStatusClass(status: string): string {
		switch (status) {
			case C.END_GAME:
				return "statusClosed";
			case C.OPEN:
				return "statusOpen";
			case C.IN_PROGRESS:
				return "statusOnGoing";
			default:
				return "";
		}
	}

	onDeleteGame(game: any) {
		const dialogRef = this.dialog.open(GameDeleteDialog, {});
		dialogRef.afterClosed().subscribe(dataRaw => {
			if (dataRaw) {
				this.backService.deleteGame(game._id, dataRaw).subscribe(async data => {
					this.snackbarService.showSuccess(this.i18nService.instant("HISTORY.DELETE_GAME"));
					this.games = _.filter(this.games, g => g._id !== game._id);
				});
			}
		});
	}

	onDeleteSession(session: Session) {
		const dialogRef = this.dialog.open(GameDeleteDialog, {});
		dialogRef.afterClosed().subscribe(dataRaw => {
			if (dataRaw) {
				this.sessionService.delete(session._id, dataRaw).subscribe(async _data => {
					this.snackbarService.showSuccess(this.i18nService.instant("HISTORY.DELETE_SESSION"));
					this.sessions = _.filter(this.sessions, s => s._id !== session._id);
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
	value = "";

	constructor(public dialogRef: MatDialogRef<GameDeleteDialog>) {
	}
}
