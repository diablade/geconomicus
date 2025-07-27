import {Component, OnInit, AfterViewInit, ElementRef, ViewChild} from '@angular/core';
import {Chart, Point} from 'chart.js';
import * as _ from 'lodash-es';
import {Router} from "@angular/router";
import 'chartjs-adapter-date-fns';
import {faCircleInfo} from "@fortawesome/free-solid-svg-icons";


class Year {
	public du = 0;
	public members: Member[] = []
	public events: Event[] = []
}

class Member {
	public id = 0;
	public amount = 0;
	public receiveDU = true;

	constructor(id: number, amount?: number) {
		this.id = id;
		this.amount = amount ?? 0;
	}
}

class Event {
	public type = "";
	public amount = 0;
	public from = 0;
	public to = 0;
	public at = 0;

	constructor(type: string, at: number, amount: number, from: number, to: number) {
		this.type = type;
		this.amount = amount;
		this.from = from ?? 0;
		this.to = to ?? 0;
		this.at = at;
	}
}

interface TooltipPoint {
	label: string
	date: Date;
	value: number;
	color: string;
}

function filterMostRecent(data: any[]): TooltipPoint[] {
	const map = new Map<string, TooltipPoint>();

	data.forEach(item => {
		const existing = map.get(item.label);
		if (!existing || new Date(item.date) > new Date(existing.date)) {
			map.set(item.label, item);
		}
	});

	return Array.from(map.values());
}

// Position du tooltip
function positionTooltip(context: any, tooltipEl: HTMLElement, tooltipModel: any) {
	const position = context.chart.canvas.getBoundingClientRect();
	let left = position.left + window.scrollX + tooltipModel.caretX;
	let top = position.top + window.scrollY + tooltipModel.caretY;

	const tooltipWidth = tooltipEl.offsetWidth;
	const tooltipHeight = tooltipEl.offsetHeight;
	const windowWidth = window.innerWidth;
	const windowHeight = window.innerHeight;

	// Vérifie si le tooltip dépasse à droite et ajuste
	if ((left + tooltipWidth) > windowWidth) {
		left -= tooltipWidth;
	}
	// Vérifie si le tooltip dépasse en bas et ajuste
	if ((top + tooltipHeight) > windowHeight) {
		top -= tooltipHeight;
	}

	tooltipEl.style.left = `${left}px`;
	tooltipEl.style.top = `${top}px`;
	tooltipEl.style.opacity = '1';
}


function externalTooltip(context: any, legendQuantitative: boolean) {
	let tooltipEl = document.getElementById('custom-tooltip');

	// Si le tooltip n'existe pas, on le crée
	if (!tooltipEl) {
		tooltipEl = document.createElement('div');
		tooltipEl.id = 'custom-tooltip';
		tooltipEl.style.position = 'absolute';
		tooltipEl.style.background = 'white';
		tooltipEl.style.width = '190px';
		tooltipEl.style.border = '2px solid black';
		tooltipEl.style.pointerEvents = 'none';
		tooltipEl.style.borderRadius = '10px';
		tooltipEl.style.padding = '5px';
		tooltipEl.style.boxShadow = '2px 2px 10px rgba(0,0,0,0.2)';
		tooltipEl.style.display = 'flex';
		tooltipEl.style.flexDirection = 'column';
		tooltipEl.style.justifyContent = 'center';
		tooltipEl.style.alignItems = 'center';

		// Ajout du canvas pour le pie chart
		const canvas = document.createElement('canvas');
		canvas.id = 'tooltip-chart';
		canvas.width = 100;
		tooltipEl.appendChild(canvas);

		// Ajout des values
		const values = document.createElement('div');
		values.id = 'tooltip-values';
		tooltipEl.appendChild(values);

		document.body.appendChild(tooltipEl);
	}

	const tooltipModel = context.tooltip;
	if (!tooltipModel || tooltipModel.opacity === 0) {
		tooltipEl.style.opacity = '0';
		return;
	}

	// Position du tooltip
	positionTooltip(context, tooltipEl, tooltipModel);

	// Récupération des valeurs du dataset
	if (tooltipModel.dataPoints) {
		const dataRaw = tooltipModel.dataPoints;
		const points = _.map(dataRaw, (item: any): TooltipPoint => ({
			value: item.raw,
			date: item.label,
			label: item.dataset.label,
			color: item.dataset.backgroundColor,
		}));

		const values = points.map(item => item.value);
		const colors = points.map(item => item.color);
		drawPieChart(values, colors);
		if (legendQuantitative) {
			addValues(points);
		}
	}
}

