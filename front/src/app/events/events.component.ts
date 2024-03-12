import {AfterViewInit, Component, Input, OnInit} from '@angular/core';
import * as _ from 'lodash-es';
import {Card, EventGeco, Player} from "../models/game";
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import Chart from 'chart.js/auto';
// @ts-ignore
import * as C from "../../../../config/constantes";


Chart.register(zoomPlugin);


@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss']
})
export class EventsComponent {

  @Input() events: EventGeco[] = [];
  @Input() players: Player[] = [];
  C = C;

  constructor() {
  }

  getResourcesEmoji(color: string) {
    switch (color) {
      case "red":
        return "🟥";
      case "yellow":
        return "🟨";
      case "green":
        return "🟩";
      case "blue":
        return "🟦";
      default:
        return "🟥";
    }
  }

  getPlayerName(idPlayer: string) {
    const player = _.find(this.players, p => p._id === idPlayer);
    return player ? player.name : "undefined";
  }

  getTextCard(card: Card) {
    return card.letter + this.getResourcesEmoji(card.color);
  }
}
