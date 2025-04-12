import {Component, OnInit, AfterViewInit, ElementRef, ViewChild} from '@angular/core';
import {Chart, Point} from 'chart.js';
import * as _ from 'lodash-es';
import {Router} from "@angular/router";


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

@Component({
	selector: 'app-module-galileo',
	templateUrl: './module-galileo.component.html',
	styleUrls: ['./module-galileo.component.scss']
})
export class ModuleGalileoComponent implements OnInit, AfterViewInit {
	duration = 80;
	growthRate = 5;
	initialFirstMember = 100;
	initialMass = 1000000;
	initialMembers = 10;
	gini = 1;
	distributionMode: 'equal' | 'linear' | 'gini' = 'gini';
	actionYear = 10;
	removeMemberId = 1;
	txFrom = 0;
	txTo = 0;
	txAmount = 50;
	actionMemberId = 0;

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
		this.executeSimulationFromStart();
	}

	executeSimulationFromStart() {
		this.events = [];
		this.actionYear = 10;
		this.removeMemberId = 1;
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
		this.growthRate = 5;
		this.initialFirstMember = 100;
		this.initialMass = 1000000;
		this.initialMembers = 10;
		this.gini = 1;
		this.distributionMode = 'gini';
		this.actionYear = 10;
		this.removeMemberId = 1;
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
		const shares = this.buildSharesInitialAmount(this.initialMass, this.initialMembers, this.distributionMode, this.gini);
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
		this.events.push(new Event("add", this.actionYear, 0, 0, 0));
		const member = new Member(this.members.length + 1, 0);
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
				borderColor: `hsl(${member.id * 36}, 70%, 50%)`,
				tension: 0.1,
				pointRadius: 0,
				borderWidth: 1
			});
		}
		return datasets;
	}

	buildDatasetsFromYearsRelatif(): any[] {
		const datasets = [];
		for (const member of this.members) {
			const data = this.years.map(year => {
				const mem = year.members.find(m => m.id === member.id);
				return mem ? (mem.amount / year.du) : undefined;
			});
			datasets.push({
				label: member.id,
				data,
				fill: false,
				borderColor: `hsl(${member.id * 36}, 70%, 50%)`,
				tension: 0.1,
				pointRadius: 0,
				borderWidth: 1
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
				plugins: {
					legend: {display: false},
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
					legend: {display: false},
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
		mode: 'equal' | 'linear' | 'gini',
		gini = 0.5
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
			case 'gini':
				if (memberCount === 1) {
					shares = [amount];
					break;
				}
				const weightsGini = Array.from({length: memberCount}, (_, i) =>
					Math.pow(i + 1, gini * 2) // L'implémentation originale
				);
				const total = weightsGini.reduce((a, b) => a + b, 0);
				if (total === 0) { // Cas où tous les poids sont 0 (ne devrait pas arriver avec cette formule)
					shares = Array(memberCount).fill(0);
				} else {
					shares = weightsGini.map(w => parseFloat(((w / total) * amount).toFixed(2)));
				}
				break;
		}

		return shares;
	}

	updateCharts() {
		// Relancer les graphiques après modification
		if (this.relativeChart && this.quantitativeChart) {
			this.quantitativeChart.data.datasets = this.buildDatasetsFromYears();
			this.relativeChart.data.datasets = this.buildDatasetsFromYearsRelatif();
			this.quantitativeChart.update();
			this.relativeChart.update();
		}
	}

	home() {
		this.router.navigate(['home']);
	}
}

