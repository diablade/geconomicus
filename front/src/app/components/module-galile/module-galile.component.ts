import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import Chart from 'chart.js/auto';

interface Player {
  id: number;
  name: string;
  receivingDU: boolean;
  startYear: number;
  stopYear: number | null;
  initialAmount: number;
}

interface PlayerSnapshot {
  [key: number]: number;
}

interface PercentageMap {
  [key: number]: number;
}

interface SimulationYearData {
  year: number;
  amounts: PlayerSnapshot;
  percentages: PercentageMap;
  totalAmount: number;
  playerIds: number[];
}

@Component({
  selector: 'app-module-galile',
  templateUrl: './module-galile.component.html',
  styleUrls: ['./module-galile.component.scss']
})
export class ModuleGalileComponent implements AfterViewInit {
  @ViewChild('quantitativeChart') quantitativeChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('relativeChart') relativeChartCanvas!: ElementRef<HTMLCanvasElement>;

  // Default values as per requirements
  growthRate = 10; // 10%
  numPlayers = 10;
  baseAmount = 1;
  increment = 1000;
  years = 80;
  gapType = 'linear';

  // Player management
  players: Player[] = [];
  selectedPlayerId: number | null = null;
  newPlayerYear = 0;
  newPlayerAmount = 100;
  stopYear = 0;

  // Charts
  quantitativeChart: any;
  relativeChart: any;

  // Simulation data
  simulationData: SimulationYearData[] = [];
  simulationRunning = false;
  simulationTimeout: any = null;

  // Table data
  tableData: any[] = [];

  ngAfterViewInit(): void {
    this.initPlayers();
    this.initCharts();
    this.runSimulation();
  }

  // Initialize players
  initPlayers(): void {
    this.players = [];

    // Create initial players
    for (let i = 0; i < this.numPlayers; i++) {
      const initialAmount = this.gapType === 'linear'
        ? this.baseAmount + i * this.increment
        : this.baseAmount * Math.pow(1 + this.increment/100, i);

      this.players.push({
        id: i,
        name: `Joueur ${i + 1}`,
        receivingDU: true,
        startYear: 0,
        stopYear: null,
        initialAmount
      });
    }
  }

  // Helper method to get the currently selected player
  getSelectedPlayer(): Player | undefined {
    if (this.selectedPlayerId === null) {
      return undefined;
    }
    return this.players.find(p => p.id === this.selectedPlayerId);
  }

