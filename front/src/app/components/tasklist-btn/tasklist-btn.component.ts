import {Component, Inject, Input} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {faListAlt} from "@fortawesome/free-solid-svg-icons";
import {SessionStorageService} from 'src/app/services/local-storage/session-storage.service';
import {I18nService} from "../../services/i18n.service";

@Component({
	selector: 'app-tasklist-btn',
	templateUrl: './tasklist-btn.component.html',
	styleUrls: ['./tasklist-btn.component.scss']
})
export class TaskListBtnComponent {
	protected readonly faListAlt = faListAlt;
	@Input() labelBtn = "TASK.MASTER_TASK";
	@Input() icon = true;
	@Input() stroked = false;

	presentYourself = false;
	presentML = false;
	prepare = false;
	delay = false;
	squares = false;
	transactions = false;
	death = false;
	start1 = false;
	survey1 = false;
	nextMoney = false;
	start2 = false;
	survey2 = false;
	results = false;

	constructor(public dialog: MatDialog, private SessionStorageService: SessionStorageService) {
		this.presentYourself = this.SessionStorageService.getItem("pY") || false;
		this.presentML = this.SessionStorageService.getItem("pML") || false;
		this.prepare = this.SessionStorageService.getItem("pP") || false;
		this.delay = this.SessionStorageService.getItem("D") || false;
		this.squares = this.SessionStorageService.getItem("S") || false;
		this.transactions = this.SessionStorageService.getItem("T") || false;
		this.death = this.SessionStorageService.getItem("Dh") || false;
		this.start1 = this.SessionStorageService.getItem("S1") || false;
		this.survey1 = this.SessionStorageService.getItem("s1") || false;
		this.nextMoney = this.SessionStorageService.getItem("nM") || false;
		this.start2 = this.SessionStorageService.getItem("S2") || false;
		this.survey2 = this.SessionStorageService.getItem("s2") || false;
		this.results = this.SessionStorageService.getItem("R") || false;
	}

	showTaskList() {
		this.dialog.open(AnimatorTaskListDialog, {
			data: {
				presentYourself: this.presentYourself,
				presentML: this.presentML,
				prepare: this.prepare,
				delay: this.delay,
				squares: this.squares,
				transactions: this.transactions,
				death: this.death,
				start1: this.start1,
				survey1: this.survey1,
				nextMoney: this.nextMoney,
				start2: this.start2,
				survey2: this.survey2,
				results: this.results
			}
		}).afterClosed().subscribe(result => {
			if (result) {
				this.presentYourself = result.presentYourself;
				this.presentML = result.presentML;
				this.prepare = result.prepare;
				this.delay = result.delay;
				this.squares = result.squares;
				this.transactions = result.transactions;
				this.death = result.death;
				this.start1 = result.start1;
				this.survey1 = result.survey1;
				this.nextMoney = result.nextMoney;
				this.start2 = result.start2;
				this.survey2 = result.survey2;
				this.results = result.results;
				this.SessionStorageService.setItem("pY", this.presentYourself);
				this.SessionStorageService.setItem("pML", this.presentML);
				this.SessionStorageService.setItem("pP", this.prepare);
				this.SessionStorageService.setItem("D", this.delay);
				this.SessionStorageService.setItem("S", this.squares);
				this.SessionStorageService.setItem("T", this.transactions);
				this.SessionStorageService.setItem("Dh", this.death);
				this.SessionStorageService.setItem("S1", this.start1);
				this.SessionStorageService.setItem("s1", this.survey1);
				this.SessionStorageService.setItem("nM", this.nextMoney);
				this.SessionStorageService.setItem("S2", this.start2);
				this.SessionStorageService.setItem("s2", this.survey2);
				this.SessionStorageService.setItem("R", this.results);
			}
		});
	}
}

@Component({
	selector: 'animator-tasklist-dialog',
	templateUrl: '../../dialogs/animator-tasklist-dialog.html',
})
export class AnimatorTaskListDialog {
	data: any;

	constructor(public dialogRef: MatDialogRef<AnimatorTaskListDialog>, @Inject(MAT_DIALOG_DATA) data: any) {
		this.data = data;
	}

	close() {
		this.dialogRef.close();
	}

	clean() {
		this.data = {
			presentYourself: false,
			presentML: false,
			prepare: false,
			delay: false,
			squares: false,
			transactions: false,
			death: false,
			start1: false,
			survey1: false,
			nextMoney: false,
			start2: false,
			survey2: false,
			results: false
		}
	}

	save() {
		this.dialogRef.close(this.data);
	}
}

