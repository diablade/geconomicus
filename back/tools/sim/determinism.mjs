import { runGame } from './model.mjs';

const cfg = { players: 14, typeMoney: 'june', seed: 7, encountersPerRound: 4 };

const a = await runGame(cfg);
const b = await runGame(cfg);
console.log('same config twice:', a.transactions, b.transactions, a.transactions === b.transactions ? 'DETERMINISTIC' : 'NON-DETERMINISTIC');

const c = await runGame({ ...cfg, typeMoney: 'debt' });
const d = await runGame(cfg);
console.log('after an interleaved debt run:', d.transactions, d.transactions === a.transactions ? 'STABLE' : 'CONTAMINATED');

const before = [];
for (let seed = 1; seed <= 5; seed++) before.push((await runGame({ ...cfg, seed })).transactions);
const after = [];
for (let seed = 1; seed <= 5; seed++) {
	after.push((await runGame({ ...cfg, seed })).transactions);
	await runGame({ ...cfg, seed, typeMoney: 'debt' });
}
console.log('pure sequence :', before.join(','));
console.log('interleaved   :', after.join(','));
console.log(before.join(',') === after.join(',') ? 'MATCH' : 'MISMATCH');
process.exit(0);
