/**
 * Seeded randomness for the simulator.
 *
 * This module installs a swappable dispatcher over `Math.random` at import time.
 * It MUST be evaluated before any module that imports lodash: lodash captures
 * `Math.random` into a private `nativeRandom` binding when it first loads, so a
 * later replacement would leave `_.shuffle` unseeded and every run
 * non-deterministic. `assertLodashObeysSeed` exists to prove the ordering held.
 *
 * @module tools/sim/rng
 */

/**
 * Build a deterministic pseudo-random generator (mulberry32).
 *
 * @param {number} seed - any 32-bit integer; the same seed yields the same stream
 * @returns {() => number} generator producing floats in [0, 1)
 */
export function createSeededRandom(seed) {
	let state = seed >>> 0;
	return function seededRandom() {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const systemRandom = Math.random;
let generator = systemRandom;

Math.random = function dispatchRandom() {
	return generator();
};

/**
 * Point the global dispatcher at a fresh seeded stream.
 *
 * Everything downstream of this call — including lodash's `_.shuffle` inside the
 * real game helpers — becomes reproducible for that seed.
 *
 * @param {number} seed - run seed
 * @returns {void}
 */
export function setSeed(seed) {
	generator = createSeededRandom(seed);
}

/**
 * Restore the platform's own `Math.random`.
 *
 * @returns {void}
 */
export function clearSeed() {
	generator = systemRandom;
}

/**
 * Verify that lodash routes through the seeded dispatcher.
 *
 * Shuffles a fixed probe twice under the same seed. Divergence means lodash was
 * loaded before this module and holds a reference to the original `Math.random`,
 * which silently destroys reproducibility.
 *
 * @returns {Promise<void>} resolves when seeding is proven
 * @throws {Error} if lodash captured `Math.random` before the dispatcher installed
 */
export async function assertLodashObeysSeed() {
	const { default: lodash } = await import('lodash');
	const probe = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	setSeed(0xc0ffee);
	const first = lodash.shuffle(probe).join(',');
	setSeed(0xc0ffee);
	const second = lodash.shuffle(probe).join(',');
	if (first !== second) {
		throw new Error(
			'lodash captured Math.random before the seeded dispatcher was installed — rng.mjs must be evaluated before any module importing lodash'
		);
	}
}

/**
 * Fisher-Yates shuffle that leaves the input untouched.
 *
 * @template T
 * @param {T[]} items - source array, not mutated
 * @returns {T[]} a new shuffled array
 */
export function shuffled(items) {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}
