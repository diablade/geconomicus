import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';

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

  // Reference values for scaling
  minTotal = 100;
  maxTotal = 10000;
  minPieSize = 60;  // Pourcentage de la hauteur du conteneur
  maxPieSize = 90;  // Pourcentage de la hauteur du conteneur

  ngAfterViewInit(): void {
    // Enregistrer le plugin de zoom
    Chart.register(zoomPlugin);
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
          },
          plugins: {
            zoom: {
              zoom: {
                wheel: {
                  enabled: true,
                  modifierKey: 'ctrl',
                  speed: 1
                },
                pinch: {
                  enabled: true
                },
                mode: 'x'
              },
              pan: {
                enabled: true,
                mode: 'x'
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

  // Calculate pie chart size percentage based on total amount
  calculatePieSize(): number {
    // Linear scaling between minPieSize and maxPieSize based on total
    const ratio = (this.total - this.minTotal) / (this.maxTotal - this.minTotal);
    const sizePercentage = this.minPieSize + ratio * (this.maxPieSize - this.minPieSize);

    // Ensure size is within bounds
    return Math.max(this.minPieSize, Math.min(sizePercentage, this.maxPieSize));
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
      this.distributionChart.options.scales = {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Montant' }
        },
        x: {
          title: { display: true, text: 'Joueur' }
        }
      };
    } else if (this.currentChartType === 'pie') {
      this.distributionChart.options.scales = {
        y: { display: false },
        x: { display: false }
      };
      this.distributionChart.options.plugins.legend = {
        display: false
      };
      this.distributionChart.options.plugins.zoom = {
        zoom: {
          wheel: {
            enabled: false
          },
          pinch: {
            enabled: false
          }
        },
        pan: {
          enabled: false
        }
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
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: type !== 'pie'
            },
            tooltip: {
              callbacks: {
                label: function(context: any) {
                  const value = context.parsed;
                  const label = context.label || '';
                  if (type === 'pie') {
                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                    const percentage = (value / total * 100).toFixed(1);
                    return `${label}: ${value.toFixed(2)} (${percentage}%)`;
                  }
                  return `${label}: ${value.toFixed(2)}`;
                }
              }
            },
            zoom: {
              zoom: {
                wheel: {
                  enabled: type !== 'pie',
                  modifierKey: 'ctrl',
                  speed: 1
                },
                pinch: {
                  enabled: type !== 'pie'
                },
                mode: 'x'
              },
              pan: {
                enabled: type !== 'pie',
                mode: 'x'
              }
            }
          }
        }
      });

      this.updateChart();
    }
  }
}
