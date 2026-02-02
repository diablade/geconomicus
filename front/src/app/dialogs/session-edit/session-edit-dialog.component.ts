import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
// @ts-ignore
import { C } from "../../../../../back/shared/constantes.mjs";
import { ThemesService } from '../../services/themes.service';
import { Session } from "../../models/session";

@Component({
	selector: 'session-edit-dialog',
	templateUrl: './session-edit-dialog.component.html',
	styleUrls: ['./session-edit-dialog.component.scss']
})
export class SessionEditDialogComponent {
	session: Session;
	themes: string[];
	C = C;
	Math = Math;

	constructor(
		private themesService: ThemesService,
		public dialogRef: MatDialogRef<SessionEditDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any
	) {
		this.session = data.session;
		this.themes = this.themesService.getThemesKeys();
	}
}
