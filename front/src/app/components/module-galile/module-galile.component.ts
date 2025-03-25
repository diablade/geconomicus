// simulation-galile.component.ts
import { Component, OnInit } from '@angular/core';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
	selector: 'app-module-galile',
	templateUrl: './module-galile.component.html',
	styleUrls: ['./module-galile.component.scss']
})
export class ModuleGalileComponent implements OnInit {
	growthRate = 10;
	numPlayers = 10;
	baseAmount = 1;
	increment = 1000;
	years = 80;
	gapType: 'linear' | 'logarithmic' = 'linear';
	quantitativeChart: any;
	relativeChart: any;
	simulationData: any[] = [];

	ngOnInit() {
		this.initCharts();
		this.runSimulation();
	}

	initCharts() {
		this.quantitativeChart = new Chart('quantitativeChart', {
			type: 'line',
			data: { labels: [], datasets: [] },
			options: { responsive: true }
		});
		this.relativeChart = new Chart('relativeChart', {
			type: 'line',
			data: { labels: [], datasets: [] },
			options: { responsive: true }
		});
	}

	runSimulation() {
		this.simulationData = [];
		let playerAmounts = Array.from({ length: this.numPlayers }, (_, i) =>
			this.gapType === 'linear' ? this.baseAmount + i * this.increment : this.baseAmount * Math.pow(1.1, i)
		);
		for (let year = 0; year <= this.years; year++) {
			const totalAmount = playerAmounts.reduce((sum, amount) => sum + amount, 0);
			this.simulationData.push({
				year,
				amounts: [...playerAmounts],
				percentages: playerAmounts.map(a => (a / totalAmount) * 100)
			});
			const growthAmount = totalAmount * (this.growthRate / 100);
			const duPerPlayer = growthAmount / this.numPlayers;
			playerAmounts = playerAmounts.map(a => a + duPerPlayer);
		}
		this.updateCharts();
	}

	updateCharts() {
		const years = this.simulationData.map(d => d.year);
		this.quantitativeChart.data.labels = years;
		this.relativeChart.data.labels = years;
		this.quantitativeChart.data.datasets = this.simulationData[0].amounts.map((a: any, i: number) => ({
			label: `Joueur ${i + 1}`,
			data: this.simulationData.map(d => d.amounts[i]),
			borderColor: `hsl(${i * 36}, 70%, 50%)`,
			tension: 0.3
		}));
		this.relativeChart.data.datasets = this.simulationData[0].percentages.map((a: any, i: number) => ({
			label: `Joueur ${i + 1}`,
			data: this.simulationData.map(d => d.percentages[i]),
			borderColor: `hsl(${i * 36}, 70%, 50%)`,
			tension: 0.3
		}));
		this.quantitativeChart.update();
		this.relativeChart.update();
	}

	resetSimulation() {
		this.growthRate = 10;
		this.numPlayers = 10;
		this.baseAmount = 1;
		this.increment = 1000;
		this.years = 80;
		this.gapType = 'linear';
		this.runSimulation();
	}
}
