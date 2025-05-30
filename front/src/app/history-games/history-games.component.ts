import {Component, OnInit} from '@angular/core';
import {BackService} from "../services/back.service";
// @ts-ignore
import * as C from "../../../../config/constantes";
import * as _ from 'lodash-es';
import {faTrashCan} from "@fortawesome/free-solid-svg-icons";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {SnackbarService} from "../services/snackbar.service";
import { I18nService } from '../services/i18n.service';

@Component({
	selector: 'app-history-games',
	templateUrl: './history-games.component.html',
	styleUrls: ['./history-games.component.scss']
})
export class HistoryGamesComponent implements OnInit {
	faTrashCan = faTrashCan;
	deleteGames = false;
	games: any;
	C = C;

	constructor(private backService: BackService, public dialog: MatDialog, private snackbarService: SnackbarService, private i18nService: I18nService) {
	}

	ngOnInit(): void {
		this.backService.getGames().subscribe(async data => {
			this.games = _.sortBy(data.games, "created");
		});
	}

	getStatus(status: string): string {
		switch (status) {
			case C.END_GAME:
				return this.i18nService.instant("HISTORY.STATUS.ENDED");
			case C.OPEN:
				return this.i18nService.instant("HISTORY.STATUS.OPEN");
			default:
				return this.i18nService.instant("HISTORY.STATUS.IN_PROGRESS");
		}
	}

	getStatusClass(status: string): string {
		switch (status) {
			case C.END_GAME:
				return "statusClosed";
			case C.OPEN:
				return "statusOpen";
			default :
				return "statusOnGoing";
		}
	}

	onDeleteGame(game: any) {
		const dialogRef = this.dialog.open(GameDeleteDialog, {});
		dialogRef.afterClosed().subscribe(dataRaw => {
			if (dataRaw) {
				this.backService.deleteGame(game._id, dataRaw).subscribe(async data => {
					this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.DELETE_GAME"));
					this.games = _.filter(this.games, g => g._id !== game._id);
				});
			}
		});
	}
}

@Component({
	selector: 'game-delete-dialog',
	templateUrl: '../dialogs/game-delete-dialog.html',
})
export class GameDeleteDialog {
	value = "";

	constructor(public dialogRef: MatDialogRef<GameDeleteDialog>) {
	}
}
