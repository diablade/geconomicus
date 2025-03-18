import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import { I18nService } from '../../services/i18n.service';
@Component({
	selector: 'app-information-dialog',
	templateUrl: './information-dialog.component.html',
	styleUrls: ['./information-dialog.component.scss']
})

export class InformationDialogComponent {
	text = "";
	title = "";
	disableClose = false;

	constructor(public dialogRef: MatDialogRef<InformationDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any, private i18nService: I18nService) {
		this.text = data.text;
		this.title = data.title ? data.title : this.i18nService.instant("DIALOG.INFORMATION.TITLE");
		this.disableClose = data.disableClose == undefined ? false : data.disableClose;
		if (data.sound) {
			let audio = new Audio();
			audio.src = data.sound;
			audio.load();
			audio.play();
		}
	}

	back(): void {
		if (!this.disableClose) {
			this.dialogRef.close();
		}
	}
}
