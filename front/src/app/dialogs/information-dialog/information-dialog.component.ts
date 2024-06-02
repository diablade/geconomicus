import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
	selector: 'app-information-dialog',
	templateUrl: './information-dialog.component.html',
	styleUrls: ['./information-dialog.component.scss']
})

export class InformationDialogComponent {
	text = "";

	constructor(public dialogRef: MatDialogRef<InformationDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
		this.text = data.text;
		if (data.sound) {
			let audio = new Audio();
			audio.src = data.sound;
			audio.load();
			audio.play();
		}
	}

	back(): void {
		this.dialogRef.close();
	}
}
