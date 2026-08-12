/**
 * Worker entry point for a single simulation.
 *
 * The static `rng.mjs` import must be evaluated before anything that pulls in
 * lodash, which is why the model and constraints are loaded dynamically below.
 * Get that order wrong and lodash keeps the unseeded `Math.random`, making every
 * run non-reproducible.
 *
 * Receives simulation options as workerData and posts back
 * `{ ok, result, verdict }` or `{ ok: false, message, stack }`.
 *
 * @module src/tools/sim.worker
 */
import { parentPort, workerData } from 'node:worker_threads';
import '../../tools/sim/rng.mjs';

const { runGame } = await import('../../tools/sim/model.mjs');
const { evaluate } = await import('../../tools/sim/constraints.mjs');
const { assertLodashObeysSeed } = await import('../../tools/sim/rng.mjs');

try {
	await assertLodashObeysSeed();
	const result = await runGame(workerData);
	const verdict = evaluate(result, workerData.thresholds ?? {});
	parentPort.postMessage({ ok: true, result, verdict });
} catch (error) {
	parentPort.postMessage({ ok: false, message: error.message, stack: error.stack });
}
