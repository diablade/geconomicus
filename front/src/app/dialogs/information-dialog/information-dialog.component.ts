import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {I18nService} from '../../services/i18n.service';
import {AudioService} from '../../services/audio.service';

@Component({
	selector: 'app-information-dialog',
	templateUrl: './information-dialog.component.html',
	styleUrls: ['./information-dialog.component.scss']
})

export class InformationDialogComponent {
	text = "";
	title = "";
	labelBtn = "";
	timerBtn = 5;
	disableClose = false;

	constructor(public dialogRef: MatDialogRef<InformationDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any, private i18nService: I18nService, private audioService: AudioService) {
		this.text = data.text;
		this.title = data.title ? data.title : this.i18nService.instant("DIALOG.INFORMATION.TITLE");
		this.labelBtn = data.labelBtn ? data.labelBtn : this.i18nService.instant("DIALOG.INFORMATION.BTN1");
		this.disableClose = data.disableClose == undefined ? false : data.disableClose;
		this.timerBtn = data.timerBtn ? data.timerBtn : 5;
		if (data.sound) {
			this.audioService.playSound(data.sound);
		}
	}

	back(): void {
		if (!this.disableClose) {
			this.dialogRef.close();
		}
	}
}
