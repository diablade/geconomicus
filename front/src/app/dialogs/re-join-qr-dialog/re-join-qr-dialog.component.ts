import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
	selector: 'app-rejoin-qr-dialog',
	templateUrl: './re-join-qr-dialog.component.html',
	styleUrls: ['./re-join-qr-dialog.component.scss']
})
export class ReJoinQrDialogComponent {
	constructor(public dialogRef: MatDialogRef<ReJoinQrDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
	}

	back(): void {
		this.dialogRef.close();
	}
}
