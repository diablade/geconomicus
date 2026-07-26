import { describe, it, expect } from '@jest/globals';
import { CREDIT_STATUS, PLAYER_STATUS, RATE_SCHEDULE_PRESETS } from '@geco/shared';
import {
	computeAverageMoney,
	computeEffectiveRate,
	isRateImprovement,
	computeSolvency,
	isSolvent,
} from '../src/gameState/helpers/bank.helper.js';

const rules = { defaultCreditAmount: 3, defaultInterestAmount: 1 };
const normal = RATE_SCHEDULE_PRESETS.normal;

describe('computeAverageMoney', () => {
	it('divides mass by living (non-dead) lives, prison counts as living', () => {
		const gs = {
			currentMassMonetary: 12,
			playersStates: [
				{ status: PLAYER_STATUS.ALIVE },
				{ status: PLAYER_STATUS.PRISON },
				{ status: PLAYER_STATUS.DEAD }, // excluded
			],
		};
		expect(computeAverageMoney(gs)).toBe(6); // 12 / 2
	});

	it('is 0 when nobody is alive', () => {
		expect(computeAverageMoney({ currentMassMonetary: 10, playersStates: [] })).toBe(0);
	});
});

describe('computeEffectiveRate (normal preset)', () => {
	it('returns base rate above every threshold', () => {
		const r = computeEffectiveRate(1.6, normal, rules);
		expect(r).toMatchObject({ amount: 3, interest: 1, allowDouble: true, tierIndex: -1 });
	});

	it('picks tier 0 (4/1) just under 1.5', () => {
		expect(computeEffectiveRate(1.45, normal, rules)).toMatchObject({ amount: 4, interest: 1, tierIndex: 0 });
	});

	it('picks the deepest crossed tier when several thresholds are passed', () => {
		expect(computeEffectiveRate(1.2, normal, rules)).toMatchObject({ amount: 5, interest: 1, tierIndex: 1 });
		expect(computeEffectiveRate(0.9, normal, rules)).toMatchObject({ amount: 6, interest: 1, tierIndex: 2 });
	});

	it('reaches the 0%, no-double relief tier under 0.4', () => {
		const r = computeEffectiveRate(0.3, normal, rules);
		expect(r).toMatchObject({ amount: 3, interest: 0, allowDouble: false, tierIndex: 3 });
		expect(r.pct).toBe(0);
	});
});

describe('isRateImprovement (live-down / silent-up)', () => {
	it('is true going deeper (scarcer money), false climbing back up', () => {
		const base = computeEffectiveRate(1.6, normal, rules);
		const deep = computeEffectiveRate(0.9, normal, rules);
		expect(isRateImprovement(deep, base)).toBe(true);
		expect(isRateImprovement(base, deep)).toBe(false);
		expect(isRateImprovement(deep, deep)).toBe(false);
	});
});

describe('solvency (coins + card value)', () => {
	const player = { coins: 2, cards: [{ price: 4 }, { price: 2 }] }; // wealth 8
	const credits = [
		{ amount: 3, interest: 1, status: CREDIT_STATUS.RUNNING }, // obligation 4
		{ amount: 5, interest: 2, status: CREDIT_STATUS.DONE }, // closed, ignored
	];

	it('sums wealth and outstanding obligation, closed credits excluded', () => {
		const s = computeSolvency(player, credits);
		expect(s.wealth).toBe(8);
		expect(s.obligation).toBe(4);
		expect(s.headroom).toBe(4);
		expect(s.solvent).toBe(true);
	});

	it('approves a new credit that fits within headroom', () => {
		expect(isSolvent(player, credits, 3, 1)).toBe(true); // 4 + 4 = 8 <= 8
	});

	it('refuses a new credit that exceeds wealth', () => {
		expect(isSolvent(player, credits, 4, 1)).toBe(false); // 4 + 5 = 9 > 8
	});
});
