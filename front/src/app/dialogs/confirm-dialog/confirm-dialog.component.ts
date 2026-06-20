import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {AudioService} from '../../services/audio.service';

@Component({
	selector: 'app-confirm-dialog',
	templateUrl: './confirm-dialog.component.html',
	styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
	title = "DIALOG.CONFIRM.TITLE";
	message = "DIALOG.CONFIRM.MESSAGE";
	message2 = "";
	labelBtnCancel = "DIALOG.CANCEL";
	labelBtnConfirm = "DIALOG.YES";
	autoClickBtnConfirm = false;
	timerBtnConfirm = 5;
	btn1Enable = true;
	styleBtnConfirm = "warn";
	styleBtnCancel = "accent";

	constructor(public dialogRef: MatDialogRef<ConfirmDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any, private audioService: AudioService) {
		this.title = data.title || this.title;
		this.message = data.message || this.message;
		this.message2 = data.message2 || this.message2;
		this.labelBtnCancel = data.labelBtnCancel || this.labelBtnCancel;
		this.labelBtnConfirm = data.labelBtnConfirm || this.labelBtnConfirm;
		this.autoClickBtnConfirm = data.autoClickBtnConfirm;
		this.timerBtnConfirm = data.timerBtnConfirm;
		this.btn1Enable = data.btn1Enable == undefined ? true : data.btn1Enable;
		this.styleBtnConfirm = data.styleBtnConfirm || this.styleBtnConfirm;
		this.styleBtnCancel = data.styleBtnCancel || this.styleBtnCancel;
		if (data.requestBeep) {
			this.audioService.playSound("request");
		}
	}

	timerEnd() {
		this.dialogRef.close("btnConfirm");
	}
}
