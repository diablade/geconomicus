import {AfterViewInit, Component, OnInit} from '@angular/core';
import io from "socket.io-client";
import * as _ from 'lodash-es';
import {ActivatedRoute, Router} from "@angular/router";
import {BackService} from "../services/back.service";
import {SnackbarService} from "../services/snackbar.service";
import {LoadingService} from "../services/loading.service";
import {environment} from "../../environments/environment";
import {Card, EventGeco, Game, Player} from "../models/game";
import {Subscription} from "rxjs";
// @ts-ignore
import * as C from "../../../../config/constantes";

import {ChartConfiguration, ChartDataset, ChartData, ChartType} from 'chart.js';
import 'chartjs-adapter-date-fns';
// import {fr} from 'date-fns/locale';
import {subSeconds, parseISO} from 'date-fns';

// import { Chart, ChartEvent, ChartOptions, PluginChartOptions} from 'chart.js';


@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss']
})
export class EventsComponent implements OnInit, AfterViewInit {
  private socket: any;
  idGame: string = "";
  private subscription: Subscription | undefined;

  game: Game | undefined;
  events: EventGeco[] = [];
  players: Player[] = [];
  datasets: ChartDataset[] = [];
  datasetsRelatif: ChartDataset[] = [];
  currentDU = 0;
  C = C;


