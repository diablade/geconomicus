/**
 * Conservation audit: no card may be created or destroyed except by a tech shift.
 *
 * Counts every card in every deck plus every living hand, and compares against the
 * cards minted at setup plus the cards minted by each shift. A shortfall means
 * cards are leaking out of the game — the failed-production path is the known way
 * that happens, since the real helper mutates before it validates.
 *
 * @module tools/sim/conservation
 */
import './rng.mjs';
import { runGame } from './model.mjs';

const scenarios = [
	{ tag: '14p / 50r  · shift off', players: 14, rounds: 50, rules: {} },
	{ tag: '14p / 200r · shift off', players: 14, rounds: 200, rules: {} },
	{ tag: '14p / 200r · shift on 1:1', players: 14, rounds: 200, rules: { techShiftEnabled: true } },
	{
		tag: '6p  / 200r · shift on 2:1',
		players: 6,
		rounds: 200,
		rules: { techShiftEnabled: true, techShiftExchangeRatio: 2 },
	},
];

const rows = [];
for (const scenario of scenarios) {
	const result = await runGame({
		players: scenario.players,
		typeMoney: 'june',
		seed: 3,
		rounds: scenario.rounds,
		encountersPerRound: 3.25,
		rules: scenario.rules,
	});

	const final = result.samples.at(-1);
	const inDecks = final.deckSizes.reduce((a, b) => a + b, 0);
	const inHands = result.finalHandCards ?? 0;
	const minted = result.cardsMintedTotal ?? 0;
	const accounted = inDecks + inHands;

	rows.push({
		scenario: scenario.tag,
		minted,
		inDecks,
		inHands,
		accounted,
		lost: minted - accounted,
		throws: result.hardThrows.length,
		lostPerThrow: result.hardThrows.length ? ((minted - accounted) / result.hardThrows.length).toFixed(1) : '—',
	});
}
console.table(rows);
