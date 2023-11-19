import {Component, OnInit} from '@angular/core';
import {BackService} from "../services/back.service";
// @ts-ignore
import * as C from "../../../../config/constantes";
import * as _ from 'lodash-es';

@Component({
  selector: 'app-history-games',
  templateUrl: './history-games.component.html',
  styleUrls: ['./history-games.component.scss']
})
export class HistoryGamesComponent implements OnInit {
  games: any;
  C = C;

  constructor(private backService: BackService) {
  }

  ngOnInit(): void {
    this.backService.getGames().subscribe(async data => {
      this.games = _.sortBy(data.games,"created");
    });
  }

  getStatus(status: string): string {
    switch (status) {
      case C.END_GAME:
        return "Terminé";
      case C.OPEN:
        return "Ouvert";
      default :
        return "En cours";
    }
  }

  getStatusClass(status:string):string {
    switch (status) {
      case C.END_GAME:
        return "statusClosed";
      case C.OPEN:
        return "statusOpen";
      default :
        return "statusOnGoing";
    }
  }
}
