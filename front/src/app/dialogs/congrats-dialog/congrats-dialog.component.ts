import {AfterViewInit, Component, Inject, Input} from '@angular/core';
import {Card} from "../../models/game";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {AudioService} from "../../services/audio.service";
import {ThemesService} from "../../services/themes.service";

@Component({
	selector: 'app-congrats-dialog',
	templateUrl: './congrats-dialog.component.html',
	styleUrls: ['./congrats-dialog.component.scss']
})
export class CongratsDialogComponent implements AfterViewInit {
	card!: Card;
	text!: string;
	typeTheme = "";

	constructor(public dialogRef: MatDialogRef<CongratsDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any, private audioService: AudioService, private themesService: ThemesService) {
		this.text = data.text;
		this.card = data.card;
		this.typeTheme = this.themesService.getTypeTheme();
	}

	ngAfterViewInit(): void {
		this.audioService.playSound("gotitem");
	}

	close() {
		this.dialogRef.close();
	}
}
