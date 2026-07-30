import {Component} from '@angular/core';
import {faArrowUpRightFromSquare} from "@fortawesome/free-solid-svg-icons";
import {Router} from "@angular/router";
import {MatDialogRef} from "@angular/material/dialog";
import {I18nService} from "../../services/i18n.service";

@Component({
	selector: 'app-pedago-dialog',
	templateUrl: './pedago-dialog.component.html',
	styleUrls: ['./pedago-dialog.component.scss']
})
export class PedagoDialogComponent {
	faArrowUpRightFromSquare = faArrowUpRightFromSquare;

	constructor(private router: Router,public dialogRef: MatDialogRef<PedagoDialogComponent>, private i18n: I18nService ) {
		this.i18n.loadNamespace('module-galileo');
		this.i18n.loadNamespace('module-wealth-distrib');
		this.i18n.loadNamespace('module-fiscalite');
	}

	openGalileo() {
		this.router.navigate(['module/galileo']);
		this.dialogRef.close();
	}

	openWealth() {
		this.router.navigate(['module/gini']);
		this.dialogRef.close();
	}

	openFiscalite() {
		this.router.navigate(['module/fiscalite']);
		this.dialogRef.close();
	}
}
