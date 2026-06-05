import { Component, OnInit } from '@angular/core';
import { SurveyService } from '../services/api/survey.service';
import { SnackbarService } from '../services/snackbar.service';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { I18nService } from '../services/i18n.service';
import { Feedback } from '../models/feedback';

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
		private snackbarService: SnackbarService
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
				.subscribe(async () => {
					this.snackbarService.showSuccess(this.i18nService.instant('SURVEY.THANK_YOU'));
					await new Promise((resolve) => setTimeout(resolve, 3000));
					this.router.navigate(['avatar', this.sessionId, this.avatarIdx]);
				});
		}
	}
}
