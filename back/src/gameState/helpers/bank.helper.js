import _ from 'lodash';
import { PLAYER_STATUS, CREDIT_STATUS } from '@geco/shared';

// Credit statuses that no longer count as an outstanding obligation.
const CLOSED_CREDIT = new Set([CREDIT_STATUS.DONE, CREDIT_STATUS.CANCELED]);

// ─── Average money (the scarcity metric that drives the Auto-Bank) ─────────────

// Living lives = anything not DEAD (matches the front's `avgCurrency`; a life in
// PRISON still counts). Ghost money in dead snapshots stays in the mass, so this
// deliberately overstates money in living hands — see ADR-0003 / Ghost Money.
export function countAlive(gameState) {
	return gameState.playersStates.filter((p) => p.status !== PLAYER_STATUS.DEAD).length;
}

export function computeAverageMoney(gameState) {
	const alive = countAlive(gameState);
	if (alive <= 0) return 0;
	return (gameState.currentMassMonetary || 0) / alive;
}

// ─── Effective rate ────────────────────────────────────────────────────────────

// Terms available above every threshold — the existing default credit.
export function baseRate(rules) {
	return {
		amount: rules.defaultCreditAmount,
		interest: rules.defaultInterestAmount,
		allowDouble: true,
	};
}

// The credit terms currently on offer for a given average money.
// Returns { amount, interest, allowDouble, pct, tierIndex }; tierIndex -1 = base.
// The deepest crossed tier wins. Thresholds are sorted descending so, once avg is
// not below a threshold, no smaller (deeper) threshold can be crossed either.
export function computeEffectiveRate(avg, rateSchedule, rules) {
	const base = baseRate(rules);
	const schedule = _.orderBy(rateSchedule || [], ['threshold'], ['desc']);

	let tierIndex = -1;
	for (let i = 0; i < schedule.length; i++) {
		if (avg < schedule[i].threshold) tierIndex = i;
		else break;
	}

	const tier = tierIndex >= 0 ? schedule[tierIndex] : base;
	const amount = tier.amount;
	const interest = tier.interest;
	const allowDouble = tier.allowDouble !== false;
	const pct = amount > 0 ? interest / amount : 0;
	return { amount, interest, allowDouble, pct, tierIndex };
}

// live-down / silent-up: a move to a DEEPER tier (money got scarcer → better
// relief terms) is an improvement worth notifying; climbing back up is silent.
export function isRateImprovement(next, prev) {
	if (!prev) return next.tierIndex >= 0;
	return next.tierIndex > prev.tierIndex;
}

// True when the two rates are the same tier (nothing changed).
export function sameRateTier(a, b) {
	return !!a && !!b && a.tierIndex === b.tierIndex;
}

// ─── Solvency (coins + card value collateral) ─────────────────────────────────

export function cardsValue(playerState) {
	return _.reduce(playerState.cards || [], (acc, c) => acc + (c.price || 0), 0);
}

export function playerWealth(playerState) {
	return (playerState.coins || 0) + cardsValue(playerState);
}

export function outstandingObligation(credits) {
	return _.reduce(
		(credits || []).filter((c) => !CLOSED_CREDIT.has(c.status)),
		(acc, c) => acc + (c.amount || 0) + (c.interest || 0),
		0
	);
}

// Solvency snapshot for a player, optionally including a prospective new credit.
export function computeSolvency(playerState, credits, newAmount = 0, newInterest = 0) {
	const wealth = playerWealth(playerState);
	const obligation = outstandingObligation(credits) + newAmount + newInterest;
	return { wealth, obligation, headroom: wealth - obligation, solvent: wealth >= obligation };
}

export function isSolvent(playerState, credits, newAmount, newInterest) {
	return computeSolvency(playerState, credits, newAmount, newInterest).solvent;
}

// ─── Auto Seizure (docs/adr/0005-auto-seizure.md) ──────────────────────────────

// Card selection: the biggest card that still fits without overshooting the remaining
// objective is taken first; once none fit without overshooting, the smallest overshooting
// card closes the gap — minimizing waste on the final card. Pure: never mutates `cards`.
// `decotePercent` is 0 in Fees mode (cards count at face value); in Decote mode it's the
// game's seizureDecote %, applied uniformly so sorting by face price still sorts by counted
// value.
export function seizeCardsForAutoSeizure(cards, objectiveRemaining, decotePercent = 0) {
	let pool = [...cards];
	const seized = [];
	let remaining = objectiveRemaining;
	const valueOf = (card) => card.price - (card.price * decotePercent) / 100;

	while (remaining > 0 && pool.length > 0) {
		const sorted = [...pool].sort((a, b) => b.price - a.price);
		const fitting = sorted.filter((c) => valueOf(c) <= remaining);
		const chosen = fitting.length > 0 ? fitting[0] : sorted[sorted.length - 1];
		seized.push(chosen);
		remaining -= valueOf(chosen);
		pool = pool.filter((c) => c.key !== chosen.key);
	}

	return { seized, remainingCards: pool, remainingUnpaid: Math.max(0, remaining) };
}

// Seize one FAULT credit's amount + interest from a player's coins, then cards — the same
// math the manual seizure dialog uses (rules.seizureType: Decote or Fees). Pure: takes the
// player's current coins/cards and returns the outcome plus the post-seizure remainder; the
// caller applies the mutation. Auto Seizure settles several credits in one FIFO pass, so each
// credit's remainder feeds the next.
export function computeAutoSeizureForCredit(coins, cards, credit, rules) {
	const isDecote = rules.seizureType === CREDIT_STATUS.DECOTE;
	const objective = credit.amount + credit.interest + (isDecote ? 0 : rules.seizureCosts);

	const coinsSeized = Math.min(coins, objective);
	const interestSeized = coinsSeized >= credit.interest ? credit.interest : 0;
	let unpaid = objective - coinsSeized;

	let cardsSeized = [];
	let remainingCards = cards;
	if (unpaid > 0 && cards.length > 0) {
		const decotePercent = isDecote ? rules.seizureDecote : 0;
		const result = seizeCardsForAutoSeizure(cards, unpaid, decotePercent);
		cardsSeized = result.seized;
		remainingCards = result.remainingCards;
		unpaid = result.remainingUnpaid;
	}

	const cardsFaceValue = cardsSeized.reduce((acc, c) => acc + c.price, 0);

	return {
		coinsSeized,
		interestSeized,
		cardsSeized,
		cardsFaceValue,
		objective,
		unpaid,
		remainingCoins: coins - coinsSeized,
		remainingCards,
	};
}

// Prison duration (1..timerPrisonMax minutes), scaled by the aggregate shortfall ratio across
// a FIFO-resolved batch — 1 minute when the hand merely ran dry but the debt was fully paid,
// up to timerPrisonMax when almost nothing was recovered.
export function computeAutoSeizurePrisonMinutes(shortfallRatio, timerPrisonMax) {
	const ratio = Math.min(1, Math.max(0, shortfallRatio));
	return Math.min(timerPrisonMax, Math.max(1, Math.round(1 + (timerPrisonMax - 1) * ratio)));
}

export default {
	countAlive,
	computeAverageMoney,
	baseRate,
	computeEffectiveRate,
	isRateImprovement,
	sameRateTier,
	cardsValue,
	playerWealth,
	outstandingObligation,
	computeSolvency,
	isSolvent,
	seizeCardsForAutoSeizure,
	computeAutoSeizureForCredit,
	computeAutoSeizurePrisonMinutes,
};
