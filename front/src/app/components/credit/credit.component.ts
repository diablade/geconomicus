import { Component, EventEmitter, Input, Output } from '@angular/core';
import { faCircleInfo, faCommentsDollar, faSackDollar } from '@fortawesome/free-solid-svg-icons';
import { Credit } from '../../models/gameState';
import { CREDIT_STATUS } from '@geco/shared';
import { Avatar } from 'src/app/models/avatar';

@Component({
	selector: 'app-credit',
	templateUrl: './credit.component.html',
	styleUrls: ['./credit.component.scss'],
})
export class CreditComponent {
	protected readonly CREDIT_DONE = CREDIT_STATUS.DONE;
	protected readonly CREDIT_PAUSED = CREDIT_STATUS.PAUSED;
	protected readonly DEFAULT_CREDIT = CREDIT_STATUS.FAULT;
	protected readonly REQUEST_CREDIT = CREDIT_STATUS.REQUESTING;
	protected readonly RUNNING_CREDIT = CREDIT_STATUS.RUNNING;
	protected readonly CREDIT_CANCELED = CREDIT_STATUS.CANCELED;
	faSackDollar = faSackDollar;
	faCommentsDollar = faCommentsDollar;
	faCircleInfo = faCircleInfo;

	@Input() credit!: Credit;
	@Input() contractor: Avatar | undefined = new Avatar();

	@Input() interestMinutes: number | undefined;
	@Input() bankOption = false;
	@Output() actionBtn = new EventEmitter<string>();
	@Input() small = false;

	actionBtnClick(action: string) {
		this.actionBtn.emit(action);
	}

	getStatus(status: string) {
		switch (status) {
			case this.CREDIT_PAUSED:
				return 'CREDIT.PAUSED_CREDIT';
			case this.CREDIT_CANCELED:
				return 'CREDIT.CANCELED';
			case this.RUNNING_CREDIT:
				return 'CREDIT.RUNNING_CREDIT';
			case this.REQUEST_CREDIT:
				return 'CREDIT.REQUEST_CREDIT';
			case this.DEFAULT_CREDIT:
				return 'CREDIT.DEFAULT_CREDIT';
			case this.CREDIT_DONE:
				return 'CREDIT.CREDIT_DONE';
			default:
				return 'error';
		}
	}

	getStatusColor(progress: number) {
		if (progress < 50) {
			return '#28a745';
		} else if (progress < 75) {
			return '#ffc107';
		} else {
			return '#dc3545';
		}
	}
}
