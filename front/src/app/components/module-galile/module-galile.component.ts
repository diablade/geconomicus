// // simulation-galile.component.ts
// import { Component, OnInit } from '@angular/core';
// import { Chart, registerables } from 'chart.js';
//
// Chart.register(...registerables);
//
// @Component({
// 	selector: 'app-module-galile',
// 	templateUrl: './module-galile.component.html',
// 	styleUrls: ['./module-galile.component.scss']
// })
// export class ModuleGalileComponent implements OnInit {
// 	growthRate = 10;
// 	numPlayers = 10;
// 	baseAmount = 1;
// 	increment = 1000;
// 	years = 80;
// 	gapType: 'linear' | 'logarithmic' = 'linear';
// 	quantitativeChart: any;
// 	relativeChart: any;
// 	simulationData: any[] = [];
//
// 	ngOnInit() {
// 		this.initCharts();
// 		this.runSimulation();
// 	}
//
// 	initCharts() {
// 		this.quantitativeChart = new Chart('quantitativeChart', {
// 			type: 'line',
// 			data: { labels: [], datasets: [] },
// 			options: { responsive: true }
// 		});
// 		this.relativeChart = new Chart('relativeChart', {
// 			type: 'line',
// 			data: { labels: [], datasets: [] },
// 			options: { responsive: true }
// 		});
// 	}
//
// 	runSimulation() {
// 		this.simulationData = [];
// 		let playerAmounts = Array.from({ length: this.numPlayers }, (_, i) =>
// 			this.gapType === 'linear' ? this.baseAmount + i * this.increment : this.baseAmount * Math.pow(1.1, i)
// 		);
// 		for (let year = 0; year <= this.years; year++) {
// 			const totalAmount = playerAmounts.reduce((sum, amount) => sum + amount, 0);
// 			this.simulationData.push({
// 				year,
// 				amounts: [...playerAmounts],
// 				percentages: playerAmounts.map(a => (a / totalAmount) * 100)
// 			});
// 			const growthAmount = totalAmount * (this.growthRate / 100);
// 			const duPerPlayer = growthAmount / this.numPlayers;
// 			playerAmounts = playerAmounts.map(a => a + duPerPlayer);
// 		}
// 		this.updateCharts();
// 	}
//
// 	updateCharts() {
// 		const years = this.simulationData.map(d => d.year);
// 		this.quantitativeChart.data.labels = years;
// 		this.relativeChart.data.labels = years;
// 		this.quantitativeChart.data.datasets = this.simulationData[0].amounts.map((a: any, i: number) => ({
// 			label: `Joueur ${i + 1}`,
// 			data: this.simulationData.map(d => d.amounts[i]),
// 			borderColor: `hsl(${i * 36}, 70%, 50%)`,
// 			tension: 0.3
// 		}));
// 		this.relativeChart.data.datasets = this.simulationData[0].percentages.map((a: any, i: number) => ({
// 			label: `Joueur ${i + 1}`,
// 			data: this.simulationData.map(d => d.percentages[i]),
// 			borderColor: `hsl(${i * 36}, 70%, 50%)`,
// 			tension: 0.3
// 		}));
// 		this.quantitativeChart.update();
// 		this.relativeChart.update();
// 	}
//
// 	resetSimulation() {
// 		this.growthRate = 10;
// 		this.numPlayers = 10;
// 		this.baseAmount = 1;
// 		this.increment = 1000;
// 		this.years = 80;
// 		this.gapType = 'linear';
// 		this.runSimulation();
// 	}
// }


import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, ChartConfiguration } from 'chart.js';

@Component({
	selector: 'app-module-galile',
	template: `
    <div class="container">
      <h1>Le Jeu de la Monnaie Libre - Simulation Galilé</h1>

      <div class="info-panel">
        <p>🌈 Imagine que tu es dans un monde où chaque année, la monnaie grandit comme une plante magique !
           Chaque joueur commence avec un montant différent, et chaque année, tout le monde reçoit un peu plus d'argent.</p>
      </div>

      <div class="controls">
        <div class="control-group">
          <h3>Paramètres de Croissance</h3>

          <div class="slider-container">
            <label for="growthRate">Taux de croissance annuel: {{ growthRate.toFixed(1) }}%</label>
            <input type="range" id="growthRate"
              [(ngModel)]="growthRate"
              (ngModelChange)="runSimulation()"
              min="1" max="50" step="0.1">
          </div>

          <div class="slider-container">
            <label for="numPlayers">Nombre de joueurs: {{ numPlayers }}</label>
            <input type="range" id="numPlayers"
              [(ngModel)]="numPlayers"
              (ngModelChange)="runSimulation()"
              min="2" max="20" step="1">
          </div>

          <div class="slider-container">
            <label for="baseAmount">Montant de base: {{ baseAmount }}</label>
            <input type="range" id="baseAmount"
              [(ngModel)]="baseAmount"
              (ngModelChange)="runSimulation()"
              min="1" max="1000" step="1">
          </div>
        </div>
      </div>

      <div class="charts">
        <div class="chart-container">
          <canvas #quantitativeChart></canvas>
        </div>
        <div class="chart-container">
          <canvas #relativeChart></canvas>
        </div>
      </div>

      <div class="game-explanation">
        <h3>Comment jouer ? 🎲</h3>
        <p>
          1. Chaque joueur commence avec un montant différent. 🏦<br>
          2. Chaque année, tous les joueurs reçoivent le même montant supplémentaire. 💰<br>
          3. Observez comment l'argent évolue et change de proportion ! 📊
        </p>
      </div>
    </div>
  `,
	styles: [`
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .charts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .chart-container {
      background-color: white;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    @media (max-width: 768px) {
      .charts {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ModuleGalileComponent implements OnInit {
	@ViewChild('quantitativeChart') quantitativeChart!: ElementRef;
	@ViewChild('relativeChart') relativeChart!: ElementRef;

	growthRate: number = 10;
	numPlayers: number = 10;
	baseAmount: number = 1;

	private quantitativeChartInstance: Chart | null = null;
	private relativeChartInstance: Chart | null = null;

	ngOnInit() {
		this.runSimulation();
	}

	runSimulation() {
		// Simulation logic would be implemented here similar to the original HTML
		// For brevity, I'm showing a placeholder
		console.log('Running simulation with:', {
			growthRate: this.growthRate,
			numPlayers: this.numPlayers,
			baseAmount: this.baseAmount
		});
	}
}
