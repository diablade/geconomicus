import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {AudioService} from '../../services/audio.service';

@Component({
	selector: 'app-confirm-dialog',
	templateUrl: './confirm-dialog.component.html',
	styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
	title = "DIALOG.CONFIRM.TITLE" ;
	message = "DIALOG.CONFIRM.MESSAGE";
	labelBtn1 = "DIALOG.CONFIRM.BTN1";
	labelBtn2 = "DIALOG.CONFIRM.BTN2";
	autoClickBtn2 = false;
	timerBtn2 = 5;
	btn1Enable= true;

	constructor(public dialogRef: MatDialogRef<ConfirmDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any, private audioService: AudioService) {
		this.title = data.title ? data.title : this.title;
		this.message = data.message;
		this.labelBtn1 = data.labelBtn1 ? data.labelBtn1: this.labelBtn1;
		this.labelBtn2 = data.labelBtn2 ? data.labelBtn2: this.labelBtn2;
		this.autoClickBtn2 = data.autoClickBtn2;
		this.timerBtn2 = data.timerBtn2;
		this.btn1Enable = data.btn1Enable == undefined ? true : data.btn1Enable;
		if (data.beep) {
			this.audioService.playSound("request");
		}
	}

	timerEnd() {
		this.dialogRef.close("btn2");
	}
}