  public lineChartData: ChartConfiguration['data'] | undefined;
  public lineChartOptions: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0.1,
      },
    },
    scales: {
      x: {
        type: 'time',
        ticks: {source: "auto"},
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm'
          },
        },
      },
      y: {
        min: 0,
        type: 'logarithmic',
        // ticks: {
        // min: 0, // Minimum Y-axis value (10^0)
        // max: 1000, // Maximum Y-axis value (10^3)
        // stepSize: 1, // Step size between ticks
        // callback: function (value, index, values) {
        //   return value; // Display tick values as they are (e.g., 10, 100, 1000)
        // }
        // }
      },
    },
  };
  public lineChartType: ChartType = 'line';

  public lineChartDataRelatif: ChartConfiguration['data'] | undefined;
  public lineChartOptionsRelatif: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0.1,
      },
    },
    scales: {
      x: {
        type: 'time',
        ticks: {source: "auto"},
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm'
          },
        },
      },
      y: {
        min: 0,
      },
    },
  };
  public lineChartTypeRelatif: ChartType = 'line';

  constructor(private route: ActivatedRoute, private router: Router, private backService: BackService, private snackbarService: SnackbarService, private loadingService: LoadingService) {
  }

  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      this.backService.getGame(this.idGame).subscribe(async game => {
        this.events = game.events;
        this.players = game.players;
        await this.initDatasets();
        const firstDu = await _.find(this.events, e => {
          return e.typeEvent == C.FIRST_DU
        });
        if (firstDu) {
          this.currentDU = firstDu.amount;
        }
        this.addEventsToDatasets(this.events);
      });
      this.socket = io(environment.API_HOST, {
        query: {
          idPlayer: "master",
          idGame: this.idGame,
        },
      });
    });
  }

  ngAfterViewInit() {
    this.socket.on(C.EVENT, async (data: any) => {
      this.events.push(data.event);
    });
  }

  hexToRgb(hex: string): string {
    // Remove the # symbol if present
    hex = hex.replace(/^#/, '');

    // Parse the hex value to an integer
    const hexValue = parseInt(hex, 16);

    // Extract the red, green, and blue components
    const red = (hexValue >> 16) & 255;
    const green = (hexValue >> 8) & 255;
    const blue = hexValue & 255;

    // Create the RGB string
    return `rgba(${red}, ${green}, ${blue},1)`;
  }

  async initDatasets() {
    // Initialize empty dataset for each player with a running total
    const players = _.sortBy(this.players, 'name');

    this.datasets = _.map(players, player => ({
      data: [],
      label: player.name,
      backgroundColor: this.hexToRgb(player.hairColor),
      borderColor: this.hexToRgb(player.hairColor),
      pointBackgroundColor: this.hexToRgb(player.hairColor),
      pointBorderColor: this.hexToRgb(player.hairColor),
      borderWidth: 2, // Line thickness
      pointRadius: 0.8, // Point thickness
      total: 0,
      playerId: player._id
    }));

    this.datasetsRelatif = _.map(players, player => ({
      data: [],
      label: player.name,
      backgroundColor: this.hexToRgb(player.hairColor),
      borderColor: this.hexToRgb(player.hairColor),
      pointBackgroundColor: this.hexToRgb(player.hairColor),
      pointBorderColor: this.hexToRgb(player.hairColor),
      borderWidth: 2, // Line thickness
      pointRadius: 0.8, // Point thickness
      total: 0,
      playerId: player._id
    }));
  }

  addEventsToDatasets(unsortedEvents: EventGeco[]) {
    const events = _.sortBy(unsortedEvents, 'date');

    // Iterate over each event
    for (const event of events) {
      if (event.typeEvent === C.STOP_ROUND || event.typeEvent === C.START_ROUND || event.typeEvent === C.TRANSFORM_NEW || event.typeEvent === C.TRANSFORM_DISCARD) {
        continue
      } else if (event.typeEvent === C.FIRST_DU) {
        this.currentDU = event.amount;
        continue
      } else if (event.typeEvent === C.DISTRIB_DU) {
        this.currentDU = event.amount;
      }

      // Find the dataset for the emitter and receiver
      // @ts-ignore
      const emitterDataset = _.find(this.datasets, dataset => dataset.playerId === event.emitter);
      // @ts-ignore
      const emitterDatasetRelatif = _.find(this.datasetsRelatif, dataset => dataset.playerId === event.emitter);
      // @ts-ignore
      const receiverDataset = _.find(this.datasets, dataset => dataset.playerId === event.receiver);
      // @ts-ignore
      const receiverDatasetRelatif = _.find(this.datasetsRelatif, dataset => dataset.playerId === event.receiver);

      // Add the event to the emitter's and receiver's datasets and update the running total
      if (emitterDataset) {
        if (event.typeEvent === C.TRANSACTION) {
          // @ts-ignore before
          emitterDataset.data.push({x: subSeconds(parseISO(event.date), 1), y: emitterDataset.total});
          // @ts-ignore before
          emitterDatasetRelatif.data.push({
            // @ts-ignore before
            x: subSeconds(parseISO(event.date), 1),
            // @ts-ignore before
            y: (emitterDataset.total / this.currentDU)
          });
        }
        if (event.typeEvent === C.DISTRIB) {
          console.log("distrib yoo emitter");
        }
        // @ts-ignore
        emitterDataset.total -= event.amount;
        // @ts-ignore after transaction
        emitterDataset.data.push({x: event.date, y: emitterDataset.total});
        // @ts-ignore after transaction
        emitterDatasetRelatif.data.push({x: event.date, y: (emitterDataset.total / this.currentDU)});
      }
      if (receiverDataset) {
        if (event.typeEvent === C.TRANSACTION) {
          // @ts-ignore before
          receiverDataset.data.push({x: subSeconds(parseISO(event.date), 1), y: receiverDataset.total});
          // @ts-ignore before
          receiverDatasetRelatif.data.push({
            // @ts-ignore before
            x: subSeconds(parseISO(event.date), 1),
            // @ts-ignore before
            y: (receiverDataset.total / this.currentDU)
          });
        }
        if (event.typeEvent === C.DISTRIB) {
          // @ts-ignore
          console.log("distrib yoo receiver", receiverDataset.total, this.currentDU);
        }
        // @ts-ignore
        receiverDataset.total += event.amount;
        // @ts-ignore after
        receiverDataset.data.push({x: event.date, y: receiverDataset.total});
        // @ts-ignore after
        receiverDatasetRelatif.data.push({x: event.date, y: (receiverDataset.total / this.currentDU)});
      }

    }

    // Remove the 'total' property from each dataset
    // datasets.forEach(dataset => delete dataset.total);

    this.lineChartData = {
      // @ts-ignore
      datasets: this.datasets
    };
    this.lineChartDataRelatif = {
      // @ts-ignore
      datasets: this.datasetsRelatif
    };
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

  getPlayerName(playerId: string) {
    const player = _.find(this.players,p=>p._id===playerId);
    return player ? player.name : "undefined";
  }

  getTextCard(card: Card) {
    return card.letter+this.getResourcesEmoji(card.color);
  }
}
