import {Component, ViewChild, ElementRef, AfterViewInit} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import {Router} from "@angular/router";
// Enregistrer tous les contrôleurs, éléments, etc. de Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-module-wealth-distrib',
  templateUrl: './module-wealth-distrib.component.html',
  styleUrls: ['./module-wealth-distrib.component.scss']
})
export class ModuleWealthDistribComponent implements AfterViewInit {
	// Paramètres pour la distribution
	paramP = 1.2;
	total = 1000;
	numPlayers = 10;

	// Variables pour le graphique
	distributionChart: any;
	currentChartType = 'pie';

	// Résultats calculés
	distribution: number[] = [];
	giniIndex = 0;
	ratioTopBottom = 0;

	// Pour le tableau des résultats
	tableData: Array<{player: string, amount: number, percentage: number}> = [];

	@ViewChild('distributionCanvas') distributionCanvas!: ElementRef;

	constructor(private router:Router) { }

	ngAfterViewInit(): void {
		this.initChart();
		this.updateChart();
	}

	// Fonction de distribution de richesse
	distributeInitialWealth(total: number, numPlayers: number, P: number): number[] {
		let harmonicSum = 0;
		// Calcul de la somme harmonique généralisée
		for (let i = 1; i <= numPlayers; i++) {
			harmonicSum += 1 / Math.pow(i, P);
		}
		// Distribution des montants
		let distribution = [];
		for (let i = 1; i <= numPlayers; i++) {
			let share = (total / harmonicSum) * (1 / Math.pow(i, P));
			distribution.push(share);
		}
		return distribution;
	}

	// Calculer l'indice de Gini
	calculateGiniIndex(distribution: number[]): number {
		const n = distribution.length;
		if (n === 0) return 0;

		let sumOfAbsoluteDifferences = 0;
		let sum = 0;

		for (let i = 0; i < n; i++) {
			sum += distribution[i];
			for (let j = 0; j < n; j++) {
				sumOfAbsoluteDifferences += Math.abs(distribution[i] - distribution[j]);
			}
		}

		return sumOfAbsoluteDifferences / (2 * n * n * (sum / n));
	}

	// Fonction de simulation repartition euros
	onEurosClick(): void {
		this.paramP = 0.75;
		this.updateChart();
	}

	// Fonction de simulation repartition dollars
	onDollarsClick(): void {
		this.paramP = 1;
		this.updateChart();
	}

	// Fonction de simulation repartition bitcoin
	onBitcoinClick(): void {
		this.paramP = 2.6;
		this.updateChart();
	}

	// Initialisation du graphique
	initChart(): void {
		const ctx = this.distributionCanvas.nativeElement.getContext('2d');
		this.distributionChart = new Chart(ctx, {
		// @ts-ignore
			type: this.currentChartType,
			data: {
				labels: [],
				datasets: [{
					label: 'Distribution de Richesse',
					data: [],
					backgroundColor: [],
					borderColor: 'rgba(0, 123, 255, 1)',
					borderWidth: 1
				}]
			},
			options: {
				plugins: {
					legend: {display: false},
				},
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: 'Montant'
						}
					},
					x: {
						title: {
							display: true,
							text: 'Personne'
						}
					}
				}
			}
		});
	}

	// Mettre à jour le graphique
	updateChart(): void {
		// Calculer la distribution
		this.distribution = this.distributeInitialWealth(this.total, this.numPlayers, this.paramP);

		// Préparer les données pour le graphique
		const labels = Array.from({length: this.numPlayers}, (_, i) => `Personne ${i+1}`);
		const colors = [];

		// Générer des couleurs en fonction de la richesse (plus riche = plus foncé)
		for (let i = 0; i < this.numPlayers; i++) {
			const intensity = 100 - (i / this.numPlayers) * 70;
			colors.push(`hsla(210, 100%, ${intensity}%, 0.7)`);
		}

		// Mettre à jour le graphique
		this.distributionChart.data.labels = labels;
		this.distributionChart.data.datasets[0].data = this.distribution;
		this.distributionChart.data.datasets[0].backgroundColor = colors;

		// Adapter les options en fonction du type de graphique
		if (this.currentChartType === 'line') {
			this.distributionChart.data.datasets[0].fill = false;
			this.distributionChart.data.datasets[0].tension = 0.1;
		} else if (this.currentChartType === 'pie') {
			this.distributionChart.options.scales = {
				y: {
					display: false
				},
				x: {
					display: false
				}
			};
		} else {
			this.distributionChart.options.scales = {
				y: {
					beginAtZero: true,
					title: {
						display: true,
						text: 'Montant'
					}
				},
				x: {
					title: {
						display: true,
						text: 'Personne'
					}
				}
			};
		}

		this.distributionChart.update();

		// Mettre à jour le tableau de résultats
		this.updateResultsTable();

		// Calculer et afficher les statistiques
		this.giniIndex = this.calculateGiniIndex(this.distribution);
		this.ratioTopBottom = this.distribution[0] / this.distribution[this.distribution.length - 1];
	}

	// Mettre à jour le tableau de résultats
	updateResultsTable(): void {
		this.tableData = [];

		this.distribution.forEach((amount, index) => {
			const percentage = (amount / this.total) * 100;
			this.tableData.push({
				player: `Personne ${index + 1}`,
				amount: amount,
				percentage: percentage
			});
		});
	}

	// Changer le type de graphique
	changeChartType(type: string): void {
		this.currentChartType = type;
		if (this.distributionChart) {
			this.distributionChart.destroy();
		}
		this.initChart();
		this.updateChart();
	}

	// Méthodes pour les événements de changement de valeur des sliders
	onParamPChange(event: any): void {
		this.paramP = parseFloat(event.target.value);
		this.updateChart();
	}

	onTotalChange(event: any): void {
		this.total = parseFloat(event.target.value);
		this.updateChart();
	}

	onNumPlayersChange(event: any): void {
		this.numPlayers = parseInt(event.target.value);
		this.updateChart();
	}

	home() {
		this.router.navigate(['home']);
	}
}
