import {Component, OnInit} from '@angular/core';
import {BackService} from "../services/back.service";
import {SnackbarService} from "../services/snackbar.service";
import {Player} from "../models/game";
import {Subscription} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";

@Component({
  selector: 'app-survey',
  templateUrl: './survey.component.html',
  styleUrls: ['./survey.component.scss']
})
export class SurveyComponent implements OnInit {
  idGame: string | undefined;
  idPlayer: string | undefined;
  private subscription: Subscription | undefined;

  individualCollective: number = 0;
  greedyGenerous: number = 0;
  irritableTolerant: number = 0;
  depressedHappy: number = 0;
  competitiveCooperative: number = 0;
  dependantAutonomous: number = 0;
  anxiousConfident: number = 0;
  agressiveAvenant: number = 0;

  constructor(private route: ActivatedRoute, private router: Router, private backService: BackService, private snackbarService: SnackbarService) {
  }

  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      this.idPlayer = params['idPlayer'];
    });
  }

  sendFeedback() {
    this.backService.sendFeedback(this.idGame, this.idPlayer,
      this.individualCollective,
      this.greedyGenerous,
      this.irritableTolerant,
      this.depressedHappy,
      this.competitiveCooperative,
      this.dependantAutonomous,
      this.anxiousConfident,
      this.agressiveAvenant).subscribe(async (data: any) => {
      this.snackbarService.showSuccess("Merci ! Redirection vers les resultats...");

      await new Promise(resolve => setTimeout(resolve, 4000));
      this.router.navigate(['game', this.idGame, 'results']);

    });
  }
}
