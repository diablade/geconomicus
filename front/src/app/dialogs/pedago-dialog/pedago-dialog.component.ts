import {Component} from '@angular/core';
import {faArrowUpRightFromSquare} from "@fortawesome/free-solid-svg-icons";
import {Router} from "@angular/router";
import {MatDialogRef} from "@angular/material/dialog";

@Component({
	selector: 'app-pedago-dialog',
	templateUrl: './pedago-dialog.component.html',
	styleUrls: ['./pedago-dialog.component.scss']
})
export class PedagoDialogComponent {
	faArrowUpRightFromSquare = faArrowUpRightFromSquare;

	constructor(private router: Router,public dialogRef: MatDialogRef<PedagoDialogComponent> ) {
	}

	openGalileo() {
		this.router.navigate(['module/galileo']);
		this.dialogRef.close();
	}

	openWealth() {
		this.router.navigate(['module/wealth']);
		this.dialogRef.close();
	}
}
