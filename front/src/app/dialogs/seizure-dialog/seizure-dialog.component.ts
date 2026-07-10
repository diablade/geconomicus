import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Card, Credit } from '../../models/gameState';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CREDIT_STATUS } from '@geco/shared';
import * as _ from 'lodash-es';
import { faArrowTurnDown, faInfoCircle, faLandmark, faSackDollar } from '@fortawesome/free-solid-svg-icons';
import { getBackgroundStyle } from '../../services/avatarTools';
import { Avatar } from 'src/app/models/avatar';

@Component({
	selector: 'app-seizure-dialog',
	templateUrl: './seizure-dialog.component.html',
	styleUrls: ['./seizure-dialog.component.scss'],
})
export class SeizureDialogComponent {
	protected readonly getBackgroundStyle = getBackgroundStyle;
	credit: Credit | undefined;
	playerCards: Card[] = [];
	seizureCards: Card[] = [];
	seizureCoins = 0;
	playerCoins = 0;
	avatar: Avatar = new Avatar();
	faLandMark = faLandmark;
	faArrowTurnDown = faArrowTurnDown;
	faInfoCircle = faInfoCircle;
	faSackDollar = faSackDollar;
	prisonTime = 0;
	seizureType: string;
	seizureCost: number;
	seizureDecote: number;
	timerPrisonMax = 5;

	constructor(
		public dialogRef: MatDialogRef<SeizureDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any
	) {
		this.credit = data.credit;
		this.seizureType = data.seizureType;
		this.seizureCost = data.seizureCosts;
		this.seizureDecote = data.seizureDecote;
		this.timerPrisonMax = data.timerPrison ?? 5;
		// Use player state passed from bank-board (current snapshot)
		this.playerCards = data.playerCards ?? [];
		this.playerCoins = data.playerCoins ?? 0;
		this.avatar = data.avatar ?? new Avatar();
	}

	onDrop(event: CdkDragDrop<Card[]>) {
		if (event.container === event.previousContainer) {
			moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
		} else {
			transferArrayItem(
				event.previousContainer.data,
				event.container.data,
				event.previousIndex,
				event.currentIndex
			);
		}
	}

	seizeCoins() {
		this.seizureCoins = this.playerCoins;
	}

	getSeizure() {
		let seize = 0;
		_.forEach(this.seizureCards, (c) => {
			if (this.seizureType == CREDIT_STATUS.DECOTE) {
				seize += c.price - (c.price * this.seizureDecote) / 100;
			} else {
				seize += c.price;
			}
		});
		return seize;
	}

	getSeizureObjective() {
		if (this.credit) {
			if (this.seizureType === CREDIT_STATUS.DECOTE) {
				return this.credit.amount + this.credit.interest - this.seizureCoins;
			} else {
				return this.credit.amount + this.credit.interest - this.seizureCoins + this.seizureCost;
			}
		}
		return 1;
	}

	getProgressSeizure() {
		const progress = (this.getSeizure() / this.getSeizureObjective()) * 100;
		return progress > 100 ? 100 : progress;
	}

	cancel() {
		this.dialogRef.close();
	}

	validate() {
		this.dialogRef.close({
			cards: this.seizureCards,
			coins: this.seizureCoins,
			prisonTime: this.prisonTime,
		});
	}

	getMinTimerPrison() {
		if (this.playerCards.length == 0 && this.prisonTime == 0) {
			this.prisonTime = 1;
		} else if (this.playerCards.length > 0 && this.prisonTime > 0) {
			this.prisonTime = 0;
		}
		return this.playerCards.length > 0 ? 0 : 1;
	}
}
