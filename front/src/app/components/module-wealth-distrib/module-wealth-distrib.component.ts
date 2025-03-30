// import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
// import { Chart, registerables } from 'chart.js';
// // Enregistrer tous les contrôleurs, éléments, etc. de Chart.js
// Chart.register(...registerables);
//
// @Component({
//   selector: 'app-module-wealth-distrib',
//   templateUrl: './module-wealth-distrib.component.html',
//   styleUrls: ['./module-wealth-distrib.component.scss']
// })
// export class ModuleWealthDistribComponent implements OnInit {
// 	// Paramètres pour la distribution
// 	paramP: number = 1.2;
// 	total: number = 1000;
// 	numPlayers: number = 10;
//
// 	// Variables pour le graphique
// 	distributionChart: any;
// 	currentChartType: string = 'bar';
//
// 	// Résultats calculés
// 	distribution: number[] = [];
// 	giniIndex: number = 0;
// 	ratioTopBottom: number = 0;
//
// 	// Pour le tableau des résultats
// 	tableData: Array<{player: string, amount: number, percentage: number}> = [];
//
// 	@ViewChild('distributionCanvas') distributionCanvas!: ElementRef;
//
// 	constructor() { }
//
// 	ngOnInit(): void {
// 		// L'initialisation du graphique est déplacée vers ngAfterViewInit
// 	}
//
// 	ngAfterViewInit(): void {
// 		this.initChart();
// 		this.updateChart();
// 	}
//
// 	// Fonction de distribution de richesse
// 	distributeInitialWealth(total: number, numPlayers: number, P: number): number[] {
// 		let harmonicSum = 0;
// 		// Calcul de la somme harmonique généralisée
// 		for (let i = 1; i <= numPlayers; i++) {
// 			harmonicSum += 1 / Math.pow(i, P);
// 		}
// 		// Distribution des montants
// 		let distribution = [];
// 		for (let i = 1; i <= numPlayers; i++) {
// 			let share = (total / harmonicSum) * (1 / Math.pow(i, P));
// 			distribution.push(share);
// 		}
// 		return distribution;
// 	}
//
// 	// Calculer l'indice de Gini
// 	calculateGiniIndex(distribution: number[]): number {
// 		const n = distribution.length;
// 		if (n === 0) return 0;
//
// 		let sumOfAbsoluteDifferences = 0;
// 		let sum = 0;
//
// 		for (let i = 0; i < n; i++) {
// 			sum += distribution[i];
// 			for (let j = 0; j < n; j++) {
// 				sumOfAbsoluteDifferences += Math.abs(distribution[i] - distribution[j]);
// 			}
// 		}
//
// 		return sumOfAbsoluteDifferences / (2 * n * n * (sum / n));
// 	}
//
// 	// Initialisation du graphique
// 	initChart(): void {
// 		const ctx = this.distributionCanvas.nativeElement.getContext('2d');
// 		this.distributionChart = new Chart(ctx, {
// 		// @ts-ignore
// 			type: this.currentChartType,
// 			data: {
// 				labels: [],
// 				datasets: [{
// 					label: 'Distribution de Richesse',
// 					data: [],
// 					backgroundColor: [],
// 					borderColor: 'rgba(0, 123, 255, 1)',
// 					borderWidth: 1
// 				}]
// 			},
// 			options: {
// 				responsive: true,
// 				maintainAspectRatio: false,
// 				scales: {
// 					y: {
// 						beginAtZero: true,
// 						title: {
// 							display: true,
// 							text: 'Montant'
// 						}
// 					},
// 					x: {
// 						title: {
// 							display: true,
// 							text: 'Joueur'
// 						}
// 					}
// 				}
// 			}
// 		});
// 	}
//
// 	// Mettre à jour le graphique
// 	updateChart(): void {
// 		// Calculer la distribution
// 		this.distribution = this.distributeInitialWealth(this.total, this.numPlayers, this.paramP);
//
// 		// Préparer les données pour le graphique
// 		const labels = Array.from({length: this.numPlayers}, (_, i) => `Joueur ${i+1}`);
// 		const colors = [];
//
// 		// Générer des couleurs en fonction de la richesse (plus riche = plus foncé)
// 		for (let i = 0; i < this.numPlayers; i++) {
// 			const intensity = 100 - (i / this.numPlayers) * 70;
// 			colors.push(`hsla(210, 100%, ${intensity}%, 0.7)`);
// 		}
//
// 		// Mettre à jour le graphique
// 		this.distributionChart.data.labels = labels;
// 		this.distributionChart.data.datasets[0].data = this.distribution;
// 		this.distributionChart.data.datasets[0].backgroundColor = colors;
//
// 		// Adapter les options en fonction du type de graphique
// 		if (this.currentChartType === 'line') {
// 			this.distributionChart.data.datasets[0].fill = false;
// 			this.distributionChart.data.datasets[0].tension = 0.1;
// 		} else if (this.currentChartType === 'pie') {
// 			this.distributionChart.options.scales = {
// 				y: {
// 					display: false
// 				},
// 				x: {
// 					display: false
// 				}
// 			};
// 		} else {
// 			this.distributionChart.options.scales = {
// 				y: {
// 					beginAtZero: true,
// 					title: {
// 						display: true,
// 						text: 'Montant'
// 					}
// 				},
// 				x: {
// 					title: {
// 						display: true,
// 						text: 'Joueur'
// 					}
// 				}
// 			};
// 		}
//
// 		this.distributionChart.update();
//
// 		// Mettre à jour le tableau de résultats
// 		this.updateResultsTable();
//
// 		// Calculer et afficher les statistiques
// 		this.giniIndex = this.calculateGiniIndex(this.distribution);
// 		this.ratioTopBottom = this.distribution[0] / this.distribution[this.distribution.length - 1];
// 	}
//
// 	// Mettre à jour le tableau de résultats
// 	updateResultsTable(): void {
// 		this.tableData = [];
//
// 		this.distribution.forEach((amount, index) => {
// 			const percentage = (amount / this.total) * 100;
// 			this.tableData.push({
// 				player: `Joueur ${index + 1}`,
// 				amount: amount,
// 				percentage: percentage
// 			});
// 		});
// 	}
//
// 	// Changer le type de graphique
// 	changeChartType(type: string): void {
// 		this.currentChartType = type;
// 		if (this.distributionChart) {
// 			this.distributionChart.destroy();
// 		}
// 		this.initChart();
// 		this.updateChart();
// 	}
//
// 	// Méthodes pour les événements de changement de valeur des sliders
// 	onParamPChange(event: any): void {
// 		this.paramP = parseFloat(event.target.value);
// 		this.updateChart();
// 	}
//
// 	onTotalChange(event: any): void {
// 		this.total = parseFloat(event.target.value);
// 		this.updateChart();
// 	}
//
// 	onNumPlayersChange(event: any): void {
// 		this.numPlayers = parseInt(event.target.value);
// 		this.updateChart();
// 	}
// }


