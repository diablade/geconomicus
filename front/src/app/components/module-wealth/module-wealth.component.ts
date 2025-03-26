import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-module-wealth',
  templateUrl: './module-wealth.component.html',
  styleUrls: ['./module-wealth.component.scss']
})
export class ModuleWealthComponent implements AfterViewInit {
  @ViewChild('distributionChart') chartCanvas!: ElementRef<HTMLCanvasElement>;

  // Default values
  paramP = 1.2;
  total = 1000;
  numPlayers = 10;

  // Chart properties
  distributionChart: any;
  currentChartType = 'bar';

  // Statistics
  giniIndex = 0;
  ratioTopBottom = 0;

  // Table data
  tableData: any[] = [];

  ngAfterViewInit(): void {
    this.initChart();
    this.updateChart();
  }

  // Initialize the chart
  initChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');

    if (ctx) {
      this.distributionChart = new Chart(ctx, {
        type: this.currentChartType as any,
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
                text: 'Joueur'
              }
            }
          }
        }
      });
    }
  }

  // Function to distribute wealth
  distributeInitialWealth(total: number, numPlayers: number, P: number): number[] {
    let harmonicSum = 0;
    // Calculate generalized harmonic sum
    for (let i = 1; i <= numPlayers; i++) {
        harmonicSum += 1 / Math.pow(i, P);
    }
    // Distribute amounts
    const distribution: number[] = [];
    for (let i = 1; i <= numPlayers; i++) {
        const share = (total / harmonicSum) * (1 / Math.pow(i, P));
        distribution.push(share);
    }
    return distribution;
  }

  // Calculate Gini index
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

  // Update the chart when sliders change
  updateChart(): void {
    // Calculate the distribution
    const distribution = this.distributeInitialWealth(this.total, this.numPlayers, this.paramP);

    // Prepare data for the chart
    const labels = Array.from({length: this.numPlayers}, (_, i) => `Joueur ${i+1}`);
    const colors: string[] = [];

    // Generate colors based on wealth (richer = darker)
    for (let i = 0; i < this.numPlayers; i++) {
      const intensity = 100 - (i / this.numPlayers) * 70;
      colors.push(`hsla(210, 100%, ${intensity}%, 0.7)`);
    }

    // Update the chart
    this.distributionChart.data.labels = labels;
    this.distributionChart.data.datasets[0].data = distribution;
    this.distributionChart.data.datasets[0].backgroundColor = colors;

    // Adapt options based on chart type
    if (this.currentChartType === 'line') {
      this.distributionChart.data.datasets[0].fill = false;
      this.distributionChart.data.datasets[0].tension = 0.1;
    } else if (this.currentChartType === 'pie') {
      this.distributionChart.options.scales = {
        y: { display: false },
        x: { display: false }
      };
    } else {
      this.distributionChart.options.scales = {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Montant' }
        },
        x: {
          title: { display: true, text: 'Joueur' }
        }
      };
    }

    this.distributionChart.update();

    // Update statistics
    this.giniIndex = this.calculateGiniIndex(distribution);
    this.ratioTopBottom = distribution[0] / distribution[distribution.length - 1];

    // Update table data
    this.updateTableData(distribution);
  }

  // Update table data
  updateTableData(distribution: number[]): void {
    this.tableData = [];

    distribution.forEach((amount, index) => {
      const percentage = (amount / this.total) * 100;
      this.tableData.push({
        player: `Joueur ${index + 1}`,
        amount: amount.toFixed(2),
        percentage: percentage.toFixed(2)
      });
    });
  }

  // Change chart type
  changeChartType(type: string): void {
    this.currentChartType = type;

    if (this.distributionChart) {
      this.distributionChart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');

    if (ctx) {
      this.distributionChart = new Chart(ctx, {
        type: type as any,
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
          responsive: true,
          maintainAspectRatio: false
        }
      });

      this.updateChart();
    }
  }
}
