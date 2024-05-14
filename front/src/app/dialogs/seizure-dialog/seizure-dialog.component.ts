import {Component, ElementRef, Inject, OnInit, ViewChild} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {Card, Credit, Player} from "../../models/game";
import {CdkDragDrop, moveItemInArray, transferArrayItem} from "@angular/cdk/drag-drop";
// @ts-ignore
import * as C from "../../../../../config/constantes";
import {BackService} from "../../services/back.service";
import * as _ from 'lodash-es';
import {faArrowTurnDown, faInfoCircle, faLandmark, faSackDollar} from "@fortawesome/free-solid-svg-icons";

@Component({
	selector: 'app-seizure-dialog',
	templateUrl: './seizure-dialog.component.html',
	styleUrls: ['./seizure-dialog.component.scss']
})
export class SeizureDialogComponent implements OnInit {
	credit: Credit | undefined;
	player: Player = new Player();
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	C = C;
	playerCards: Card[] = [];
	seizureCards: Card[] = [];
	seizureCoins: number = 0;
	faLandMark = faLandmark;
	faArrowTurnDown = faArrowTurnDown;
	faInfoCircle = faInfoCircle;
	faSackDollar = faSackDollar;
	prisonTime: number = 0;
	seizureType: string;
	seizureCost: number;
	seizureDecote: number;
	timerPrisonMax: number = 5;

	constructor(private backService: BackService, public dialogRef: MatDialogRef<SeizureDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
		this.credit = data.credit;
		this.seizureType = data.seizureType;
		this.seizureCost = data.seizureCosts;
		this.seizureDecote = data.seizureDecote;
	}

	ngOnInit(): void {
		this.backService.getPlayer(this.credit?.idGame, this.credit?.idPlayer).subscribe(async data => {
			this.player = data.player;
			this.playerCards = data.player.cards;
			// @ts-ignore
			this.svgContainer.nativeElement.innerHTML = this.player.image;
		});
	}

	onDrop(event: CdkDragDrop<Card []>) {
		if (event.container === event.previousContainer) {
			moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
		} else {
			transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex)
		}
	}

	getBackgroundStyle(bank: string) {
		if (bank) {
			return {"background-color": "#ffd89b"};
		} else {
			switch (this.player?.boardConf) {
				case "green":
					return {"background-image": "url('/assets/images/green-carpet.jpg')"};
				case "custom":
					return {"background-color": "" + this.player.boardColor};
				case "wood":
				default:
					return {"background-image": "url('/assets/images/woodJapAlt.jpg')"};
			}
		}
	}

	seizeCoins() {
		this.seizureCoins = this.player.coins;
		this.player.coins = 0;
	}

	getSeizure() {
		let seize = 0;
		_.forEach(this.seizureCards, c => {
			if (this.seizureType == "decote") {
				seize += (c.price - (this.seizureDecote / 100));
			} else {
				seize += c.price;
			}
		});
		return seize;
	}

	getSeizureObjective() {
		// @ts-ignore
		if (this.seizureType == "decote") {
			// @ts-ignore
			return this.credit?.amount + this.credit?.interest - this.seizureCoins;
		} else {
			// @ts-ignore
			return this.credit?.amount + this.credit?.interest - this.seizureCoins + this.seizureCost;

		}
	}

	getProgressSeizure() {
		const progress = this.getSeizure() / this.getSeizureObjective() * 100;
		return progress > 100 ? 100 : progress;
	}

	cancel() {
		this.dialogRef.close();
	}

	validate() {
		this.dialogRef.close({
			cards: this.seizureCards,
			coins: this.seizureCoins,
			prisonTime: this.prisonTime
		})
	}

	getMinTimerPrison() {
		if(this.playerCards.length==0 && this.prisonTime==0){
			this.prisonTime=1;
		}else if(this.playerCards.length>0 && this.prisonTime>0){
			this.prisonTime=0;
		}
		return this.playerCards.length>0 ? 0 : 1;
	}
}
