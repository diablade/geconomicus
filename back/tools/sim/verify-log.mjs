import { assertLodashObeysSeed } from './rng.mjs';
import { runGame } from './model.mjs';

await assertLodashObeysSeed();

const r = await runGame({
	players: 6,
	typeMoney: 'debt',
	seed: 3,
	encountersPerRound: 3.25,
	animatorCreditsPerRound: 1,
	rules: { firstCreditAcceptance: 50 },
});

const byType = new Map();
for (const e of r.log) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
console.log('\nlog entries:', r.log.length, ' truncated:', r.logTruncated);
console.table([...byType.entries()].map(([type, count]) => ({ type, count })));

console.log('\nCross-check log against headline counters:');
const check = (label, fromLog, fromStats) =>
	console.log(`  ${fromLog === fromStats ? 'ok  ' : 'MISMATCH'} ${label}: log ${fromLog} vs stats ${fromStats}`);
check('buy', byType.get('buy') ?? 0, r.transactions);
check('produce', byType.get('produce') ?? 0, r.productions);
check('search', byType.get('search') ?? 0, r.searches);
check('death', byType.get('death') ?? 0, r.deaths);
check('birth', byType.get('birth') ?? 0, r.rebirths);
check('fault', byType.get('fault') ?? 0, r.faults);
check('seizure', byType.get('seizure') ?? 0, r.seizures);
check('prison', byType.get('prison') ?? 0, r.prisonSentences);
check('settle', byType.get('settle') ?? 0, r.creditsSettled);
check('extend', byType.get('extend') ?? 0, r.creditsExtended);

const roundActions = new Map();
for (const e of r.log) {
	if (e.free || e.playerIdx < 0) continue;
	const key = `${e.round}|${e.playerIdx}`;
	roundActions.set(key, (roundActions.get(key) ?? 0) + 1);
}
const over = [...roundActions.entries()].filter(([, n]) => n > 1);
console.log(`\nplayers taking more than one round-costing action in a round: ${over.length ? over.slice(0, 5).join(', ') : 'none'}`);

console.log('\nround 1-3 sample:');
for (const e of r.log.filter((e) => e.round <= 3)) {
	console.log(`  r${e.round} #${e.playerIdx} ${e.free ? '(free)' : '      '} ${e.type.padEnd(8)} ${e.detail ?? ''}`);
}

const payload = JSON.stringify(r).length / 1024;
console.log(`\nresult payload with log: ${payload.toFixed(0)} kB`);
const big = await runGame({ players: 90, typeMoney: 'june', seed: 1, rounds: 200, encountersPerRound: 3.25 });
console.log(`90 players / 200 rounds: ${big.log.length} entries, truncated ${big.logTruncated}, ${(JSON.stringify(big).length / 1024 / 1024).toFixed(2)} MB`);
process.exit(0);
