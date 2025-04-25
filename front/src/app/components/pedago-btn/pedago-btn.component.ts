import {Component} from '@angular/core';
import {MatDialog} from "@angular/material/dialog";
import {faInfoCircle} from "@fortawesome/free-solid-svg-icons";
import {PedagoDialogComponent} from "../../dialogs/pedago-dialog/pedago-dialog.component";

@Component({
	selector: 'pedago-btn',
	templateUrl: './pedago-btn.component.html',
	styleUrls: ['./pedago-btn.component.scss']
})
export class PedagoBtnComponent {
	protected readonly faInfoCircle = faInfoCircle;
	constructor(public dialog: MatDialog) {
	}
	show() {
		this.dialog.open(PedagoDialogComponent, {});
	}
}