// Fonction pour dessiner le pie chart dans le tooltip
function drawPieChart(values: number[], colors: any[]) {
	const canvas = document.getElementById('tooltip-chart') as HTMLCanvasElement;
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	// Vérification et suppression de l'ancien graphique
	const existingChart = Chart.getChart(canvas);
	if (existingChart) {
		existingChart.destroy();
	}
	// Création du pie chart
	new Chart(ctx, {
		type: 'pie',
		data: {
			labels: values.map((_, i) => `Valeur ${i + 1}`),
			datasets: [{
				data: values,
				backgroundColor: colors,
			}]
		},
		options: {
			responsive: false,
			animation: false,
			maintainAspectRatio: false,
			plugins: {
				legend: {display: false},
			}
		}
	});
}

// Fonction pour ajouter les values dans le tooltip
function addValues(points: TooltipPoint[]) {
	const div = document.getElementById('tooltip-values');
	if (!div) return;

	div.innerHTML = '';
	points.forEach(point => {
		const entry = document.createElement('div');
		entry.style.display = 'flex';
		entry.style.alignItems = 'center';

		const colorBox = document.createElement('span');
		colorBox.style.width = '10px';
		colorBox.style.height = '10px';
		colorBox.style.backgroundColor = point.color;
		colorBox.style.marginRight = '5px';
		document.createElement('span');

		const text = document.createElement('span');
		text.innerText = `${point.label}: ${Math.round(point.value)}`;

		entry.appendChild(colorBox);
		entry.appendChild(text);
		div.appendChild(entry);
	});
}


@Component({
	selector: 'app-module-galileo',
	templateUrl: './module-galileo.component.html',
	styleUrls: ['./module-galileo.component.scss']
})
export class ModuleGalileoComponent implements OnInit, AfterViewInit {
	duration = 80;
	growthRate = 10;
	initialMass = 1000000;
	initialMembers = 10;
	pareto = 0.5;
	distributionMode: 'equal' | 'linear' | 'pareto' = 'pareto';
	actionYear = 10;
	removeMemberId = 0;
	txFrom = 0;
	txTo = 0;
	txAmount = 50;
	actionMemberId = 0;
	legendQuantitative = true;
	legendRelative = true;

	events: Event[] = [];
	years: Year[] = [];
	members: Member[] = [];

	//les graphiques
	@ViewChild('quantitativeCanvas') quantitativeCanvas!: ElementRef<HTMLCanvasElement>;
	@ViewChild('relativeCanvas') relativeCanvas!: ElementRef<HTMLCanvasElement>;
	quantitativeChart!: Chart<"line", (number | Point | null)[], number>;
	relativeChart!: Chart<"line", (number | Point | null)[], number>;

	constructor(private router: Router) {
	}

	ngOnInit() {
		this.initYearsAndInitMembers();
	}

	ngAfterViewInit(): void {
		this.createCharts();
		this.resetSimulation();

		// Ajouter ces lignes à la fin
		setTimeout(() => {
			if (this.quantitativeChart && this.relativeChart) {
				this.quantitativeChart.update();
				this.relativeChart.update();
			}
		}, 100);
	}

	executeSimulationFromStart() {
		this.events = [];
		this.actionYear = 10;
		this.removeMemberId = 0;
		this.txFrom = 0;
		this.txTo = 0;
		this.txAmount = 50;
		this.events = [];
		this.years = [];
		this.actionMemberId = 0;
		this.members = [];
		this.initYearsAndInitMembers();
		this.distributeDU();
		this.updateCharts();
	}

	executeSimulation() {
		this.distributeDU();
		this.updateCharts();
	}

	resetSimulation() {
		this.duration = 80;
		this.growthRate = 10;
		this.initialMass = 1000000;
		this.initialMembers = 10;
		this.pareto = 0.5;
		this.distributionMode = 'pareto';
		this.actionYear = 10;
		this.removeMemberId = 0;
		this.txFrom = 0;
		this.txTo = 0;
		this.txAmount = 50;
		this.events = [];
		this.years = [];
		this.actionMemberId = 0;
		this.members = [];
		this.executeSimulationFromStart();
	}

