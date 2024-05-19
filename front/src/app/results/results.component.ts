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
import {getRandomColor, hexToRgb} from "../services/tools";
// @ts-ignore
import * as C from "../../../../config/constantes";

import {ChartConfiguration, ChartDataset} from 'chart.js';
import 'chartjs-adapter-date-fns';
// import {fr} from 'date-fns/locale';
import {parseISO, subSeconds} from 'date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import Chart from 'chart.js/auto';
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";

Chart.register(zoomPlugin);


@Component({
	selector: 'app-results',
	templateUrl: './results.component.html',
	styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit, AfterViewInit {
	private socket: any;
	idGame = "";
	private subscription: Subscription | undefined;

	game: Game | undefined;
	events: EventGeco[] = [];
	players: Player[] = [];
	datasets: Map<string, ChartDataset> = new Map<string, ChartDataset>();
	datasetsRelatif: Map<string, ChartDataset> = new Map<string, ChartDataset>();
	datasetsResources: Map<string, ChartDataset> = new Map<string, ChartDataset>();
	datasetsFeedback: ChartDataset[] = [];
	massMonetaryName = "Masse monétaire";
	bankName = "Banque";
	currentDU = 0;
	initialDU = 0;
	initialMM = 0;
	initialDebts = 0;
	initialResources = 0;
	finalResources = 0;
	reincarnates = 0;
	startGameDate: Date | undefined;
	stopGameDate: Date | undefined;
	roundStarted = false;
	pointsBefore1second = true;
	C = C;
	baseRadius = 2.1;
	nbPlayer = 0;
	bestPlayerOnMoney: Player | undefined;
	bestPlayerOnMoneyId: string | undefined = "";
	bestPlayerOnRes: Player | undefined;
	bestPlayerOnResId: string | undefined = "";
	bestPlayerOnTransaction: Player | undefined;
	bestPlayerOnTransactionId: string | undefined = "";
	maxLastPointMoney = 0;
	maxLastPointRes = 0;


	durationGame() {
		if (this.startGameDate && this.stopGameDate) {
			const start = new Date(this.startGameDate);
			const end = new Date(this.stopGameDate);
			const durationInMilliseconds = end.getTime() - start.getTime();
			const durationInMinutes = Math.floor(durationInMilliseconds / (1000 * 60));
			return durationInMinutes + " minutes";
		}
		return "-";
	}

	getDebts() {
		let debt = 0;
		_.forEach(this.game?.credits, c => {
			if (c.status != C.CREDIT_DONE) {
				debt += (c.amount + c.interest)
			}
		});
		return debt;
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
		"Avare",
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
			y: {display: false, ticks: {stepSize: 1}, type: "linear", min: -3, max: 3,},
			x2: {position: "top", type: "category", labels: this.feedbacksLabelsTop,},
			x3: {position: "bottom", type: "category", labels: this.feedbacksLabelsBottom,},
			y2: {position: "left", type: "category", labels: this.leftLabels,},
		},
	};

	constructor(private route: ActivatedRoute, private router: Router,
							private sanitizer: DomSanitizer,
							private backService: BackService, private snackbarService: SnackbarService, private loadingService: LoadingService) {
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			this.backService.getGame(this.idGame).subscribe(async game => {
				this.game = game;
				this.events = game.events;
				this.players = game.players;
				this.nbPlayer = _.partition(this.players, p => p.status === C.ALIVE).length;
				await this.initDatasets();
				if (this.game?.typeMoney == C.JUNE) {
					const firstDu = _.find(this.events, e => {
						return e.typeEvent == C.FIRST_DU || e.typeEvent == "first_DU";
					});
					if (firstDu) {
						this.currentDU = firstDu.amount;
					}
				}
				this.addEventsToDatasets(this.events);
				this.getBestPlayers();
			});
			this.socket = io(environment.API_HOST, {
				query: {
					idPlayer: this.idGame + C.EVENT,
					idGame: this.idGame,
				},
			});
		});
	}

	ngAfterViewInit() {
		this.socket.on(this.idGame + C.EVENT, async (data: any) => {
			this.events.push(data.event);
		});
		this.socket.on(this.idGame + C.NEW_FEEDBACK, async (data: any) => {
			window.location.reload();
		});
	}

	async initDatasets() {
		// Initialize empty dataset for each player with a running total
		const players = _.sortBy(this.players, 'name');
		_.forEach(players, player => {
			this.datasets.set(
				player._id,
				{
					data: [],
					label: player.name,
					backgroundColor: hexToRgb(player.hairColor),
					borderColor: hexToRgb(player.hairColor),
					pointBackgroundColor: hexToRgb(player.hairColor),
					pointBorderColor: hexToRgb(player.hairColor),
					borderWidth: 2, // Line thickness
					pointRadius: 0.8, // Point thickness
					// @ts-ignore
					total: 0,
				});

			this.datasetsRelatif.set(
				player._id,
				{
					data: [],
					label: player.name,
					backgroundColor: hexToRgb(player.hairColor),
					borderColor: hexToRgb(player.hairColor),
					pointBackgroundColor: hexToRgb(player.hairColor),
					pointBorderColor: hexToRgb(player.hairColor),
					borderWidth: 2, // Line thickness
					pointRadius: 0.8, // Point thickness
					// @ts-ignore
					total: 0,
				});
			this.datasetsResources.set(
				player._id,
				{
					data: [],
					label: player.name,
					backgroundColor: hexToRgb(player.hairColor),
					borderColor: hexToRgb(player.hairColor),
					pointBackgroundColor: hexToRgb(player.hairColor),
					pointBorderColor: hexToRgb(player.hairColor),
					borderWidth: 2, // Line thickness
					pointRadius: 0.8, // Point thickness
					// @ts-ignore
					total: 0,
				});
		});
		if (this.game?.typeMoney == C.DEBT) {
			this.datasets.set(
				C.BANK,
				{
					data: [],
					label: this.bankName,
					backgroundColor: hexToRgb("#000000"),
					borderColor: hexToRgb("#000000"),
					pointBackgroundColor: hexToRgb("#000000"),
					pointBorderColor: hexToRgb("#000000"),
					borderWidth: 2, // Line thickness
					pointRadius: 0.8, // Point thickness
					// @ts-ignore
					total: 0,
				});
		}
		this.datasets.set(
			"masseMoney",
			{
				data: [],
				label: this.massMonetaryName,
				backgroundColor: hexToRgb("#000000"),
				borderColor: hexToRgb("#000000"),
				pointBackgroundColor: hexToRgb("#000000"),
				pointBorderColor: hexToRgb("#000000"),
				borderWidth: 2, // Line thickness
				pointRadius: 0.8, // Point thickness
				// @ts-ignore
				total: 0,
			});
		// this.datasetsRelatif.set(
		//   "masseMoney",
		//   {
		//     data: [],
		//     label: this.MassMonetaryName,
		//     backgroundColor: hexToRgb("#000000"),
		//     borderColor: hexToRgb("#000000"),
		//     pointBackgroundColor: hexToRgb("#000000"),
		//     pointBorderColor:hexToRgb("#000000"),
		//     borderWidth: 2, // Line thickness
		//     pointRadius: 0.8, // Point thickness
		//     @ts-ignore
		// total: 0,
		// });
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
			const data = _.map(feedback, (count, key) => {
				return {x: index, y: parseInt(key), r: Math.log(count * 2) * 6, count: count}
			});
			return {
				data: data,
				type: 'bubble',
				backgroundColor: getRandomColor()
			}
		});

		this.feedbacksData = {
			// @ts-ignore
			datasets: this.datasetsFeedback
		};
	}

	getValueCardsFromEvent(event: EventGeco) {
		return _.reduce(event.resources, function (sum, card) {
			return sum + card.price;
		}, 0);
	}

	addEventsToDatasets(unsortedEvents: EventGeco[]) {
		const events = _.sortBy(unsortedEvents, 'date');

		// Iterate over each event
		for (const event of events) {
			let totalResourcesEvent = 0; //here only because of switch case don't want same name many places
			const mmDataset = this.datasets.get("masseMoney");
			// let mmDatasetRelatif = this.datasetsRelatif.get("masseMoney");
			const emitterDataset = this.datasets.get(event.emitter);
			const emitterDatasetRelatif = this.datasetsRelatif.get(event.emitter);
			const emitterDatasetResources = this.datasetsResources.get(event.emitter);
			const receiverDataset = this.datasets.get(event.receiver);
			const receiverDatasetRelatif = this.datasetsRelatif.get(event.receiver);
			const receiverDatasetResources = this.datasetsResources.get(event.receiver);

			const updateData = (dataset: any, date: string | Date, operator: "add" | "sub" | "new", value: number, relatif: boolean, beforePoint: boolean) => {
				if (dataset) {
					const previousTotal = dataset.total;
					let newTotal = 0;
					if (operator == "add") {
						newTotal = previousTotal + value;
					} else if (operator == "sub") {
						newTotal = previousTotal - value;
					} else {
						newTotal = value;
					}
					if (beforePoint) {
						addPointBefore1second(dataset, date, relatif ? (previousTotal / this.currentDU) : previousTotal);
					}
					addPointAtEvent(dataset, date, relatif ? (newTotal / this.currentDU) : newTotal);
					dataset.total = newTotal;
				}
			}
			const addPointBefore1second = (dataset: any, date: string | Date, value: number) => {
				// @ts-ignore before
				dataset.data.push({
					// @ts-ignore before
					x: subSeconds(parseISO(date), 1),
					// @ts-ignore before
					y: value
				});
			}
			const addPointAtEvent = (dataset: any, date: string | Date, value: any) => {
				// @ts-ignore
				dataset.data.push({x: date, y: value});
			}

			switch (event.typeEvent) {
				case C.START_GAME:
					this.startGameDate = event.date;
					continue;
				case C.END_GAME:
					this.stopGameDate = event.date;
					continue;
				case C.START_ROUND:
					this.roundStarted = true;
					continue;
				case C.STOP_ROUND:
					continue;
				case C.FIRST_DU:
					this.currentDU = event.amount;
					this.initialDU = event.amount;
					continue;
				case C.INIT_DISTRIB:
					totalResourcesEvent = this.getValueCardsFromEvent(event);
					this.initialMM += event.amount;
					this.initialResources += totalResourcesEvent;
					updateData(mmDataset, event.date, "add", event.amount, false, false);
					updateData(receiverDatasetResources, event.date, "add", totalResourcesEvent, false, false);
					updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					if (this.game?.typeMoney == C.JUNE && receiverDatasetRelatif) {
						updateData(receiverDatasetRelatif, event.date, "add", event.amount, true, false);
					}
					continue;
				case C.DISTRIB_DU:
					this.currentDU = event.amount;
					updateData(mmDataset, event.date, "add", event.amount, false, false);
					updateData(receiverDataset, event.date, "add", event.amount, false, false);
					updateData(receiverDatasetRelatif, event.date, "add", event.amount, true, false);
					continue;
				case C.TRANSACTION:
					totalResourcesEvent = this.getValueCardsFromEvent(event);
					updateData(emitterDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(emitterDatasetRelatif, event.date, "sub", event.amount, true, this.pointsBefore1second);
					updateData(emitterDatasetResources, event.date, "add", totalResourcesEvent, false, this.pointsBefore1second);

					updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					updateData(receiverDatasetRelatif, event.date, "add", event.amount, true, this.pointsBefore1second);
					updateData(receiverDatasetResources, event.date, "sub", totalResourcesEvent, false, this.pointsBefore1second);
					continue;
				case C.TRANSFORM_DISCARDS:
					totalResourcesEvent = this.getValueCardsFromEvent(event);
					if (emitterDatasetResources) {
						// @ts-ignore
						emitterDatasetResources.total -= totalResourcesEvent;
					}
					// no update data to avoid weird graph up and down too quickly
					continue;
				case C.TRANSFORM_NEWCARDS:
					totalResourcesEvent = this.getValueCardsFromEvent(event);
					// no before point , same reason as transform_discards
					updateData(receiverDatasetResources, event.date, "add", totalResourcesEvent, false, false);
					continue;
				case C.DEAD:
					if (receiverDatasetResources) {
						// @ts-ignore
						addPointBefore1second(receiverDatasetResourcesevent.date, receiverDatasetResources.total);
						addPointAtEvent(receiverDatasetResources, event.date, 0);
					}
					continue;
				case C.REMIND_DEAD:
					// @ts-ignore
					receiverDatasetResources.data.push({x: event.date, y: 0});
					continue;
				case C.NEW_CREDIT:
					if (!this.roundStarted) {
						this.initialMM += event.amount;
					}
					updateData(mmDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					continue;
				case C.SETTLE_CREDIT:
					updateData(mmDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(emitterDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					continue;
				case C.PAY_INTEREST:
					updateData(mmDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(emitterDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					continue;
				default:
			}
		}

		// Remove the 'total' property from each dataset ? datasets.forEach(dataset => delete dataset.total);
		this.lineChartData = {
			datasets: [...this.datasets.values()]
		};
		this.lineChartDataRelatif = {
			datasets: [...this.datasetsRelatif.values()]
		};
		this.lineChartDataResources = {
			datasets: [...this.datasetsResources.values()]
		};
	}

	getBestPlayers() {
		this.datasets.forEach((dataset, key) => {
			if (dataset.label != this.massMonetaryName && dataset.label != this.bankName) {
				const lastPointValue = dataset.data[dataset.data.length - 1];
				// @ts-ignore
				if (lastPointValue && lastPointValue.y > this.maxLastPointMoney) {
					// @ts-ignore
					this.maxLastPointMoney = lastPointValue.y;
					this.bestPlayerOnMoneyId = key;
				}
			}
		});
		this.datasetsResources.forEach((dataset, key) => {
			const lastPointValue = dataset.data[dataset.data.length - 1];
			// @ts-ignore
			this.finalResources += lastPointValue.y;
			// @ts-ignore
			if (lastPointValue && lastPointValue.y > this.maxLastPointRes) {
				// @ts-ignore
				this.maxLastPointRes = lastPointValue.y;
				this.bestPlayerOnResId = key;
			}
		});

		const transactionEvents = _.filter(this.events, e => e.typeEvent == C.TRANSACTION);
		if (transactionEvents.length > 0) {
			const transactionPlayers = _.countBy(transactionEvents, e => e.emitter);
			this.bestPlayerOnTransactionId = Object.entries(transactionPlayers).reduce((a, b) => a[1] > b[1] ? a : b)[0];
		}
		this.bestPlayerOnMoney = _.find(this.players, {_id: this.bestPlayerOnMoneyId});
		this.bestPlayerOnRes = _.find(this.players, {_id: this.bestPlayerOnResId});
		this.bestPlayerOnTransaction = _.find(this.players, {_id: this.bestPlayerOnTransactionId});
	}

	getSanitizedSvgFromString(svgString: string | undefined): SafeHtml {
		return svgString ? this.sanitizer.bypassSecurityTrustHtml(svgString) : "";
	}

	getInitialResourcesInDU(resources: number) {
		if ((this.game?.priceWeight1)) {
			return resources / this.game.priceWeight1;
		} else {
			return "-";
		}
	}
}
