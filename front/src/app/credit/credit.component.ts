import {Component, EventEmitter, Input, Output} from '@angular/core';
import {faCircleInfo, faCommentsDollar, faSackDollar} from "@fortawesome/free-solid-svg-icons";
import {Credit} from "../models/game";

// @ts-ignore
import * as C from "../../../../config/constantes";

@Component({
	selector: 'app-credit',
	templateUrl: './credit.component.html',
	styleUrls: ['./credit.component.scss']
})
export class CreditComponent {
	faSackDollar = faSackDollar;
	faCommentsDollar = faCommentsDollar;
	faCircleInfo = faCircleInfo;


	@Input() credit!: Credit;
	@Input() contractor!: string | undefined;
	@Input() interestMinutes = 5;
	@Input() bankOption = false;
	@Output() actionBtn = new EventEmitter<string>();
	@Input() small = false;

	C = C;

	constructor() {
	}

	actionBtnClick(action: string) {
		this.actionBtn.emit(action);
	}

	getStatus(status: string) {
		switch (status) {
			case C.PAUSED_CREDIT :
				return "CREDIT.PAUSED_CREDIT";
			case C.RUNNING_CREDIT:
				return "CREDIT.RUNNING_CREDIT";
			case C.REQUEST_CREDIT:
				return "CREDIT.REQUEST_CREDIT";
			case C.DEFAULT_CREDIT:
				return "CREDIT.DEFAULT_CREDIT";
			case C.CREDIT_DONE:
				return "CREDIT.CREDIT_DONE";
			default :
				return "error";
		}
	}
}
