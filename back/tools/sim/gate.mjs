import { assertLodashObeysSeed } from './rng.mjs';
import { runGame } from './model.mjs';

await assertLodashObeysSeed();

const SEEDS = 30;
const PLAYERS = 14;
const OBSERVED = {
	june: { transactions: 284, productions: 62 },
	debt: { transactions: 202, productions: 44 },
};

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const pct = (x) => (x * 100).toFixed(1) + '%';

async function batch(typeMoney, encountersPerRound, animatorCreditsPerRound) {
	const runs = [];
	for (let seed = 1; seed <= SEEDS; seed++) {
		runs.push(await runGame({ players: PLAYERS, typeMoney, seed, encountersPerRound, animatorCreditsPerRound }));
	}
	return runs;
}

const juneSweep = [];
for (let k = 2; k <= 5; k += 0.25) {
	const runs = await batch('june', k, Infinity);
	juneSweep.push({ k, tx: mean(runs.map((r) => r.transactions)), runs });
}
const bestJune = juneSweep.reduce((best, row) =>
	Math.abs(row.tx - OBSERVED.june.transactions) < Math.abs(best.tx - OBSERVED.june.transactions) ? row : best
);

console.log('\nJune encounter sweep (target 284 transactions):');
console.table(
	juneSweep.map((r) => ({
		encounters: r.k.toFixed(2),
		transactions: r.tx.toFixed(0),
		productions: mean(r.runs.map((x) => x.productions)).toFixed(0),
		ratio: mean(r.runs.map((x) => x.transactionsPerProduction ?? 0)).toFixed(2),
		utilisation: pct(mean(r.runs.map((x) => x.utilisation))),
	}))
);
console.log(`\nBest-fit encounters/round = ${bestJune.k.toFixed(2)} (the single calibrated parameter)\n`);

const debtSweep = [];
for (const cap of [1, 2, 3, Infinity]) {
	const runs = await batch('debt', bestJune.k, cap);
	debtSweep.push({ cap, runs, tx: mean(runs.map((r) => r.transactions)) });
}
console.log('Debt animator-throughput sweep (target 202 transactions, 71.1% of June):');
console.table(
	debtSweep.map((r) => ({
		animatorCap: r.cap === Infinity ? 'none' : r.cap,
		transactions: r.tx.toFixed(0),
		productions: mean(r.runs.map((x) => x.productions)).toFixed(0),
		ratio: mean(r.runs.map((x) => x.transactionsPerProduction ?? 0)).toFixed(2),
		shareOfJune: pct(r.tx / bestJune.tx),
		credits: mean(r.runs.map((x) => x.creditsCreated)).toFixed(0),
		faults: mean(r.runs.map((x) => x.faults)).toFixed(1),
	}))
);

const bestDebt = debtSweep.reduce((best, row) =>
	Math.abs(row.tx - OBSERVED.debt.transactions) < Math.abs(best.tx - OBSERVED.debt.transactions) ? row : best
);

const report = (label, runs, observed, juneTx) => {
	const tx = mean(runs.map((r) => r.transactions));
	const prod = mean(runs.map((r) => r.productions));
	const ratio = mean(runs.map((r) => r.transactionsPerProduction ?? 0));
	const obsRatio = observed.transactions / observed.productions;
	return {
		game: label,
		'tx obs': observed.transactions,
		'tx sim': tx.toFixed(0),
		'prod obs': observed.productions,
		'prod sim': prod.toFixed(0),
		'prod err': pct(Math.abs(prod - observed.productions) / observed.productions),
		'ratio obs': obsRatio.toFixed(2),
		'ratio sim': ratio.toFixed(2),
		'ratio err': pct(Math.abs(ratio - obsRatio) / obsRatio),
		'share obs': juneTx ? '71.1%' : '—',
		'share sim': juneTx ? pct(tx / juneTx) : '—',
	};
};

console.log('\n=== GATES ===\n');
console.table([
	report('june', bestJune.runs, OBSERVED.june, null),
	report('debt', bestDebt.runs, OBSERVED.debt, bestJune.tx),
]);
console.log(`calibrated: encounters/round = ${bestJune.k.toFixed(2)}, animator credits/round = ${bestDebt.cap}`);
process.exit(0);
