import {Component, Inject} from '@angular/core';
import {faXmark} from "@fortawesome/free-solid-svg-icons";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
	selector: 'app-join-short-dialog',
	templateUrl: './join-short-dialog.component.html',
	styleUrls: ['./join-short-dialog.component.scss']
})
export class JoinShortDialogComponent {
	shortId = "";
	faXmark = faXmark;

	constructor(public dialogRef: MatDialogRef<JoinShortDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
	}

	join() {
		this.dialogRef.close(this.shortId);
	}
}
