import { assertLodashObeysSeed } from './rng.mjs';
import { runGame } from './model.mjs';

await assertLodashObeysSeed();

const rows = [];
for (const players of [4, 7, 14, 20, 30, 41]) {
	const started = performance.now();
	const runs = 10;
	for (let seed = 1; seed <= runs; seed++) {
		await runGame({ players, typeMoney: 'june', seed, encountersPerRound: 3.25 });
	}
	const perRun = (performance.now() - started) / runs;
	rows.push({
		players,
		msPerRun: perRun.toFixed(1),
		runsPerSecond: (1000 / perRun).toFixed(0),
		hoursFor816k: ((816000 * perRun) / 3600000).toFixed(1),
	});
}
console.table(rows);
process.exit(0);
