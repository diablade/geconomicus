import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import log from '#config/log';

const here = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = resolve(here, 'sim.worker.mjs');

const WORKER_TIMEOUT_MS = 60000;

const ToolsService = {};

/**
 * Run a simulation in a worker thread and resolve with its result.
 *
 * A worker is required, not merely convenient: lodash is already loaded in the
 * Express process, so the seeded random dispatcher could never be installed ahead
 * of it here. A fresh thread also keeps a long run off the event loop.
 *
 * @param {object} options - validated simulation options, forwarded as workerData
 * @returns {Promise<{ok: true, result: object, verdict: object}>}
 * @throws {Error} ERROR.SIMULATION_TIMEOUT past the time limit, or the worker's own error
 */
ToolsService.simulate = (options) =>
	new Promise((resolvePromise, rejectPromise) => {
		const worker = new Worker(WORKER_PATH, { workerData: options });
		let settled = false;

		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			worker.terminate();
			rejectPromise(new Error('ERROR.SIMULATION_TIMEOUT'));
		}, WORKER_TIMEOUT_MS);

		worker.on('message', (message) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			worker.terminate();
			if (message.ok) resolvePromise(message);
			else rejectPromise(new Error(message.message));
		});

		worker.on('error', (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			log.error(`[ToolsService] simulation worker failed: ${error.message}`);
			rejectPromise(error);
		});

		worker.on('exit', (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			rejectPromise(new Error(`ERROR.SIMULATION_WORKER_EXIT_${code}`));
		});
	});

export default ToolsService;
