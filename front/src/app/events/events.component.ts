import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import io from "socket.io-client";
import * as _ from 'lodash-es';
import {ActivatedRoute, Router} from "@angular/router";
import {BackService} from "../services/back.service";
import {SnackbarService} from "../services/snackbar.service";
import {LoadingService} from "../services/loading.service";
import {environment} from "../../environments/environment";
import {EventGeco, Game, Player} from "../models/game";
import {Subscription} from "rxjs";
// @ts-ignore
import {START_ROUND, STARTED, STOP_ROUND} from "../../../../config/constantes";

import {ChartConfiguration, ChartDataset, ChartData, ChartType} from 'chart.js';
import 'chartjs-adapter-date-fns';
// import {fr} from 'date-fns/locale';
import {subSeconds, parseISO} from 'date-fns';

// import { Chart, ChartEvent, ChartOptions, PluginChartOptions} from 'chart.js';

// @ts-ignore
import {EVENT} from "../../../../config/constantes";


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

  // @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

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

  // @ViewChild(BaseChartDirective) chartRelatif?: BaseChartDirective;

  constructor(private route: ActivatedRoute, private router: Router, private backService: BackService, private snackbarService: SnackbarService, private loadingService: LoadingService) {
  }

  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      this.backService.getGame(this.idGame).subscribe(game => {
        this.events = game.events;
        this.players = game.players;
        this.convertEventsToDatasets(this.events, this.players);
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
    this.socket.on(EVENT, async (data: any) => {
      console.log(EVENT, data);
      this.events.push(data)
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

  convertEventsToDatasets(unsortedEvents: EventGeco[], unsortedPlayers: Player[]) {
    // Initialize an empty dataset for each player with a running total
    const players = _.sortBy(unsortedPlayers, 'name');
    const events = _.sortBy(unsortedEvents, 'date');

    const datasets: ChartDataset[] = players.map(player => ({
      data: [],
      label: player.name,
      backgroundColor: this.hexToRgb(player.hairColor),
      borderColor: this.hexToRgb(player.hairColor),
      pointBackgroundColor: this.hexToRgb(player.hairColor),
      pointBorderColor: player.hairColor,
      total: 0,
      playerId: player._id
    }));
    const datasetsRelatif: ChartDataset[] = players.map(player => ({
      data: [],
      label: player.name,
      backgroundColor: this.hexToRgb(player.hairColor),
      borderColor: this.hexToRgb(player.hairColor),
      pointBackgroundColor: this.hexToRgb(player.hairColor),
      pointBorderColor: player.hairColor,
      total: 0,
      playerId: player._id
    }));

    let currentDU = 0;
    // Iterate over each event
    for (const event of events) {
      if (event.typeEvent === STOP_ROUND || event.typeEvent === START_ROUND || event.typeEvent === "tranformNewCards" || event.typeEvent === "transformDiscard") {
        continue
      } else if (event.typeEvent === "first_DU") {
        currentDU = event.amount;
        continue
      } else if (event.typeEvent === "distrib_du") {
        currentDU = event.amount;
      }

      // Find the dataset for the emitter and receiver
      // @ts-ignore
      const emitterDataset = _.find(datasets, dataset => dataset.playerId === event.emitter);
      // @ts-ignore
      const emitterDatasetRelatif = _.find(datasetsRelatif, dataset => dataset.playerId === event.emitter);
      // @ts-ignore
      const receiverDataset = _.find(datasets, dataset => dataset.playerId === event.receiver);
      // @ts-ignore
      const receiverDatasetRelatif = _.find(datasetsRelatif, dataset => dataset.playerId === event.receiver);

      // Add the event to the emitter's and receiver's datasets and update the running total
      if (emitterDataset) {
        if (event.typeEvent === "transaction") {
          // @ts-ignore before
          emitterDataset.data.push({x: subSeconds(parseISO(event.date), 1), y: emitterDataset.total});
          // @ts-ignore before
          emitterDatasetRelatif.data.push({
            // @ts-ignore before
            x: subSeconds(parseISO(event.date), 1),
            // @ts-ignore before
            y: (emitterDataset.total / currentDU)
          });
        }
        // @ts-ignore
        emitterDataset.total -= event.amount;
        // @ts-ignore after transaction
        emitterDataset.data.push({x: event.date, y: emitterDataset.total});
        // @ts-ignore after transaction
        emitterDatasetRelatif.data.push({x: event.date, y: emitterDataset.total / currentDU});
      }
      if (receiverDataset) {
        if (event.typeEvent === "transaction") {
          // @ts-ignore before
          receiverDataset.data.push({x: subSeconds(parseISO(event.date), 1), y: receiverDataset.total});
          // @ts-ignore before
          receiverDatasetRelatif.data.push({
            // @ts-ignore before
            x: subSeconds(parseISO(event.date), 1),
            // @ts-ignore before
            y: receiverDataset.total / currentDU
          });
        }
        // @ts-ignore
        receiverDataset.total += event.amount;
        // @ts-ignore after
        receiverDataset.data.push({x: event.date, y: receiverDataset.total});
        // @ts-ignore after
        receiverDatasetRelatif.data.push({x: event.date, y: receiverDataset.total / currentDU});
      }

    }

    // Remove the 'total' property from each dataset
    // datasets.forEach(dataset => delete dataset.total);

    this.lineChartData = {
      datasets: datasets
    };
    this.lineChartDataRelatif = {
      datasets: datasetsRelatif
    };
  }

}
