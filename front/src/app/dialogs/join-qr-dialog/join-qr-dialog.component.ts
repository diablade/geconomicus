import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
	selector: 'app-join-qr-dialog',
	templateUrl: './join-qr-dialog.component.html',
	styleUrls: ['./join-qr-dialog.component.scss']
})
export class JoinQrDialogComponent {
	constructor(public dialogRef: MatDialogRef<JoinQrDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
	}

	back(): void {
		this.dialogRef.close();
	}
}
