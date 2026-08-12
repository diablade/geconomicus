import { assertLodashObeysSeed } from './rng.mjs';
import { runGame } from './model.mjs';
import { evaluate } from './constraints.mjs';

await assertLodashObeysSeed();

const SEEDS = 12;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const pct = (x) => (x * 100).toFixed(0) + '%';

const counts = [4, 5, 6, 7, 8, 10, 12, 14, 16, 20];
const rows = [];

for (const players of counts) {
	const runs = [];
	for (let seed = 1; seed <= SEEDS; seed++) {
		runs.push(await runGame({ players, typeMoney: 'june', seed, encountersPerRound: 3.25, animatorCreditsPerRound: 1 }));
	}
	const verdicts = runs.map((r) => evaluate(r));
	const lettersInGame = Math.round(1.25 * players);

	rows.push({
		players,
		letters: lettersInGame + 1,
		cardsPerLevel: (lettersInGame + 1) * 5,
		'prod/player': (mean(runs.map((r) => r.productions)) / players).toFixed(1),
		'tx/prod': mean(runs.map((r) => r.transactionsPerProduction ?? 0)).toFixed(2),
		'hard throw': pct(runs.filter((r) => r.hardThrows.length > 0).length / SEEDS),
		'tech wall': pct(runs.filter((r) => r.techShiftReached > 0).length / SEEDS),
		deadlock: pct(runs.filter((r) => r.samples.some((s) => s.latentSquares === 0)).length / SEEDS),
		'all produced': pct(runs.filter((r) => r.everyoneProduced).length / SEEDS),
		'peak stranded': pct(mean(runs.map((r) => Math.max(...r.samples.map((s) => s.strandedShare))))),
		'all pass': pct(verdicts.filter((v) => v.passed).length / SEEDS),
	});
}

console.log(`\nJune, default rules, 50 rounds, ${SEEDS} seeds per cell — current round(1.25*p) formula\n`);
console.table(rows);
process.exit(0);
