import {AfterViewInit, Component, OnInit} from '@angular/core';
import {Subscription} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {BackService} from "../services/back.service";
import {SnackbarService} from "../services/snackbar.service";
import io from "socket.io-client";
import {EventGeco, Game, Player} from "../models/game";
import * as _ from 'lodash-es';
import {LoadingService} from "../services/loading.service";
import {environment} from "../../environments/environment";
// @ts-ignore
import * as C from "../../../../config/constantes";

import {ChartConfiguration, ChartDataset} from 'chart.js';
import 'chartjs-adapter-date-fns';
// import {fr} from 'date-fns/locale';
import {parseISO, subSeconds} from 'date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import Chart from 'chart.js/auto';

Chart.register(zoomPlugin);


@Component({
  selector: 'app-results',
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit, AfterViewInit {
  private socket: any;
  idGame: string = "";
  private subscription: Subscription | undefined;

  game: Game | undefined;
  events: EventGeco[] = [];
  players: Player[] = [];
  datasets: ChartDataset[] = [];
  datasetsRelatif: ChartDataset[] = [];
  datasetsResources: ChartDataset[] = [];
  datasetsFeedback: ChartDataset[] = [];
  currentDU = 0;
  initialDU = 0;
  initialMM = 0;
  reincarnates = 0;
  startGameDate: Date | undefined;
  stopGameDate: Date | undefined;
  C = C;
  baseRadius: number = 2.1;

  durationGame() {
    if (this.startGameDate && this.stopGameDate) {
      let start = new Date(this.startGameDate);
      let end = new Date(this.stopGameDate);
      let durationInMilliseconds = end.getTime() - start.getTime();
      let durationInMinutes = Math.floor(durationInMilliseconds / (1000 * 60));
      return durationInMinutes + " minutes";
    }
    return "-";
  }

  getStatus() {
    switch (this.game?.status) {
      case C.OPEN:
        return "Ouvert à rejoindre";
      case C.PLAYING:
        return "En cours";
      case C.END_GAME:
        return "Jeu Terminé";
      case C.STOP_ROUND:
        return "Tour terminé";
      case C.INTER_ROUND :
        return 'Inter tour';
      case C.START_GAME :
        return 'Jeu démarré';
      default:
        return "-";

    }
  }

  public lineChartData: ChartConfiguration['data'] | undefined;
  public lineChartOptions: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0.1,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
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
    plugins: {
      zoom: {
        limits: {
          y: {min: 0},
        },
        pan: {
          enabled: true,
          mode: 'xy', // Enable both X and Y panning
        },
        zoom: {
          wheel: {
            enabled: true,
            modifierKey: 'ctrl',

          },
          pinch: {
            enabled: true,
          },
          mode: 'xy', // Enable both X and Y zooming
        },
      },
    },
  };

  public lineChartDataRelatif: ChartConfiguration['data'] | undefined;
  public lineChartOptionsRelatif: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0.1,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
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
    plugins: {
      zoom: {
        limits: {
          y: {min: 0},
        },
        pan: {
          enabled: true,
          mode: 'xy'
        },
        zoom: {
          wheel: {
            enabled: true,
            modifierKey: 'ctrl',
          },
          pinch: {
            enabled: true
          },
          mode: 'xy'
        }
      }
    }
  };

  public lineChartDataResources: ChartConfiguration['data'] | undefined;
  public lineChartOptionsResources: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0.1,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
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
    plugins: {
      zoom: {
        limits: {
          y: {min: 0},
        },
        pan: {
          enabled: true,
          mode: 'xy'
        },
        zoom: {
          wheel: {
            modifierKey: 'ctrl',
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'xy'
        }
      }
    }
  };

  public feedbacksData: ChartConfiguration['data'] | undefined;

  public feedbacksLabelsTop = [
    "Joyeux",
    "Collectif",
    "En Communauté",
    "Génereux",
    "Coopératif",
    "Confiant",
    "Avenant",
    "Tolérant",
    "Autonome"];
  public feedbacksLabelsBottom = [
    "Déprimé",
    "Individuel",
    "Seul(e)",
    "Avar",
    "Compétitif",
    "Anxieux",
    "Agréssif",
    "Irritable",
    "Dépendant"];
  public leftLabels = [
    "Trés",
    "Assez",
    "Un peu",
    "neutre",
    "Un peu",
    "Assez",
    "Trés"];
  public feedbacksOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          // @ts-ignore
          label: function (tooltipItem) {
            // @ts-ignore
            return tooltipItem.raw.count;
          },
        },
      },
    },
    scales: {
      x: {display: false, ticks: {stepSize: 1}},
      y: {display: false, ticks: {stepSize: 1}, type:"linear", min:-3, max:3,},
      x2: {position: "top", type: "category", labels: this.feedbacksLabelsTop,},
      x3: {position: "bottom", type: "category", labels: this.feedbacksLabelsBottom,},
      y2: {position: "left", type: "category", labels: this.leftLabels,},
    },
  };


  constructor(private route: ActivatedRoute, private router: Router, private backService: BackService, private snackbarService: SnackbarService, private loadingService: LoadingService) {
  }

  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      this.backService.getGame(this.idGame).subscribe(async game => {
        this.game = game;
        this.events = game.events;
        this.players = game.players;
        await this.initDatasets();
        const firstDu = await _.find(this.events, e => {
          return e.typeEvent == C.FIRST_DU || e.typeEvent == "first_DU"
        });
        if (firstDu) {
          this.currentDU = firstDu.amount;
        }
        this.addEventsToDatasets(this.events);
      });
      this.socket = io(environment.API_HOST, {
        query: {
          idPlayer: this.idGame+"event",
          idGame: this.idGame,
        },
      });
    });
  }

  ngAfterViewInit() {
    this.socket.on(C.EVENT, async (data: any) => {
      this.events.push(data.event);
    });
    this.socket.on(C.NEW_FEEDBACK, async (data: any) => {
      window.location.reload();
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

  getRandomColor(): string {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgba(${r}, ${g}, ${b}, ${0.6})`;
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
      idPlayer: player._id
    }));
    this.datasets.push({
      data: [],
      label: "Masse monétaire",
      backgroundColor: this.hexToRgb("#000000"),
      borderColor: this.hexToRgb("#000000"),
      pointBackgroundColor: this.hexToRgb("#000000"),
      pointBorderColor: this.hexToRgb("#000000"),
      borderWidth: 2, // Line thickness
      pointRadius: 0.8, // Point thickness
      // @ts-ignore
      total: 0,
      idPlayer: "masseMoney"
    });

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
      idPlayer: player._id
    }));

    this.datasetsResources = _.map(players, player => ({
      data: [],
      label: player.name,
      backgroundColor: this.hexToRgb(player.hairColor),
      borderColor: this.hexToRgb(player.hairColor),
      pointBackgroundColor: this.hexToRgb(player.hairColor),
      pointBorderColor: this.hexToRgb(player.hairColor),
      borderWidth: 2, // Line thickness
      pointRadius: 0.8, // Point thickness
      total: 0,
      idPlayer: player._id
    }));

    this.initFeedbacks();
  }

  initFeedbacks() {
    const playersWithFeedbacks = _.filter(this.players, p => p.survey != undefined);
    const feedbacks = _.map(playersWithFeedbacks, p => p.survey);
    const feedbacksCounts1 = _.countBy(feedbacks, "depressedHappy");
    const feedbacksCounts2 = _.countBy(feedbacks, "individualCollective");
    const feedbacksCounts3 = _.countBy(feedbacks, "aloneIntegrated");
    const feedbacksCounts4 = _.countBy(feedbacks, "greedyGenerous");
    const feedbacksCounts5 = _.countBy(feedbacks, "competitiveCooperative");
    const feedbacksCounts6 = _.countBy(feedbacks, "anxiousConfident");
    const feedbacksCounts7 = _.countBy(feedbacks, "agressiveAvenant");
    const feedbacksCounts8 = _.countBy(feedbacks, "irritableTolerant");
    const feedbacksCounts9 = _.countBy(feedbacks, "dependantAutonomous");
    const feedbacksCounted = [feedbacksCounts1, feedbacksCounts2, feedbacksCounts3, feedbacksCounts4, feedbacksCounts5, feedbacksCounts6, feedbacksCounts7, feedbacksCounts8, feedbacksCounts9];

    // @ts-ignore
    this.datasetsFeedback = _.map(feedbacksCounted, (feedback, index) => {
      let data = _.map(feedback, (count, key) => {
        return {x: index, y: parseInt(key), r: Math.log(count * 2) * 6, count: count}
      });
      return {
        data: data,
        type: 'bubble',
        backgroundColor: this.getRandomColor()
      }
    });
    // this.datasetsFeedback.push(
    //   {
    //     data: [0, 1, 3, 2, 1, 2, 0, 3, 0],
    //     label: "Median",
    //     type: 'line',
    //     fill: false,
    //     indexAxis: "x",
    //     hidden: false,
    //     showLine: true, xAxisID: "x", stack: "true",
    //     backgroundColor: this.hexToRgb("#000000"),
    //     borderColor: this.hexToRgb("#000000"),
    //     pointBackgroundColor: this.hexToRgb("#000000"),
    //     pointBorderColor: this.hexToRgb("#000000"),
    //     borderWidth: 2, // Line thickness
    //     tension: 0.1,
    //     pointRadius: 0.8, // Point thickness
    //   });

    this.feedbacksData = {
      // @ts-ignore
      datasets: this.datasetsFeedback
    };
  }

  addEventsToDatasets(unsortedEvents: EventGeco[]) {
    const events = _.sortBy(unsortedEvents, 'date');

    // Iterate over each event
    for (const event of events) {
      let totalResourcesEvent = 0;

      if (event.typeEvent === C.START_GAME) {
        this.startGameDate = event.date;
      } else if (event.typeEvent === C.END_GAME) {
        this.stopGameDate = event.date;
      } else if (event.typeEvent === C.DEAD) {
        this.reincarnates += 1;
      } else if (event.typeEvent === C.STOP_ROUND || event.typeEvent === C.START_ROUND) {
        continue
      } else if (event.typeEvent === C.FIRST_DU) {
        this.currentDU = event.amount;
        this.initialDU = event.amount;
        continue
      } else if (event.typeEvent === C.DISTRIB_DU) {
        this.currentDU = event.amount;
      } else if (event.typeEvent === C.DISTRIB || event.typeEvent === C.TRANSACTION || event.typeEvent === C.TRANSFORM_DISCARDS || event.typeEvent === "transformDiscard" || event.typeEvent === "tranformNewCards" || event.typeEvent === C.TRANSFORM_NEWCARDS) {
        totalResourcesEvent = _.reduce(event.resources, function (sum, card) {
          return sum + card.price;
        }, 0);
        if (event.typeEvent === C.DISTRIB) {
          this.initialMM += event.amount;
        }
      }

      // Find the dataset for the emitter and receiver
      // @ts-ignore
      const mmDataset = _.find(this.datasets, dataset => dataset.idPlayer === "masseMoney");
      // @ts-ignore
      const emitterDataset = _.find(this.datasets, dataset => dataset.idPlayer === event.emitter);
      // @ts-ignore
      const emitterDatasetRelatif = _.find(this.datasetsRelatif, dataset => dataset.idPlayer === event.emitter);
      // @ts-ignore
      const emitterDatasetResources = _.find(this.datasetsResources, dataset => dataset.idPlayer === event.emitter);
      // @ts-ignore
      const receiverDataset = _.find(this.datasets, dataset => dataset.idPlayer === event.receiver);
      // @ts-ignore
      const receiverDatasetRelatif = _.find(this.datasetsRelatif, dataset => dataset.idPlayer === event.receiver);
      // @ts-ignore
      const receiverDatasetResources = _.find(this.datasetsResources, dataset => dataset.idPlayer === event.receiver);

      if (mmDataset && (event.typeEvent === C.DISTRIB || event.typeEvent === C.DISTRIB_DU)) {
        // @ts-ignore
        mmDataset.total += event.amount;
        // @ts-ignore
        mmDataset.data.push({x: event.date, y: mmDataset.total});

      }
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
        // @ts-ignore
        emitterDataset.total -= event.amount;
        // @ts-ignore after transaction
        emitterDataset.data.push({x: event.date, y: emitterDataset.total});
        // @ts-ignore after transaction
        emitterDatasetRelatif.data.push({x: event.date, y: (emitterDataset.total / this.currentDU)});
      }
      if (emitterDatasetResources) {
        if (event.typeEvent === C.TRANSACTION) {
          // @ts-ignore
          emitterDatasetResources.data.push({x: subSeconds(parseISO(event.date), 1), y: emitterDatasetResources.total});
          // @ts-ignore
          emitterDatasetResources.total += totalResourcesEvent;
          // @ts-ignore
          emitterDatasetResources.data.push({x: event.date, y: emitterDatasetResources.total});
        } else if (event.typeEvent === C.TRANSFORM_DISCARDS || event.typeEvent === "transformDiscard") {
          // @ts-ignore
          emitterDatasetResources.total -= totalResourcesEvent;
        }
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
        // @ts-ignore
        receiverDataset.total += event.amount;
        // @ts-ignore after
        receiverDataset.data.push({x: event.date, y: receiverDataset.total});
        // @ts-ignore after
        receiverDatasetRelatif.data.push({x: event.date, y: (receiverDataset.total / this.currentDU)});

        if (receiverDatasetResources) {
          if (event.typeEvent === C.TRANSACTION) {
            // @ts-ignore
            receiverDatasetResources.data.push({
              // @ts-ignore
              x: subSeconds(parseISO(event.date), 1),
              // @ts-ignore
              y: receiverDatasetResources.total
            });
            // @ts-ignore
            receiverDatasetResources.total -= totalResourcesEvent;
            // @ts-ignore
            receiverDatasetResources.data.push({x: event.date, y: receiverDatasetResources.total});
          } else if (event.typeEvent === C.DEAD) {
            // @ts-ignore
            receiverDatasetResources.data.push({
              // @ts-ignore
              x: subSeconds(parseISO(event.date), 1),
              // @ts-ignore
              y: receiverDatasetResources.total
            });
            // @ts-ignore
            receiverDatasetResources.data.push({x: event.date, y: 0});
          } else if (event.typeEvent === C.REMIND_DEAD) {
            // @ts-ignore
            receiverDatasetResources.data.push({x: event.date, y: 0});
          } else if (event.typeEvent === C.DISTRIB || event.typeEvent === C.TRANSFORM_NEWCARDS || event.typeEvent === "tranformNewCards") {
            // @ts-ignore
            receiverDatasetResources.total += totalResourcesEvent;
            // @ts-ignore
            receiverDatasetResources.data.push({x: event.date, y: receiverDatasetResources.total});
          }
        }
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
    this.lineChartDataResources = {
      // @ts-ignore
      datasets: this.datasetsResources
    };
  }
}