	initYearsAndInitMembers() {
		this.members = Array.from({length: this.initialMembers}, (_, i) => new Member(i + 1));
		const shares = this.buildSharesInitialAmount(this.initialMass, this.initialMembers, this.distributionMode, this.pareto);
		for (let y = 0; y < this.duration; y++) {
			let newYear = new Year();
			let members = [];
			if (y == 0) {
				members = Array.from({length: this.initialMembers}, (_, i) => new Member(i + 1, shares[i]));
			} else {
				members = Array.from({length: this.initialMembers}, (_, i) => new Member(i + 1, 0));
			}
			newYear.members = members;
			this.years.push(newYear);
		}
	}

	addMember(): void {
		const member = new Member(this.members.length + 1, 0);
		this.events.push(new Event("add", this.actionYear, 0, member.id, 0));
		this.members.push(member);
		for (let y = 0; y < this.years.length; y++) {
			if (y >= (this.actionYear - 1)) {
				this.years[y].members.push(_.clone(member));
			}
		}
		this.executeSimulation();
	}

	removeMember(): void {
		this.events.push(new Event("sup", this.actionYear, 0, 0, this.removeMemberId));
		this.years.forEach((y, index) => {
			if (index >= (this.actionYear - 1)) {
				_.update(y, 'members[' + (this.removeMemberId - 1) + '].receiveDU', () => false);
			}
		});
		this.executeSimulation();
	}

	addTransaction(): void {
		let event = new Event("tra", this.actionYear, this.txAmount, this.txFrom, this.txTo);
		this.events.push(event);
		this.years[this.actionYear - 1].events.push(event);
		this.executeSimulation();
	}

	buildDatasetsFromYears(): any[] {
		const datasets = [];
		for (const member of this.members) {
			const data = this.years.map(year => {
				const mem = year.members.find(m => m.id === member.id);
				return mem ? mem.amount : undefined;
			});
			datasets.push({
				label: member.id,
				data,
				fill: false,
				tension: 0.1,
				backgroundColor: `hsl(${member.id * 36}, 70%, 50%)`,
				borderColor: `hsl(${member.id * 36}, 70%, 50%)`,
				pointBackgroundColor: `hsl(${member.id * 36}, 70%, 50%)`,
				pointBorderColor: `hsl(${member.id * 36}, 70%, 50%)`,
				pointStyle: "circle",
				hoverBorderWidth: 4,
				borderWidth: 2,
				pointRadius: 0.8,
			});
		}
		return datasets;
	}

	buildDatasetsFromYearsRelatif(): any[] {
		const datasets = [];
		for (const member of this.members) {
			const data = this.years.map(year => {
				const mm = year.members.reduce((m, mem) => mem.amount + m, 0);
				const mem = year.members.find(m => m.id === member.id);
				return mem ? (mem.amount / mm) * 100 : undefined;
			});
			datasets.push({
				label: member.id,
				data,
				fill: false,
				tension: 0.1,
				backgroundColor: `hsl(${member.id * 36}, 70%, 50%)`,
				borderColor: `hsl(${member.id * 36}, 70%, 50%)`,
				pointBackgroundColor: `hsl(${member.id * 36}, 70%, 50%)`,
				pointBorderColor: `hsl(${member.id * 36}, 70%, 50%)`,
				pointStyle: "circle",
				hoverBorderWidth: 4,
				borderWidth: 2,
				pointRadius: 0.8,
			});
		}
		return datasets;
	}

	createCharts(): void {
		const ctx1 = this.quantitativeCanvas.nativeElement;
		const ctx2 = this.relativeCanvas.nativeElement;

		this.quantitativeChart = new Chart(ctx1, {
			type: 'line',
			options: {
				responsive: true,
				animation: false,
				maintainAspectRatio: true,
				interaction: {
					mode: 'x',
				},
				plugins: {
					tooltip: {
						enabled: false,
						animation: false,
						external: (context: any) => externalTooltip(context, this.legendQuantitative),
					},
					legend: {display: this.legendQuantitative},
				},
				scales: {
					y: {
						type: 'logarithmic',
						// beginAtZero: false, // let Chart.js auto-fit the min
					},
					x: {
						type: 'linear', // or 'category' based on your labels
					}
				},
			},
			data: {
				labels: Array.from({length: this.duration}, (_, i) => i + 1),
				datasets: []
			}
		});

		this.relativeChart = new Chart(ctx2, {
			type: 'line',
			options: {
				responsive: true,
				animation: false,
				maintainAspectRatio: true,
				plugins: {
					legend: {display: this.legendRelative},
				},
			},
			data: {
				labels: Array.from({length: this.duration}, (_, i) => i + 1),
				datasets: []
			}
		});
	}

