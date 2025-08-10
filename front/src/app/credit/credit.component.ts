import {Component, EventEmitter, Input, Output} from '@angular/core';
import {faCircleInfo, faCommentsDollar, faSackDollar} from "@fortawesome/free-solid-svg-icons";
import {Credit} from "../models/game";

// @ts-ignore
import * as C from "../../../../config/constantes";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";

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
	@Input() contractorSvg!: string | "";
	@Input() contractorColor!: string | "black";

	@Input() interestMinutes = 5;
	@Input() bankOption = false;
	@Output() actionBtn = new EventEmitter<string>();
	@Input() small = false;

	C = C;

	constructor(private sanitizer: DomSanitizer) {
	}

	actionBtnClick(action: string) {
		this.actionBtn.emit(action);
	}

	getSanitizedSvgFromString(svgString: string): SafeHtml {
		return this.sanitizer.bypassSecurityTrustHtml(svgString);
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

	getStatusColor(progress: number) {
		console.log(progress)
		if (progress < 50) {
			return "#28a745";
		} else if (progress < 75) {
			return "#ffc107";
		} else {
			return "#dc3545";
		}
	}
}
