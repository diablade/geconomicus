import {Component, OnInit} from '@angular/core';
import {BackService} from "../services/back.service";
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
  idGame: string | undefined;
  idPlayer: string | undefined;
  private subscription: Subscription | undefined;

  individualCollective = 0;
  greedyGenerous = 0;
  irritableTolerant = 0;
  depressedHappy = 0;
  competitiveCooperative = 0;
  dependantAutonomous = 0;
  anxiousConfident = 0;
  agressiveAvenant = 0;
  aloneIntegrated = 0;

  constructor(private route: ActivatedRoute, private i18nService: I18nService, private router: Router, private backService: BackService, private snackbarService: SnackbarService) {
  }

  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      this.idPlayer = params['idPlayer'];
    });
  }

  sendFeedback() {
    this.backService.sendFeedback(this.idGame, this.idPlayer,
      +this.individualCollective,
      +this.greedyGenerous,
      +this.irritableTolerant,
      +this.depressedHappy,
      +this.competitiveCooperative,
      +this.dependantAutonomous,
      +this.anxiousConfident,
      +this.aloneIntegrated,
      +this.agressiveAvenant).subscribe(async () => {
      this.snackbarService.showSuccess(this.i18nService.instant("SURVEY.THANK_YOU"));

      await new Promise(resolve => setTimeout(resolve, 4000));
      this.router.navigate(['game', this.idGame, 'results']);

    });
  }
}
