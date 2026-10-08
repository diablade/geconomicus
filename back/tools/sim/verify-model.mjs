import { assertLodashObeysSeed } from './rng.mjs';
import { runGame } from './model.mjs';

await assertLodashObeysSeed();

const base = { players: 14, typeMoney: 'debt', seed: 5, encountersPerRound: 3.25, animatorCreditsPerRound: 1 };

const variants = {
	'manual bank, manual seizure': {},
	'autoSeizure on': { autoSeizure: true },
	'autoBank on': { autoBank: true },
	'both on': { autoBank: true, autoSeizure: true },
	'first credit 50%': { firstCreditAcceptance: 50 },
	'first credit 100% + autoBank': { firstCreditAcceptance: 100, autoBank: true },
};

const rows = [];
for (const [name, rules] of Object.entries(variants)) {
	const r = await runGame({ ...base, rules });
	rows.push({
		variant: name,
		tx: r.transactions,
		prod: r.productions,
		temp: '×' + r.temperature.ratio.toFixed(2) + ' ' + r.temperature.band,
		credits: r.creditsCreated,
		firstQ: r.firstQuestionCredits,
		faults: r.faults,
		seizures: r.seizures,
		delayed: r.seizuresDelayed,
		prison: r.prisonSentences,
		deck0end: r.finalSample.deckSizes[0],
	});
}
console.log('\nDebt, 14 players, 50 rounds, seed 5\n');
console.table(rows);

const june = await runGame({ ...base, typeMoney: 'june', rules: {} });
console.log(`june reference: ${june.productions} productions, temp ×${june.temperature.ratio.toFixed(2)} ${june.temperature.band}`);

console.log('\nTemperature across player counts (june, defaults):');
const temps = [];
for (const players of [4, 6, 8, 10, 14, 20]) {
	const r = await runGame({ players, typeMoney: 'june', seed: 5, encountersPerRound: 3.25 });
	temps.push({
		players,
		productions: r.productions,
		perPlayer: (r.productions / players).toFixed(1),
		temperature: '×' + r.temperature.ratio.toFixed(2),
		band: r.temperature.band,
	});
}
console.table(temps);
process.exit(0);
