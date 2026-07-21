import {Injectable} from '@angular/core';

/**
 * Paramètres de simulation (tous ajustables depuis l'UI).
 * Chaque tableau indexé par décile : index 0 = D1 (10 % les plus modestes) ... index 9 = D10 (10 % les plus aisés).
 */
export interface SimParams {
	decileIncome: number[];        // revenu annuel de référence par décile (€)
	savingsRate: number[];         // taux d'épargne annuel par décile (fraction 0..1)
	capitalReturn: number[];       // rendement réel annuel du capital par décile (fraction)
	growthRate: number;            // croissance réelle annuelle du revenu (fraction)
	years: number;                 // durée de simulation (années)
	initialWealthMultiple: number; // patrimoine initial = revenu × ce multiple
}

export interface SimResult {
	/** wealth[decile][year] — patrimoine cumulé, année de 0 (départ) à `years` inclus. */
	wealth: number[][];
	/** ratioByYear[year] = patrimoine(D10) / patrimoine(D1) pour chaque année. */
	ratioByYear: number[];
	/** patrimoine maximal atteint (tous déciles, toutes années) — utile pour l'échelle des bulles. */
	maxWealth: number;
}

/**
 * Service de calcul PUR (aucun état, testable isolément).
 *
 * Modèle d'accumulation — récurrence annuelle identique pour tous les presets ;
 * SEUL le vecteur de taux d'imposition effectif change d'un scénario à l'autre
 * (même point de départ, mêmes taux d'épargne et rendements du capital) :
 *
 *   W[d][0]      = decileIncome[d] × initialWealthMultiple
 *   taxFactor[d] = 1 − tauxEffectif[d] / 100
 *   income_t     = decileIncome[d] × (1 + growthRate)^t
 *   savings_t    = income_t × savingsRate[d] × taxFactor[d]
 *   W[d][t+1]    = W[d][t] × (1 + capitalReturn[d] × taxFactor[d]) + savings_t
 *
 * Le taux effectif intervient deux fois : il réduit le rendement NET du capital
 * (capitalReturn × taxFactor — moteur de la « boule de neige » quand r > g) et
 * l'épargne annuelle nette d'impôt. Un taux plus élevé ralentit l'accumulation ;
 * un capital moins taxé (ex. sommet aplati de Macron via le PFU à 30 %) l'accélère.
 * Comme tous les scénarios partent du même W[d][0], seule la fiscalité fait diverger
 * les trajectoires sur 40 ans.
 */
@Injectable()
export class TaxSimulationService {

	/**
	 * @param taxRatePercent taux d'imposition effectif par décile, en POURCENTS (0..100)
	 * @param p              paramètres de simulation
	 */
	simulate(taxRatePercent: number[], p: SimParams): SimResult {
		const decileCount = p.decileIncome.length;
		const years = Math.max(1, Math.round(p.years));
		const wealth: number[][] = [];
		let maxWealth = 0;

		for (let d = 0; d < decileCount; d++) {
			const taxFactor = Math.max(0, 1 - (taxRatePercent[d] ?? 0) / 100);
			const row: number[] = new Array(years + 1);
			row[0] = p.decileIncome[d] * p.initialWealthMultiple;

			for (let t = 0; t < years; t++) {
				const incomeT = p.decileIncome[d] * Math.pow(1 + p.growthRate, t);
				const savingsT = incomeT * p.savingsRate[d] * taxFactor;
				row[t + 1] = row[t] * (1 + p.capitalReturn[d] * taxFactor) + savingsT;
			}

			for (let t = 0; t <= years; t++) {
				if (row[t] > maxWealth) {
					maxWealth = row[t];
				}
			}
			wealth[d] = row;
		}

		const ratioByYear: number[] = new Array(years + 1);
		const top = wealth[decileCount - 1];
		const bottom = wealth[0];
		for (let t = 0; t <= years; t++) {
			ratioByYear[t] = bottom[t] > 0 ? top[t] / bottom[t] : 0;
		}

		return {wealth, ratioByYear, maxWealth};
	}
}