	distributeDU() {
		for (let y = 0; y < this.years.length; y++) {
			//distribute DU for this year
			if (y > 0) {
				const DU = this.years[(y - 1)].du;

				this.years[y].members.forEach(m => {
					const prm = this.years[y - 1].members.find(pm => pm.id == m.id);
					m.amount = prm?.amount ?? 0;
					if (m.receiveDU) {
						m.amount += DU;
					}
				});
			}
			//DO transactions if available
			this.years[y].events.forEach(e => {
				if (e.type === 'tra' && (e.at - 1) === (y) && e.from && e.to && e.amount) {
					_.update(this.years[y], 'members[' + (e.from - 1) + '].amount', (prevAmount) => prevAmount - e.amount);
					_.update(this.years[y], 'members[' + (e.to - 1) + '].amount', (prevAmount) => prevAmount + e.amount);
				}
			});
			//calulate DU for next year
			let mm = 0;
			let memberCount = 0;
			this.years[y].members.forEach(m => {
				mm += m.amount;
				if (m.receiveDU) {
					memberCount++;
				}
			});
			const moy = mm / memberCount;
			const du = moy * (this.growthRate / 100);
			this.years[y].du = parseFloat(du.toFixed(2));
		}
	}

	buildSharesInitialAmount(
		amount: number,
		memberCount: number,
		mode: 'equal' | 'linear' | 'pareto',
		pareto = 0.5
	): number[] {
		if (memberCount <= 0) return [];

		let shares: number[] = [];

		switch (mode) {
			case 'equal':
				shares = Array(memberCount).fill(amount / memberCount);
				break;
			case 'linear':
				// Poids = [1, 2, 3, ..., n]
				const weights = Array.from({length: memberCount}, (_, i) => i + 1);
				const totalWeight = weights.reduce((a, b) => a + b, 0);
				shares = weights.map(w => parseFloat((amount * w / totalWeight).toFixed(2)));
				break;
			case 'pareto':
				if (memberCount <= 0) {
					memberCount = 2;
				}
				const alpha = 1 / (1 - pareto);
				const ranks = Array.from({length: memberCount}, (_, i) => (i + 1) / memberCount);
				const invPareto = ranks.map(r => Math.pow(r, alpha));
				const total = invPareto.reduce((acc, val) => acc + val, 0);
				const distribution = invPareto.map(x => (x / total) * amount);
				shares = distribution;
				break;
		}

		return shares;
	}

	displayLegendRelative() {
		this.legendRelative = !this.legendRelative;
		if (this.relativeChart && this.relativeChart.options && this.relativeChart.options.plugins && this.relativeChart.options.plugins.legend) {
			this.relativeChart.options.plugins.legend.display = this.legendRelative;
			this.relativeChart.update();
		}
	}

	displayLegendQuantitative() {
		this.legendQuantitative = !this.legendQuantitative;
		if (this.quantitativeChart && this.quantitativeChart.options && this.quantitativeChart.options.plugins && this.quantitativeChart.options.plugins.legend) {
			this.quantitativeChart.options.plugins.legend.display = this.legendQuantitative;
			this.quantitativeChart.update();
		}
	}

	updateCharts() {
		// Relancer les graphiques après modification
		if (this.relativeChart && this.quantitativeChart) {
			// Update the labels array based on the current duration
			const labels = Array.from({length: this.duration}, (_, i) => i);

			this.quantitativeChart.data.labels = labels;
			this.relativeChart.data.labels = labels;

			this.quantitativeChart.data.datasets = this.buildDatasetsFromYears();
			this.relativeChart.data.datasets = this.buildDatasetsFromYearsRelatif();

			this.quantitativeChart.update();
			this.relativeChart.update();
		}
	}

	home() {
		this.router.navigate(['home']);
	}

	protected readonly faCircleInfo = faCircleInfo;
}
