import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { assertLodashObeysSeed } from './rng.mjs';
import { runGame } from './model.mjs';
import { evaluate } from './constraints.mjs';
import { renderReport } from './report.mjs';

const NUMERIC = new Set([
	'players',
	'seed',
	'rounds',
	'encountersPerRound',
	'animatorCreditsPerRound',
	'amountCardsForProd',
	'generatedIdenticalLetters',
	'generateLettersInDeck',
	'distribInitCards',
	'startAmountCoins',
	'durationCredit',
	'timerPrison',
	'defaultCreditAmount',
	'defaultInterestAmount',
]);
const BOOLEAN = new Set(['autoDeath', 'generateLettersAuto', 'inequalityStart']);
const RULE_KEYS = new Set([
	'amountCardsForProd',
	'generatedIdenticalLetters',
	'generateLettersAuto',
	'generateLettersInDeck',
	'distribInitCards',
	'startAmountCoins',
	'autoDeath',
	'inequalityStart',
	'durationCredit',
	'timerPrison',
	'defaultCreditAmount',
	'defaultInterestAmount',
]);

function parseArgs(argv) {
	const parsed = {};
	for (let i = 0; i < argv.length; i++) {
		if (!argv[i].startsWith('--')) continue;
		const key = argv[i].slice(2);
		const raw = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
		parsed[key] = NUMERIC.has(key) ? Number(raw) : BOOLEAN.has(key) ? raw !== 'false' : raw;
	}
	return parsed;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
	console.log(`
Geconomicus deck simulation — single run

  node tools/sim/run.mjs [options]

  --players N                 table size (default 14)
  --type june|debt            game type (default june)
  --seed N                    run seed (default 1)
  --out PATH                  output html (default tools/sim/out/<type>-<players>p-seed<seed>.html)

  --amountCardsForProd N      recipe shape: cards needed (3 triangle / 4 square / 5 quinte)
  --generatedIdenticalLetters N   copies minted per letter
  --generateLettersAuto false --generateLettersInDeck N   override the 1.25x formula
  --distribInitCards N        opening hand
  --rounds N                  session length in rounds (default 50)
  --autoDeath false           disable the death queue

  --encountersPerRound N      calibrated 3.25
  --animatorCreditsPerRound N calibrated 1 (debt only)
`);
	process.exit(0);
}

await assertLodashObeysSeed();

const rules = {};
for (const key of Object.keys(args)) if (RULE_KEYS.has(key)) rules[key] = args[key];

const result = await runGame({
	players: args.players ?? 14,
	typeMoney: args.type ?? 'june',
	seed: args.seed ?? 1,
	rounds: args.rounds ?? 50,
	encountersPerRound: args.encountersPerRound ?? 3.25,
	animatorCreditsPerRound: args.animatorCreditsPerRound ?? 1,
	rules,
});

const verdict = evaluate(result);
const html = renderReport(result, verdict);

const outPath = resolve(
	args.out ?? `tools/sim/out/${result.config.typeMoney}-${result.config.players}p-seed${result.config.seed}.html`
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, 'utf8');

console.log(`\n${result.config.players} players, ${result.config.typeMoney}, ${result.config.rounds} rounds, seed ${result.config.seed}`);
console.log(verdict.passed ? 'VERDICT: all constraints passed' : `VERDICT: ${verdict.failedCount} constraint(s) failed`);
for (const check of verdict.checks) console.log(`  [${check.passed ? 'PASS' : 'FAIL'}] ${check.label} — ${check.detail}`);
console.log(`\ntransactions ${result.transactions}  productions ${result.productions}  worst avatar ${result.minProductions}`);
console.log(`report: ${outPath}\n`);
process.exit(0);