import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, ChartConfiguration } from 'chart.js';

@Component({
	selector: 'app-module-wealth-distrib',
	template: `
    <div class="container">
      <h1>La Fabrique de la Richesse 💰</h1>

      <div class="controls">
        <div class="control-group">
          <label for="paramP">Niveau d'Inégalité (P): {{ paramP.toFixed(1) }}</label>
          <input type="range" id="paramP"
            [(ngModel)]="paramP"
            (ngModelChange)="updateDistribution()"
            min="0" max="3" step="0.1">
        </div>

        <div class="control-group">
          <label for="total">Montant Total: {{ total }}</label>
          <input type="range" id="total"
            [(ngModel)]="total"
            (ngModelChange)="updateDistribution()"
            min="100" max="10000" step="100">
        </div>

        <div class="control-group">
          <label for="numPlayers">Nombre de Joueurs: {{ numPlayers }}</label>
          <input type="range" id="numPlayers"
            [(ngModel)]="numPlayers"
            (ngModelChange)="updateDistribution()"
            min="2" max="20" step="1">
        </div>
      </div>

      <div class="chart-container">
        <canvas #distributionChart></canvas>
      </div>

      <div class="game-explanation">
        <h3>Comment fonctionne la Répartition ? 🌈</h3>
        <p>
          1. Le montant total est réparti différemment selon le paramètre P. 💸<br>
          2. Un P bas signifie une répartition plus égale. 🤝<br>
          3. Un P élevé crée plus de différences entre les joueurs. 📊
        </p>
      </div>

      <div class="stats">
        <p>Indice de Gini: {{ giniIndex.toFixed(4) }}</p>
        <p>Ratio Haut/Bas: {{ ratioTopBottom.toFixed(2) }}</p>
      </div>
    </div>
  `,
	styles: [`
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .controls {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }
    .control-group {
      flex: 1;
    }
    .chart-container {
      background-color: white;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      height: 400px;
    }
    @media (max-width: 768px) {
      .controls {
        flex-direction: column;
      }
    }
  `]
})
export class ModuleWealthDistribComponent implements OnInit {
	@ViewChild('distributionChart') distributionChart!: ElementRef;

	paramP: number = 1.2;
	total: number = 1000;
	numPlayers: number = 10;

	giniIndex: number = 0;
	ratioTopBottom: number = 0;

	private chartInstance: Chart | null = null;

	ngOnInit() {
		this.updateDistribution();
	}

	updateDistribution() {
		// Distribution logic would be implemented here similar to the original HTML
		// For brevity, I'm showing a placeholder
		console.log('Updating distribution with:', {
			paramP: this.paramP,
			total: this.total,
			numPlayers: this.numPlayers
		});
	}
}
