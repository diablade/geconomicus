import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
	selector: 'app-confirm-dialog',
	templateUrl: './confirm-dialog.component.html',
	styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
	title = "Confirmer ?";
	message = "Etes vous sur ?";
	labelBtn1 = "Oui";
	labelBtn2 = "Annuler";
	autoClickBtn2 = false;
	timerBtn2 = 5;
	audio = new Audio();
	btn1Enable= true;

	constructor(public dialogRef: MatDialogRef<ConfirmDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
		this.title = data.title ? data.title : this.title;
		this.message = data.message;
		this.labelBtn1 = data.labelBtn1;
		this.labelBtn2 = data.labelBtn2;
		this.autoClickBtn2 = data.autoClickBtn2;
		this.timerBtn2 = data.timerBtn2;
		this.btn1Enable = data.btn1Enable == undefined ? true : data.btn1Enable;
		if (data.beep) {
			this.audio.src = "./../../../assets/audios/request.mp3";
			this.audio.load();
			this.audio.play();
		}
	}

	timerEnd() {
		this.dialogRef.close("btn2");
	}
}
