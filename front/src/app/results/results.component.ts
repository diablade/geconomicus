import {AfterViewInit, ChangeDetectorRef, Component, OnInit, QueryList, ViewChildren} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {BackService} from "../services/back.service";
import io from "socket.io-client";
import {Card, EventGeco, Feedback, Game, Player} from "../models/game";
import * as _ from 'lodash-es';
import {environment} from "../../environments/environment";
import {getRandomColor, hexToRgb} from "../services/tools";
// @ts-ignore
import * as C from "../../../../config/constantes";

import {ChartConfiguration, ChartDataset} from 'chart.js';
import 'chartjs-adapter-date-fns';
import {parseISO, subSeconds} from 'date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import Chart from 'chart.js/auto';
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {BaseChartDirective} from "ng2-charts";
import {Platform} from "@angular/cdk/platform";

Chart.register(zoomPlugin);

interface LastPointValue {
	key: string;
	value: number;
	label: string | undefined;
}

function externalTooltip(context: any) {
	// Tooltip Element
	let tooltipEl = document.getElementById('chartjs-tooltip');

	// <h6 class="m-1 contour ">Répartition monnaie</h6>

	let {chart, tooltip} = context;
	// console.log(tooltip);
	// console.log("value: " + tooltip.dataPoints[0].raw);
	// console.log("label: " + tooltip.dataPoints[0].dataset.label);
	// console.log("color: " + tooltip.dataPoints[0].dataset.backgroundColor);
	if (tooltip) {

		let totalMM = 0;//100% MassMonetary
		let totalUM = 0;//100% MassMonetary
		let totalPCT = 0;//100% MassMonetary
		let data = tooltip.dataPoints
			.map((point: any) => {
				if (point.dataset.label === "Masse monétaire") {
					totalMM = point.raw.y;
				} else {
					totalUM += point.raw.y;
				}

				const t = {
					color: point.dataset.backgroundColor,
					value: point.raw.y,
					label: point.dataset.label,
				};
				// console.log(t.label, t.value, t.color);
				return t;
			})
			.filter((p: any) => p.label !== "Masse monétaire")
			.map((p: any) => {
				const pct = _.round(((p.value / totalMM) * 100), 2);
				totalPCT += pct
				const t = {
					...p,
					value: pct,
				};
				console.log(t.label, t.value, t.color);
				return t;
			});

		console.log("total pct", totalPCT);
		console.log("MM", totalMM);
		console.log("UM", totalUM);
		let display = false;
		if (_.round(totalMM, 1) === _.round(totalUM, 1)) {
			display = true;
		}

		function generatePieChart(data: any) {
			let start = 0;
			const gradientValues = data.map((slice: any, index: any) => {
				const end = start + slice.value;
				const value = `${slice.color} ${start}% ${end}%`;
				start = end;
				return value;
			}).join(', ');
			const sliceElements = data.map((slice: any, index: any) => {
				const angle = (start + slice.value / 2) * 3.6; // convert percentage to degrees
				const labelX = 50 + 45 * Math.cos(Math.PI * angle / 180); // X coordinate
				const labelY = 50 + 45 * Math.sin(Math.PI * angle / 180); // Y coordinate
				start += slice.value;
				return ` <div class="slice" style="left: ${labelX}%; top: ${labelY}%; transform: translate(-50%, -50%);"><span>${slice.label} (${slice.value}%)</span> </div> `;
			}).join('');
			return ` <div class="pie-chart" style="background: conic-gradient(${gradientValues});"> ${sliceElements} </div> `;
		}

		const pieChartHTML = ` <style>
 .pie-chart { width: 200px; height: 200px; border-radius: 50%; position: relative; }
 .slice { position: absolute; font-size: 8px; font-weight: bold; color: black; text-align: center; }
 .slice span { display: inline-block; } </style>
${generatePieChart(data)} `;

		// Create element on first render
		if (!tooltipEl) {
			tooltipEl = document.createElement('div');
			tooltipEl.id = 'chartjs-tooltip';

			tooltipEl.innerHTML = pieChartHTML
			document.body.appendChild(tooltipEl);
		} else {
			tooltipEl.innerHTML = pieChartHTML
		}

		// Hide if no tooltip
		if (tooltip.opacity === 0 || !display) {
			// @ts-ignore
			tooltipEl.style.opacity = 0;
			return;
		} else {
			// @ts-ignore
			tooltipEl.style.opacity = 1;
		}

		// Set caret Position
		tooltipEl.classList.remove('above', 'left', 'no-transform');
		if (tooltip.yAlign) {
			tooltipEl.classList.add(tooltip.yAlign);
		} else {
			tooltipEl.classList.add('no-transform');
		}

		// Set Text
		const position = context.chart.canvas.getBoundingClientRect();

		// Display, position, and set styles for font
		tooltipEl.style.opacity = String(1);
		tooltipEl.style.position = 'absolute';
		tooltipEl.style.width = '200px';
		tooltipEl.style.height = '200px';
		tooltipEl.style.background = 'white';
		tooltipEl.style.left = position.left + window.pageXOffset + tooltip.caretX + 'px';
		tooltipEl.style.top = position.top + window.pageYOffset + tooltip.caretY + 'px';
		tooltipEl.style.pointerEvents = 'none';
	}
}

