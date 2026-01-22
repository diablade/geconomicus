import {Component, OnInit} from '@angular/core';
import {SurveyService} from "../services/api/survey.service";
import {SnackbarService} from "../services/snackbar.service";
import {Subscription} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {I18nService} from "../services/i18n.service";

@Component({
	selector: 'app-survey',
	templateUrl: './survey.component.html',
	styleUrls: ['./survey.component.scss']
})
export class SurveyComponent implements OnInit {
	sessionId: string = "";
	avatarIdx: string = "";
	gameStateId: string = "";
	private subscription: Subscription | undefined;

	individualCollective = 0;
	greedyGenerous = 0;
	irritableTolerant = 0;
	depressedHappy = 0;
	competitiveCooperative = 0;
	dependantAutonomous = 0;
	anxiousConfident = 0;
	agressiveAvenant = 0;
	insatisfiedAccomplished = 0;

	constructor(private route: ActivatedRoute, private i18nService: I18nService, private router: Router, private surveyService: SurveyService, private snackbarService: SnackbarService) {
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.sessionId = params['sessionId'];
			this.avatarIdx = params['avatarIdx'];
			this.gameStateId = params['gameStateId'];
		});
	}

	sendFeedback() {
		if (this.sessionId || this.avatarIdx || this.gameStateId) {
			this.surveyService.sendFeedback(this.sessionId, this.gameStateId, this.avatarIdx,
				+this.individualCollective,
				+this.greedyGenerous,
				+this.irritableTolerant,
				+this.depressedHappy,
				+this.competitiveCooperative,
				+this.dependantAutonomous,
				+this.anxiousConfident,
				+this.insatisfiedAccomplished,
				+this.agressiveAvenant).subscribe(async () => {
				this.snackbarService.showSuccess(this.i18nService.instant("SURVEY.THANK_YOU"));
				await new Promise(resolve => setTimeout(resolve, 3000));
				this.router.navigate(['avatar', this.sessionId, this.avatarIdx]);
			});
		}
	}
}
