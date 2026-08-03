import { Component, OnInit } from '@angular/core';
import { SurveyService } from '../services/api/survey.service';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { I18nService } from '../services/i18n.service';
import { Feedback } from '../models/feedback';
import { InformationDialogComponent } from '../dialogs/information-dialog/information-dialog.component';

@Component({
	selector: 'app-survey',
	templateUrl: './survey.component.html',
	styleUrls: ['./survey.component.scss'],
})
export class SurveyComponent implements OnInit {
	sessionId = '';
	avatarIdx = '';
	gameStateId = '';
	private subscription: Subscription | undefined;
	feedback: Feedback = new Feedback();

	constructor(
		private route: ActivatedRoute,
		private i18nService: I18nService,
		private router: Router,
		private surveyService: SurveyService,
		private dialog: MatDialog
	) {
		this.i18nService.loadNamespace('survey');
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.avatarIdx = params['avatarIdx'];
			this.gameStateId = params['gameStateId'];
			const edit = params['edit'];
			if (edit === 'edit') {
				this.loadExistingFeedback();
			}
		});
	}

	loadExistingFeedback() {
		this.surveyService
			.getPreviousFeedback(this.sessionId, this.gameStateId, this.avatarIdx)
			.subscribe((feedback) => {
				this.feedback = feedback;
			});
	}

	sendFeedback() {
		if (this.sessionId || this.avatarIdx || this.gameStateId) {
			this.surveyService
				.sendFeedback(this.sessionId, this.gameStateId, this.avatarIdx, this.feedback)
				.subscribe(() => {
					this.dialog
						.open(InformationDialogComponent, {
							disableClose: true,
							data: {
								title: this.i18nService.instant('SURVEY.THANK_YOU'),
								message: this.i18nService.instant('BACK_TO_LOBBY'),
								timerBtn: 3,
							},
						})
						.afterClosed()
						.subscribe(() => {
							this.router.navigate(['avatar', this.sessionId, this.avatarIdx]);
						});
				});
		}
	}
}