@Component({
	selector: 'app-results',
	templateUrl: './results.component.html',
	styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit, AfterViewInit {
	private socket: any;
	idGame = "";

	game: Game | undefined;
	events: EventGeco[] = [];
	players: Player[] = [];
	@ViewChildren(BaseChartDirective) charts: QueryList<BaseChartDirective> | undefined;
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
	moneyDestroyed = 0;
	initialResources = 0;
	initialCards = 0;
	finalCards = 0;
	finalResources = 0;
	productionTotal = 0;
	startGameDate: Date | undefined;
	stopGameDate: Date | undefined;
	roundStarted = false;
	pointsBefore1second = true;
	C = C;
	baseRadius = 2.1;
	nbPlayer = 0;
	playersAtStart = 0;
	deads = 0;

	podiumMoney: Player[] = [];
	podiumRes: Player[] = [];
	podiumTransac: Player[] = [];

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
				tension: 0,
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
		interaction: {
			mode: 'x',
			// mode: 'index',
			// axis:'x',
			// intersect: false,
		},
		plugins: {
			tooltip: {
				enabled: true,	// Disable the on-canvas tooltip
				external: externalTooltip,
				// mode: 'x',
				// mode: 'index',
				// axis:'x',
				// intersect: false,
			},
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
				tension: 0,
			},
		},
		interaction: {
			mode: 'x',
			// mode: 'nearest',
			// axis:'x',
			intersect: true,
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
				tension: 0,
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
		"(Positif 😊)  Trés",
		"Assez",
		"Un peu",
		"neutre",
		"Un peu",
		"Assez",
		"(Négatif 😒)  Trés"];
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

	constructor(private route: ActivatedRoute,
							private platform: Platform,
							private router: Router,
							private sanitizer: DomSanitizer,
							private cdr: ChangeDetectorRef,
							private backService: BackService) {
	}

	ngOnInit(): void {
		this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			this.backService.getGame(this.idGame).subscribe(async game => {
				this.game = game;
				this.events = game.events;
				this.players = game.players;
				this.podiumMoney = [];
				if (this.lineChartOptions && this.lineChartOptions.scales && this.lineChartOptions.scales['y']) {
					this.lineChartOptions.scales['y'].type = this.game.typeMoney == C.JUNE ? 'logarithmic' : 'linear';
				}
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

	//
	// onMouseMove(event: MouseEvent): void {
	// 	const canvas = event.target as HTMLCanvasElement;
	// 	const context = canvas.getContext('2d');
	// 	if (context) {
	// 		const points = (context.chart as any).getElementsAtEventForMode(event, 'index', {intersect: false}, true);
	// 		if (points.length) {
	// 			const firstPoint = points[0];
	// 			const x = firstPoint.element.x;
	// 			this.drawVerticalLine(context, x);
	// 		}
	// 	}
	// }

	ngAfterViewInit() {
		this.socket.on(C.EVENT, async (event: EventGeco) => {
			this.events.push(event);
			this.addEventsToDatasets([event]);
			this.updateCharts();
		});
		this.socket.on(C.NEW_FEEDBACK, async () => {
			this.getFeedbacks();
		});
		this.addEventListenerToCanvas('chartQuant');
	}

	addEventListenerToCanvas(canvasId: string): void {
		const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
		const context = canvas.getContext('2d');
		const chart = Chart.getChart(canvas);

		if (canvas && chart && context) {
			canvas.addEventListener('mousemove', (event) => {
				const points = chart.getElementsAtEventForMode(event, 'index', {intersect: false}, true);
				if (points.length) {
					const firstPoint = points[0];
					const x = firstPoint.element.x;
					this.drawVerticalLine(chart, context, x);
				}
			});
		}
	}

	drawVerticalLine(chart: Chart, ctx: CanvasRenderingContext2D, x: number): void {
		const chartArea = chart.chartArea;
		ctx.save();
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear previous drawings
		ctx.beginPath();
		ctx.moveTo(x, chartArea.top);
		ctx.lineTo(x, chartArea.bottom);
		ctx.lineWidth = 1;
		ctx.strokeStyle = '#000000';
		ctx.stroke();
		ctx.restore();
		chart.update('none');
	}

	updateCharts() {
		this.charts?.forEach(chart => {
			chart.render();
			chart.update();
		});
	}

	getFeedbacks() {
		this.backService.getFeedbacks(this.idGame).subscribe(data => {
			this.initFeedbacks(data.feedbacks);
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
					// pointBackgroundColor: hexToRgb(player.hairColor),
					pointBackgroundColor: hexToRgb("#ffffff"),
					pointBorderColor: hexToRgb(player.hairColor),
					pointStyle: "circle",
					hoverBorderWidth: 4,
					borderWidth: 2, // Line thickness
					pointRadius: 1, // Point thickness
					// pointRadius: 0.8, // Point thickness
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
					pointStyle: "circle",
					hoverBorderWidth: 4,
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
					stepped: "before",
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
					backgroundColor: hexToRgb("#ffffff"),
					borderColor: hexToRgb("#000000"),
					pointBackgroundColor: hexToRgb("#ffffff"),
					pointBorderColor: hexToRgb("#000000"),
					borderWidth: 4, // Line thickness
					pointRadius: 1, // Point thickness
					// @ts-ignore
					total: 0,
				});
			this.datasetsResources.set(
				C.BANK,
				{
					data: [],
					label: this.bankName,
					backgroundColor: hexToRgb("#ffffff"),
					borderColor: hexToRgb("#000000"),
					pointBackgroundColor: hexToRgb("#ffffff"),
					pointBorderColor: hexToRgb("#000000"),
					borderWidth: 4, // Line thickness
					pointRadius: 1, // Point thickness
					stepped: "before",
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
				borderDash: [1, 0, 1],
				pointBackgroundColor: hexToRgb("#000000"),
				pointBorderColor: hexToRgb("#000000"),
				borderWidth: 2, // Line thickness
				pointRadius: 0.8, // Point thickness
				// @ts-ignore
				total: 0,
			});

		const playersWithFeedbacks = _.filter(this.players, p => p.survey != undefined);
		const feedbacks = _.map(playersWithFeedbacks, p => p.survey);
		this.initFeedbacks(feedbacks);
	}

	initFeedbacks(feedbacks: (Feedback | undefined)[]) {
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

	getValueCardsFromEvent(cards: Card[]) {
		return _.reduce(cards, function (sum, card) {
			return sum + card.price; // € or DU
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

			// update all data in dataset quantitatif
			const updateAllDatas = (exceptKeyDataset: string[], date: string | Date, operator: "add" | "sub" | "new" | "prev", value: number, relatif: boolean, beforePoint: boolean) => {
				for (const [key, dataset] of this.datasets) {
					if (!exceptKeyDataset.some(k => k === key)) {
						updateData(dataset, date, operator, value, relatif, beforePoint);
					}
				}
			}

			const updateData = (dataset: any, date: string | Date, operator: "add" | "sub" | "new" | "prev", value: number, relatif: boolean, beforePoint: boolean) => {
				if (dataset) {
					const previousTotal = dataset.total;
					let newTotal = 0;
					if (operator == "add") {
						newTotal = previousTotal + value;
					} else if (operator == "sub") {
						newTotal = previousTotal - value;
					} else if (operator == "prev") {
						newTotal = previousTotal;
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
				// @ts-ignore
				dataset.data.push({
					// @ts-ignore
					x: subSeconds(parseISO(date), 1),
					// @ts-ignore
					y: value
				});
			}
			const addPointAtEvent = (dataset: any, date: string | Date, value: any) => {
				// @ts-ignore
				dataset.data.push({x: date, y: value});
			}

			switch (event.typeEvent) {
				case C.NEW_PLAYER:
					this.playersAtStart++;
					continue;
				case C.START_GAME:
					this.startGameDate = event.date;
					continue;
				case C.END_GAME:
					this.stopGameDate = event.date;
					continue;
				case C.START_ROUND:
					this.roundStarted = true;
					this.finalCards += this.initialCards;
					continue;
				case C.STOP_ROUND:
					continue;
				case C.FIRST_DU:
					this.currentDU = event.amount;
					this.initialDU = event.amount;
					continue;
				case C.INIT_DISTRIB:
					totalResourcesEvent = this.getValueCardsFromEvent(event.resources);
					this.initialMM += event.amount;
					this.initialResources += totalResourcesEvent;
					this.initialCards += event.resources.length;
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
					totalResourcesEvent = this.getValueCardsFromEvent(event.resources);
					updateData(emitterDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(emitterDatasetRelatif, event.date, "sub", event.amount, true, this.pointsBefore1second);
					updateData(emitterDatasetResources, event.date, "add", totalResourcesEvent, false, false);

					updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					updateData(receiverDatasetRelatif, event.date, "add", event.amount, true, this.pointsBefore1second);
					updateData(receiverDatasetResources, event.date, "sub", totalResourcesEvent, false, false);
					updateAllDatas([event.emitter, event.receiver], event.date, "prev", 0, false, false);
					continue;
				case C.TRANSFORM_DISCARDS:
					totalResourcesEvent = this.getValueCardsFromEvent(event.resources);
					if (emitterDatasetResources) {
						// @ts-ignore
						emitterDatasetResources.total -= totalResourcesEvent;
					}
					this.finalCards -= event.resources.length;
					// no update data to avoid weird graph up and down too quickly
					continue;
				case C.TRANSFORM_NEWCARDS:
					totalResourcesEvent = this.getValueCardsFromEvent(event.resources);
					// no before point , same reason as transform_discards
					updateData(receiverDatasetResources, event.date, "add", totalResourcesEvent, false, false);
					this.finalCards += event.resources.length;
					this.productionTotal += 1;
					continue;
				case C.DEAD:
					this.deads++;
					const deadRessources = this.getValueCardsFromEvent(event.resources);
					updateData(receiverDatasetResources, event.date, "new", deadRessources, false, false);
					updateData(receiverDataset, event.date, "prev", 0, false, false);
					updateData(receiverDatasetRelatif, event.date, "prev", 0, true, false);
					updateAllDatas([event.emitter, event.receiver], event.date, "prev", 0, false, false);
					continue;
				case C.REMIND_DEAD:
					// @ts-ignore
					updateData(receiverDataset, event.date, "prev", 0, false, false);
					updateData(receiverDatasetRelatif, event.date, "prev", 0, true, false);
					updateData(receiverDatasetResources, event.date, "prev", 0, false, false);
					updateAllDatas([event.emitter, event.receiver], event.date, "prev", 0, false, false);
					continue;
				case C.NEW_CREDIT:
					if (!this.roundStarted) {
						this.initialMM += event.amount;
						this.initialDebts += (event.amount + event.resources[0].interest);
					}
					updateData(mmDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					updateAllDatas([event.emitter, event.receiver], event.date, "prev", 0, false, false);
					continue;
				case C.SETTLE_CREDIT:
					const interest = event.resources[0].interest;
					this.moneyDestroyed += event.amount;
					updateData(mmDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(emitterDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(receiverDataset, event.date, "add", interest, false, this.pointsBefore1second);
					updateAllDatas([event.emitter, event.receiver], event.date, "prev", 0, false, false);
					continue;
				case C.PAYED_INTEREST:
					updateData(mmDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(emitterDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					updateAllDatas([event.emitter, event.receiver], event.date, "prev", 0, false, false);
					continue;
				case C.SEIZURE:
					const seizureRessources = this.getValueCardsFromEvent(event.resources);
					updateData(mmDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(emitterDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					updateData(emitterDatasetResources, event.date, "sub", seizureRessources, false, false);
					updateData(receiverDatasetResources, event.date, "add", seizureRessources, false, false);
					updateAllDatas([event.emitter, event.receiver], event.date, "prev", 0, false, false);
					continue;
				case C.SEIZED_DEAD:
					const seizedItems = event.resources[0];
					const seizedRessources = this.getValueCardsFromEvent(seizedItems.cards);
					updateData(mmDataset, event.date, "sub", event.amount, false, this.pointsBefore1second);
					updateData(receiverDataset, event.date, "add", event.amount, false, this.pointsBefore1second);
					updateData(emitterDataset, event.date, "sub", seizedItems.interest, false, this.pointsBefore1second);
					updateData(emitterDatasetResources, event.date, "sub", seizedRessources, false, false);
					updateData(receiverDatasetResources, event.date, "add", seizedRessources, false, false);
					updateAllDatas([event.emitter, event.receiver], event.date, "prev", 0, false, false);
					continue;
				case C.PRISON_ENDED:
					let outOfPrisonRessources = this.getValueCardsFromEvent(event.resources);
					if (!outOfPrisonRessources) {
						outOfPrisonRessources = this.getValueCardsFromEvent(event.resources[0]);
					}
					updateData(receiverDatasetResources, event.date, "add", outOfPrisonRessources, false, false);
					continue;
				default:
					continue;
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
		this.getBestPlayersMoney();
		this.getBestPlayersRessources();
		this.getBestPlayersTransactions();
	}

	getBestPlayersMoney() {
		let allLastPoints: LastPointValue[] = [];
		this.datasets.forEach((dataset, key) => {
			if (dataset.label != this.massMonetaryName && dataset.label != this.bankName) {
				const lastPointValue = dataset.data[dataset.data.length - 1];
				// @ts-ignore
				if (lastPointValue && lastPointValue.y) {
					// @ts-ignore
					allLastPoints.push({key: key, value: lastPointValue.y, label: dataset.label});
				}
			}
		});
		const merged = this.mergedReincarnatePlayers(allLastPoints)
		const podiumMo = _.orderBy(merged, 'value', 'desc');

		this.podiumMoney = _.map(podiumMo, p => {
			let playerFound = _.find(this.players, {_id: p.key});
			if (playerFound) {
				return playerFound;
			}
			return new Player();
		});
	}

	getBestPlayersRessources() {
		let allLastPoints: LastPointValue[] = [];
		this.datasetsResources.forEach((dataset, key) => {
			if (dataset.label != this.massMonetaryName && dataset.label != this.bankName) {
				const lastPointValue = dataset.data[dataset.data.length - 1];
				// @ts-ignore
				if (lastPointValue && lastPointValue.y) {
					// @ts-ignore
					this.finalResources += lastPointValue.y;
					// @ts-ignore
					allLastPoints.push({key: key, value: lastPointValue.y, label: dataset.label});
				}
			}
		});

		const merged = this.mergedReincarnatePlayers(allLastPoints);
		const podiumR = _.orderBy(merged, 'value', 'desc');

		this.podiumRes = _.map(podiumR, p => {
			let playerFound = _.find(this.players, {_id: p.key});
			if (playerFound) {
				return playerFound;
			}
			return new Player();
		});
	}

	getBestPlayersTransactions() {
		const transactionEvents = _.filter(this.events, e => e.typeEvent == C.TRANSACTION);
		if (transactionEvents.length > 0) {
			const transactionPlayers = _.countBy(transactionEvents, e => e.emitter);

			const transactionPlayersArray = _.toPairs(transactionPlayers);
			const sortedPlayers = _.orderBy(transactionPlayersArray, [1], ['desc']);

			this.podiumTransac = _.map(sortedPlayers, ([playerId]) => {
				let playerFound = _.find(this.players, {_id: playerId});
				return playerFound || new Player();  // Return player object or a default Player if not found
			});
		}
	}

	mergedReincarnatePlayers(allLastPoints: LastPointValue[]): LastPointValue[] {
		return _.reduce(allLastPoints, (cumul: LastPointValue[], current) => {
			const currentPlayer = _.find(this.players, p => p._id === current.key);
			if (currentPlayer && currentPlayer.reincarnateFromId) {
				const cumulPlayer = _.find(cumul, p => p.key === currentPlayer.reincarnateFromId);
				if (cumulPlayer) {
					cumulPlayer.value += current.value;
				} else {
					cumul.push({key: currentPlayer.reincarnateFromId, value: current.value, label: currentPlayer.name});
				}
			} else if (currentPlayer && !currentPlayer.reincarnateFromId) {
				// If current player is not reincarnate,
				const cumulPlayer = _.find(cumul, p => p.key === currentPlayer._id);
				if (cumulPlayer) {
					// if value already exist update it
					cumulPlayer.value += current.value;
				} else {
					cumul.push({...current});
				}
			}
			return cumul;
		}, []);
	}

	getSanitizedSvgFromString(svgString: string | undefined): SafeHtml {
		return svgString ? this.sanitizer.bypassSecurityTrustHtml(svgString) : "";
	}

	getTransactionsTotal() {
		return _.filter(this.events, e => e.typeEvent == C.TRANSACTION).length;
	}

	newGame() {
		if (this.platform.ANDROID || this.platform.IOS) {
			this.router.navigate(['/']);
		} else {
			window.open(environment.WEB_HOST, '_blank');
		}
	}
}
