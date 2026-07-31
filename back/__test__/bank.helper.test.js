import { describe, it, expect } from '@jest/globals';
import { CREDIT_STATUS, PLAYER_STATUS, RATE_SCHEDULE_PRESETS } from '@geco/shared';
import {
	computeAverageMoney,
	computeEffectiveRate,
	isRateImprovement,
	computeSolvency,
	isSolvent,
	seizeCardsForAutoSeizure,
	computeAutoSeizureForCredit,
	computeManualSeizureUnpaid,
	computeAutoSeizurePrisonMinutes,
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

describe('seizeCardsForAutoSeizure (docs/adr/0005-auto-seizure.md)', () => {
	const card = (key, price) => ({ key, price, letter: 'A', color: 'red', weight: 0 });

	it('lands an exact match when the biggest-fitting-first order allows it', () => {
		const cards = [card('a', 7), card('b', 3)];
		const { seized, remainingCards, remainingUnpaid } = seizeCardsForAutoSeizure(cards, 10);
		expect(seized.map((c) => c.key)).toEqual(['a', 'b']);
		expect(remainingCards).toEqual([]);
		expect(remainingUnpaid).toBe(0);
	});

	it('closes the gap with the smallest overshooting card once nothing fits without overshoot', () => {
		// remaining=11: 10 fits (take it, remaining=1); neither 6 nor 5 fit under 1,
		// so the smallest of those (5) closes it rather than the next-biggest (6).
		const cards = [card('big', 10), card('mid', 6), card('small', 5)];
		const { seized, remainingCards, remainingUnpaid } = seizeCardsForAutoSeizure(cards, 11);
		expect(seized.map((c) => c.key)).toEqual(['big', 'small']);
		expect(remainingCards.map((c) => c.key)).toEqual(['mid']);
		expect(remainingUnpaid).toBe(0);
	});

	it('seizes every card and reports the unpaid remainder when the hand is not enough', () => {
		const cards = [card('a', 2), card('b', 1)];
		const { seized, remainingCards, remainingUnpaid } = seizeCardsForAutoSeizure(cards, 10);
		expect(seized.map((c) => c.key)).toEqual(['a', 'b']);
		expect(remainingCards).toEqual([]);
		expect(remainingUnpaid).toBe(7);
	});

	it('applies a uniform decote % when checking whether a card fits', () => {
		// face 10, decote 50% → counted value 5, which fits under the remaining 7.
		const cards = [card('a', 10)];
		const { seized, remainingUnpaid } = seizeCardsForAutoSeizure(cards, 7, 50);
		expect(seized.map((c) => c.key)).toEqual(['a']);
		expect(remainingUnpaid).toBe(2); // 7 - (10 - 10*0.5)
	});
});

describe('computeAutoSeizureForCredit (docs/adr/0005-auto-seizure.md)', () => {
	const card = (key, price) => ({ key, price, letter: 'A', color: 'red', weight: 0 });
	const credit = { amount: 3, interest: 1 };

	it('Decote mode: coins alone cover the objective, hand untouched', () => {
		const rules = { seizureType: CREDIT_STATUS.DECOTE, seizureDecote: 33, seizureCosts: 2 };
		const cards = [card('a', 5)];
		const result = computeAutoSeizureForCredit(20, cards, credit, rules);
		expect(result).toMatchObject({ coinsSeized: 4, interestSeized: 1, cardsFaceValue: 0, objective: 4, unpaid: 0 });
		expect(result.remainingCoins).toBe(16);
		expect(result.remainingCards).toEqual(cards);
	});

	it('Fees mode: a flat cost is added to the objective and cards count at face value', () => {
		const rules = { seizureType: CREDIT_STATUS.FEES, seizureDecote: 33, seizureCosts: 2 };
		const cards = [card('a', 5), card('b', 2)];
		// objective = 3 + 1 + 2 = 6; coins cover 1, remaining 5 → biggest fitting card (5) closes it.
		const result = computeAutoSeizureForCredit(1, cards, credit, rules);
		expect(result.objective).toBe(6);
		expect(result.coinsSeized).toBe(1);
		expect(result.interestSeized).toBe(1);
		expect(result.cardsSeized.map((c) => c.key)).toEqual(['a']);
		expect(result.cardsFaceValue).toBe(5);
		expect(result.unpaid).toBe(0);
		expect(result.remainingCoins).toBe(0);
		expect(result.remainingCards.map((c) => c.key)).toEqual(['b']);
	});

	it('does not count interest as seized when coins fall short of even the interest', () => {
		const rules = { seizureType: CREDIT_STATUS.DECOTE, seizureDecote: 33, seizureCosts: 2 };
		const result = computeAutoSeizureForCredit(0, [], { amount: 3, interest: 2 }, rules);
		expect(result.coinsSeized).toBe(0);
		expect(result.interestSeized).toBe(0);
		expect(result.unpaid).toBe(5);
	});
});

describe('computeManualSeizureUnpaid', () => {
	const card = (key, price) => ({ key, price, letter: 'A', color: 'red', weight: 0 });
	const credit = { amount: 5, interest: 2 };

	it('Fees mode: the flat cost is part of what the master has to recover', () => {
		const rules = { seizureType: CREDIT_STATUS.FEES, seizureDecote: 50, seizureCosts: 1 };
		expect(computeManualSeizureUnpaid(credit, rules, 3, [card('a', 2)])).toBe(3);
	});

	it('Decote mode: seized cards only count at their discounted value', () => {
		const rules = { seizureType: CREDIT_STATUS.DECOTE, seizureDecote: 50, seizureCosts: 1 };
		expect(computeManualSeizureUnpaid(credit, rules, 0, [card('a', 2)])).toBe(6);
	});

	it('is 0 when coins alone settle the credit', () => {
		const rules = { seizureType: CREDIT_STATUS.FEES, seizureDecote: 50, seizureCosts: 1 };
		expect(computeManualSeizureUnpaid(credit, rules, 8, [])).toBe(0);
	});

	it('never goes negative when the last card overshoots', () => {
		const rules = { seizureType: CREDIT_STATUS.DECOTE, seizureDecote: 0, seizureCosts: 0 };
		expect(computeManualSeizureUnpaid(credit, rules, 0, [card('a', 20)])).toBe(0);
	});

	it('treats missing seizure rules as no cost and no decote', () => {
		expect(computeManualSeizureUnpaid(credit, {}, 2, [card('a', 2)])).toBe(3);
	});
});

describe('computeAutoSeizurePrisonMinutes (docs/adr/0005-auto-seizure.md)', () => {
	it('floors at 1 minute when the debt was fully covered', () => {
		expect(computeAutoSeizurePrisonMinutes(0, 5)).toBe(1);
	});

	it('caps at timerPrisonMax when almost nothing was recovered', () => {
		expect(computeAutoSeizurePrisonMinutes(1, 5)).toBe(5);
	});

	it('scales linearly in between', () => {
		expect(computeAutoSeizurePrisonMinutes(0.5, 5)).toBe(3); // round(1 + 4*0.5)
	});

	it('clamps an out-of-range ratio', () => {
		expect(computeAutoSeizurePrisonMinutes(-0.2, 5)).toBe(1);
		expect(computeAutoSeizurePrisonMinutes(1.5, 5)).toBe(5);
	});

	it('always returns 1 when timerPrisonMax is 1', () => {
		expect(computeAutoSeizurePrisonMinutes(0, 1)).toBe(1);
		expect(computeAutoSeizurePrisonMinutes(1, 1)).toBe(1);
	});
});
