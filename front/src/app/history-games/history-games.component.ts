import { Component, OnInit } from '@angular/core';
import { BackService } from "../services/back.service";
// @ts-ignore
import * as C from "../../../../config/constantes";
import * as _ from 'lodash-es';
import { faTrashCan, faArrowUpWideShort, faArrowDownShortWide } from "@fortawesome/free-solid-svg-icons";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { SnackbarService } from "../services/snackbar.service";
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
	gameName = "";
	gameType = "";
	gameStatus = "";
	gameSort = "created";
	gameSortOrder: "asc" | "desc" = "desc";

	faArrowUpWideShort = faArrowUpWideShort;
	faArrowDownShortWide = faArrowDownShortWide;
	constructor(private backService: BackService, public dialog: MatDialog, private snackbarService: SnackbarService, private i18nService: I18nService) {
	}


	ngOnInit(): void {
		this.backService.getGames().subscribe(async data => {
			this.games = _.orderBy(data.games, "created", "desc");
		});
	}

	get filteredGames() {
		let games= _.filter(this.games, (game: any) =>
			(!this.gameName || game.name.includes(this.gameName)) &&
			(!this.gameType || game.typeMoney === this.gameType) &&
			(!this.gameStatus || game.status === this.gameStatus)
		);
		console.log(games);
		console.log(this.gameSort);
		console.log(this.gameSortOrder);
		console.log(this.gameStatus);
		console.log(this.gameType);
		console.log(this.gameName);
		games = _.orderBy(games, this.gameSort, this.gameSortOrder);
		return games;
	}
	getStatus(status: string): string {
		switch (status) {
			case C.END_GAME:
				return "HISTORY.STATUS.ENDED";
			case C.OPEN:
				return "HISTORY.STATUS.OPEN";
			case C.START_GAME:
				return "HISTORY.STATUS.START_GAME";
			case C.STOP_ROUND:
				return "HISTORY.STATUS.STOP_ROUND";
			default:
				return "HISTORY.STATUS.IN_PROGRESS";
		}
	}

	getStatusClass(status: string): string {
		switch (status) {
			case C.END_GAME:
				return "statusClosed";
			case C.OPEN:
				return "statusOpen";
			default:
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