  // Initialize charts
  initCharts(): void {
    const quantitativeCtx = this.quantitativeChartCanvas.nativeElement.getContext('2d');
    const relativeCtx = this.relativeChartCanvas.nativeElement.getContext('2d');

    if (quantitativeCtx && relativeCtx) {
      // Configure quantitative chart (logarithmic)
      this.quantitativeChart = new Chart(quantitativeCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: []
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Évolution quantitative de la monnaie par joueur (échelle logarithmique)',
              font: { size: 16 }
            },
            tooltip: {
              mode: 'index',
              intersect: false
            },
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Années'
              }
            },
            y: {
              type: 'logarithmic',
              title: {
                display: true,
                text: 'Montant de monnaie (log)'
              },
              min: 1
            }
          }
        }
      });

      // Configure relative chart (percentage)
      this.relativeChart = new Chart(relativeCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: []
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Évolution de la proportion relative de monnaie par joueur',
              font: { size: 16 }
            },
            tooltip: {
              mode: 'index',
              intersect: false
            },
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Années'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Pourcentage (%)'
              },
              beginAtZero: true,
              min: 0
            }
          }
        }
      });
    }
  }

  // Main simulation function
  runSimulation(): void {
    // Avoid running multiple simulations at the same time
    if (this.simulationRunning) return;
    this.simulationRunning = true;

    try {
      // Convert growth rate to decimal
      const growthRateDecimal = this.growthRate / 100;

      // Initialize with active players at year 0
      const playerSnapshots: PlayerSnapshot = {};
      const initialPlayers = this.players.filter(p => p.startYear === 0);

      // Set up initial amounts
      initialPlayers.forEach(player => {
        playerSnapshots[player.id] = player.initialAmount;
      });

      // Reset simulation data
      this.simulationData = [];

      // Perform simulation over the specified period
      for (let year = 0; year <= this.years; year++) {
        // Add any new players that start at this year
        const newPlayers = this.players.filter(p => p.startYear === year && p.startYear > 0);
        newPlayers.forEach(player => {
          playerSnapshots[player.id] = player.initialAmount;
        });

        // All current players' IDs
        const currentPlayerIds = Object.keys(playerSnapshots).map(Number);

        // Calculate total amount for this year
        const totalAmount = currentPlayerIds.reduce((sum, id) => sum + playerSnapshots[id], 0);

        // Calculate percentages for each player
        const percentages: PercentageMap = {};
        currentPlayerIds.forEach(id => {
          percentages[id] = (playerSnapshots[id] / totalAmount) * 100;
        });

        // Store data for this year
        this.simulationData.push({
          year,
          amounts: {...playerSnapshots},
          percentages: {...percentages},
          totalAmount,
          playerIds: [...currentPlayerIds]
        });

        // Apply Universal Dividend (UD) for next year
        if (year < this.years) {
          const growthAmount = totalAmount * growthRateDecimal;
          // Number of players eligible to receive DU
          const activePlayers = this.players.filter(p => {
            return p.startYear <= year &&               // Player has started
                  (p.stopYear === null ||               // No stop year set
                   p.stopYear > year) &&                // Stop year is in the future
                  typeof playerSnapshots[p.id] !== 'undefined'; // Player exists in the simulation
          });

          const duReceivers = activePlayers.length;
          if (duReceivers > 0) {
            const duPerPlayer = growthAmount / duReceivers;

            // Update player amounts - only for those receiving DU
            activePlayers.forEach(player => {
              playerSnapshots[player.id] += duPerPlayer;
            });
          }
        }
      }

      // Update charts with new data
      this.updateCharts();

      // Update player table
      this.updatePlayerTable();
    } finally {
      this.simulationRunning = false;
    }
  }

  // Update charts with simulation data
  updateCharts(): void {
    // Get all player IDs that appear in the simulation
    const allPlayerIds = new Set<number>();
    this.simulationData.forEach(data => {
      data.playerIds.forEach(id => allPlayerIds.add(id));
    });

    const playerIds = Array.from(allPlayerIds).sort((a, b) => a - b);

    // Prepare data for charts
    const years = this.simulationData.map(data => data.year);

    // Reset charts
    this.quantitativeChart.data.labels = years;
    this.relativeChart.data.labels = years;

    this.quantitativeChart.data.datasets = [];
    this.relativeChart.data.datasets = [];

    // Generate colors for players
    const colors = this.generateColors(Math.max(this.players.length, playerIds.length));

    // Add data for each player
    playerIds.forEach((id: number) => {
      const player = this.players.find(p => p.id === id) || { name: `Joueur ${id + 1}` };

      // Quantitative data - handling missing data for years when player doesn't exist
      this.quantitativeChart.data.datasets.push({
        label: player.name,
        data: this.simulationData.map(data => {
          return data.playerIds.includes(id) ? data.amounts[id] : null;
        }),
        borderColor: colors[id % colors.length],
        backgroundColor: colors[id % colors.length] + '33',
        tension: 0.3,
        pointRadius: 1,
        spanGaps: true // Connect lines across gaps (missing data)
      });

      // Relative data (percentages)
      this.relativeChart.data.datasets.push({
        label: player.name,
        data: this.simulationData.map(data => {
          return data.playerIds.includes(id) ? data.percentages[id] : null;
        }),
        borderColor: colors[id % colors.length],
        backgroundColor: colors[id % colors.length] + '33',
        tension: 0.3,
        pointRadius: 1,
        spanGaps: true
      });
    });

    // Add total to quantitative chart
    this.quantitativeChart.data.datasets.push({
      label: 'Total',
      data: this.simulationData.map(data => data.totalAmount),
      borderColor: '#000000',
      backgroundColor: '#00000033',
      borderWidth: 2,
      borderDash: [5, 5],
      tension: 0.3,
      pointRadius: 0
    });

    // Adjust chart scales
    this.updateScales();

    // Update charts
    this.quantitativeChart.update();
    this.relativeChart.update();
  }

  // Adjust chart scales based on data
  updateScales(): void {
    if (this.simulationData.length === 0) return;

    // Find min and max for quantitative chart
    let minAmount = Infinity;
    let maxAmount = -Infinity;

    this.simulationData.forEach(data => {
      data.playerIds.forEach((id: number) => {
        const amount = data.amounts[id];
        if (amount > 0 && amount < minAmount) minAmount = amount;
        if (amount > maxAmount) maxAmount = amount;
      });
      if (data.totalAmount > maxAmount) maxAmount = data.totalAmount;
    });

    // Adjust logarithmic scale
    if (minAmount !== Infinity && maxAmount !== -Infinity) {
      // Round min to lower ten to avoid values too close to 0
      minAmount = Math.max(1, Math.floor(minAmount / 10) * 10);
      // Round max to upper hundred for margin
      maxAmount = Math.ceil(maxAmount / 100) * 100;

      // Update logarithmic scale
      this.quantitativeChart.options.scales.y.min = minAmount;
    }

    // Find min and max for percentages (relative chart)
    let minPercentage = Infinity;
    let maxPercentage = -Infinity;

    this.simulationData.forEach(data => {
      data.playerIds.forEach((id: number) => {
        const percentage = data.percentages[id];
        if (percentage < minPercentage) minPercentage = percentage;
        if (percentage > maxPercentage) maxPercentage = percentage;
      });
    });

    // Adjust relative chart scale
    if (minPercentage !== Infinity && maxPercentage !== -Infinity) {
      // Round min to 0 (to start at 0)
      this.relativeChart.options.scales.y.min = 0;

      // Round max to upper 5% for margin
      const adjustedMax = Math.ceil(maxPercentage / 5) * 5;
      this.relativeChart.options.scales.y.max = adjustedMax;

      // If maximum exceeds 100%, adjust accordingly
      if (adjustedMax > 100) {
        this.relativeChart.options.scales.y.max = adjustedMax;
      }
    }
  }

  // Update player table
  updatePlayerTable(): void {
    if (this.simulationData.length === 0) return;

    this.tableData = [];

    const initialData = this.simulationData[0];
    const finalData = this.simulationData[this.simulationData.length - 1];

    // All players that appear in the simulation
    const allPlayerIds = new Set<number>();
    this.simulationData.forEach(data => {
      data.playerIds.forEach(id => allPlayerIds.add(id));
    });

    const playerIds = Array.from(allPlayerIds).sort((a, b) => a - b);

    // Display limit to 20 players max for performance
    const displayLimit = Math.min(playerIds.length, 20);

    for (let i = 0; i < displayLimit; i++) {
      const id = playerIds[i];
      const player = this.players.find(p => p.id === id) || { name: `Joueur ${id + 1}` };

      // Handle the case where player might not exist at initial or final state
      const initialAmount = initialData.playerIds.includes(id) ? initialData.amounts[id] : 0;
      const finalAmount = finalData.playerIds.includes(id) ? finalData.amounts[id] : 0;

      const initialPercentage = initialData.playerIds.includes(id) ? initialData.percentages[id] : 0;
      const finalPercentage = finalData.playerIds.includes(id) ? finalData.percentages[id] : 0;

      const startYear = this.players.find(p => p.id === id)?.startYear || 0;
      const stopYear = this.players.find(p => p.id === id)?.stopYear || 'N/A';

      this.tableData.push({
        id,
        player: player.name,
        initialAmount: initialAmount.toFixed(2),
        finalAmount: finalAmount.toFixed(2),
        initialPercentage: initialPercentage.toFixed(2),
        finalPercentage: finalPercentage.toFixed(2),
        startYear,
        stopYear: stopYear === null ? 'N/A' : stopYear
      });
    }
  }

  // Reset simulation
  resetSimulation(): void {
    this.growthRate = 10;
    this.numPlayers = 10;
    this.baseAmount = 1;
    this.increment = 1000;
    this.years = 80;
    this.gapType = 'linear';
    this.selectedPlayerId = null;

    this.initPlayers();
    this.runSimulation();
  }

  // Generate distinct colors for players
  generateColors(count: number): string[] {
    const colors: string[] = [];
    const hueStep = 360 / count;

    for (let i = 0; i < count; i++) {
      const hue = i * hueStep;
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }

    return colors;
  }

  // Add new player to the simulation
  addNewPlayer(): void {
    // Validate year
    if (this.newPlayerYear < 0 || this.newPlayerYear > this.years) {
      return;
    }

    // Generate new ID (max ID + 1)
    const newId = this.players.reduce((max, p) => Math.max(max, p.id), -1) + 1;

    this.players.push({
      id: newId,
      name: `Joueur ${newId + 1}`,
      receivingDU: true,
      startYear: this.newPlayerYear,
      stopYear: null,
      initialAmount: this.newPlayerAmount
    });

    this.runSimulation();
  }

  // Stop a player from receiving DU
  stopPlayerDU(): void {
    if (this.selectedPlayerId === null || this.stopYear < 0 || this.stopYear > this.years) {
      return;
    }

    const player = this.players.find(p => p.id === this.selectedPlayerId);
    if (player) {
      player.stopYear = this.stopYear;
      this.runSimulation();
    }
  }

  // Resume a player receiving DU
  resumePlayerDU(): void {
    if (this.selectedPlayerId === null) {
      return;
    }

    const player = this.players.find(p => p.id === this.selectedPlayerId);
    if (player) {
      player.stopYear = null;
      this.runSimulation();
    }
  }

  // Set player for operations
  selectPlayer(playerId: number): void {
    // Reset stopYear to the current value when selecting a player
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      // Set stopYear to default to the middle of the simulation for better UX
      this.stopYear = Math.floor(this.years / 2);
    }

    this.selectedPlayerId = playerId;
  }

  // Check if a player is selected
  isPlayerSelected(playerId: number): boolean {
    return this.selectedPlayerId === playerId;
  }

  // Update base parameters and recreate players
  updateBaseParameters(): void {
    this.initPlayers();
    this.runSimulation();
  }
}
