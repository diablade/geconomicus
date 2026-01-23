import { Component, Inject } from '@angular/core';
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { I18nService } from "../../services/i18n.service";

@Component({
	selector: 'app-join-short-dialog',
	templateUrl: './join-short-dialog.component.html',
	styleUrls: ['./join-short-dialog.component.scss']
})
export class JoinShortDialogComponent {
	shortId = "";
	faXmark = faXmark;

	constructor(public dialogRef: MatDialogRef<JoinShortDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any, private i18n: I18nService) {
		this.i18n.loadNamespace('join');
	}

	join() {
		this.dialogRef.close(this.shortId);
	}
}
