import {Component, EventEmitter, Input, Output} from '@angular/core';
import {faCircleInfo, faCommentsDollar, faSackDollar} from "@fortawesome/free-solid-svg-icons";
import {Credit} from "../../models/game";

// @ts-ignore
import { CREDIT_STATUS } from '@geco/shared';
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";

@Component({
	selector: 'app-credit',
	templateUrl: './credit.component.html',
	styleUrls: ['./credit.component.scss']
})
export class CreditComponent {
    protected readonly CREDIT_DONE = CREDIT_STATUS.DONE;
    protected readonly CREDIT_PAUSED = CREDIT_STATUS.PAUSED;
    protected readonly DEFAULT_CREDIT = CREDIT_STATUS.DEFAULT;
    protected readonly REQUEST_CREDIT = CREDIT_STATUS.REQUESTING;
    protected readonly RUNNING_CREDIT = CREDIT_STATUS.RUNNING;
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
			case this.CREDIT_PAUSED :
				return "CREDIT.PAUSED_CREDIT";
			case this.RUNNING_CREDIT:
				return "CREDIT.RUNNING_CREDIT";
			case this.REQUEST_CREDIT:
				return "CREDIT.REQUEST_CREDIT";
			case this.DEFAULT_CREDIT:
				return "CREDIT.DEFAULT_CREDIT";
			case this.CREDIT_DONE:
				return "CREDIT.CREDIT_DONE";
			default :
				return "error";
		}
	}

	getStatusColor(progress: number) {
		if (progress < 50) {
			return "#28a745";
		} else if (progress < 75) {
			return "#ffc107";
		} else {
			return "#dc3545";
		}
	}
}
