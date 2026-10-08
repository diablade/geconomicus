import _ from 'lodash';
import {
	CREDIT_STATUS,
	CREDIT_ORIGIN,
	CREDIT_QUESTION_ANSWER,
	GAME_STATUS,
	GAME_TYPE,
	PLAYER_STATUS,
	PLAYER_TYPE,
	DB_EVENTS,
} from '@geco/shared';
import EventHelper from '../helpers/event.helper.js';
import DecksHelper from '../helpers/decks.helper.js';
import {
	computeAverageMoney,
	computeEffectiveRate,
	computeSolvency,
	computeAutoSeizureForCredit,
	computeAutoSeizurePrisonMinutes,
	computeManualSeizureUnpaid,
} from '../helpers/bank.helper.js';

const minute = 60 * 1000;

const BankEngine = {};

/** Every credit belonging to one Life, whatever its status. */
export const creditsOfPlayer = (gameState, playerStateIdx) =>
	(gameState.credits || []).filter((c) => c.playerStateIdx === playerStateIdx);

/** A Life by index, or a throw. */
const findLife = (gameState, playerStateIdx) => {
	const player = gameState.playersStates.find((p) => p.idx === playerStateIdx);
	if (!player) throw new Error('ERROR.PLAYER_NOT_FOUND');
	return player;
};

/** A credit by id, or a throw. */
const findCredit = (gameState, creditId) => {
	const credit = (gameState.credits || []).find((c) => c.id === creditId);
	if (!credit) throw new Error('ERROR.CREDIT_NOT_FOUND');
	return credit;
};

/** Pick the highest-priced cards that fit within what is still owed, never overshooting. */
const takeCardsWorth = (cards, targetAmount) => {
	const sortedCards = _.sortBy(cards, 'price').reverse();
	const seizedCards = [];
	let remainingAmount = targetAmount;
	for (const card of sortedCards) {
		if (remainingAmount <= 0) break;
		if (card.price <= remainingAmount) {
			seizedCards.push(card);
			remainingAmount -= card.price;
		}
	}
	return seizedCards;
};

/** The five aggregates every bank-moving broadcast carries, in the shape the front reads. */
BankEngine.bankIndicators = (gameState) => ({
	bankIndicators: {
		currentMassMonetary: gameState.currentMassMonetary,
		bankInterestEarned: gameState.bankInterestEarned,
		bankMoneyLost: gameState.bankMoneyLost,
		bankMoneyDestroyed: gameState.bankMoneyDestroyed,
		bankGoodsEarned: gameState.bankGoodsEarned,
	},
});

/**
 * The credit terms on offer right now.
 *
 * Before the round, or with the auto-bank off, that is always the base rate — expressed by
 * pricing against an average above every threshold rather than by a separate code path.
 *
 * @param {object} gameState
 * @param {object} rules
 * @returns {object} the effective rate
 */
BankEngine.currentRate = (gameState, rules) => {
	if (rules.typeMoney !== GAME_TYPE.DEBT || !rules.autoBank || gameState.status !== GAME_STATUS.PLAYING) {
		return computeEffectiveRate(Number.POSITIVE_INFINITY, rules.rateSchedule, rules);
	}
	return computeEffectiveRate(computeAverageMoney(gameState), rules.rateSchedule, rules);
};

/** What a borrower can do with a credit right now, given what they hold. */
BankEngine.whatCanDoCredit = (credit, playerState) => {
	if (!credit) throw new Error('ERROR.CREDIT_NOT_FOUND');
	if (!playerState) throw new Error('ERROR.PLAYER_NOT_FOUND');
	if (Number(credit.playerStateIdx) !== Number(playerState.idx)) throw new Error('ERROR.OWNERSHIP_CREDIT');
	if (credit.status === CREDIT_STATUS.DONE || credit.status === CREDIT_STATUS.CANCELED)
		throw new Error('ERROR.CREDIT_ALREADY_DONE_OR_CANCELED');
	return {
		canExtend: credit.interest <= playerState.coins,
		canSettle: credit.amount + credit.interest <= playerState.coins,
	};
};

/** A borrower's total obligation measured against their wealth. */
BankEngine.solvencyOf = (gameState, playerStateIdx, amount, interest) =>
	computeSolvency(findLife(gameState, playerStateIdx), creditsOfPlayer(gameState, playerStateIdx), amount, interest);

/**
 * Issue a credit: the money is created, not moved, so the mass grows by the amount lent.
 *
 * Starts running only if the round is already under way; before that it waits IDLE, which is
 * what lets the opening ceremony book real credits before the clock starts.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @param {number} playerStateIdx
 * @param {number} amount
 * @param {number} interest
 * @param {string} origin - how the credit came to be
 * @returns {{credit: object, playerState: object, startNow: boolean}}
 */
BankEngine.createCredit = (entry, playerStateIdx, amount, interest, origin) => {
	const { gameState, rules, events } = entry;
	const playerState = findLife(gameState, playerStateIdx);
	if (playerState.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.PLAYER_NOT_ALIVE');

	const startNow = gameState.status === GAME_STATUS.PLAYING;
	gameState.creditIndexSeq++;
	const now = new Date();
	const credit = {
		id: `credit-${gameState._id}-${playerStateIdx}-${gameState.creditIndexSeq}`,
		amount,
		interest,
		playerStateIdx,
		status: startNow ? CREDIT_STATUS.RUNNING : CREDIT_STATUS.IDLE,
		extended: 0,
		createdAt: now,
		startedAt: startNow ? now : null,
		endAt: null,
		remainingTime: rules.durationCredit * minute,
	};

	gameState.credits.push(credit);
	gameState.currentMassMonetary += amount;
	playerState.coins += amount;

	events.push(
		EventHelper.createEvent(DB_EVENTS.CREDIT_NEW, gameState, {
			emitter: PLAYER_TYPE.BANK,
			receiver: playerStateIdx,
			payload: { ...credit, origin },
		})
	);

	return { credit, playerState, startNow };
};

/** Issue the default credit to every living Life at once. */
BankEngine.createCreditForAll = (entry) => {
	const { gameState, rules } = entry;
	const created = [];
	for (const playerState of gameState.playersStates) {
		if (playerState.status !== PLAYER_STATUS.ALIVE) continue;
		created.push(
			BankEngine.createCredit(
				entry,
				playerState.idx,
				rules.defaultCreditAmount,
				rules.defaultInterestAmount,
				CREDIT_ORIGIN.ANIMATOR
			)
		);
	}
	return created;
};

/**
 * A player's own ask for credit, auto-approved only while they are solvent.
 *
 * A refusal is recorded as an event rather than thrown, because being turned down by the bank
 * is experimental data, not an error.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @param {number} playerStateIdx
 * @param {number} amount
 * @param {number} interest
 * @returns {{refused: boolean, amount: number, interest: number, solvency?: object, credit?: object}}
 */
BankEngine.requestCredit = (entry, playerStateIdx, amount, interest) => {
	const { gameState, events } = entry;
	const playerState = findLife(gameState, playerStateIdx);
	if (playerState.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.PLAYER_NOT_ALIVE');
	const playable = [GAME_STATUS.PLAYING, GAME_STATUS.INITIALIZED, GAME_STATUS.PAUSED];
	if (!playable.includes(gameState.status)) throw new Error('ERROR.GAME_NOT_PLAYING');

	const solvency = BankEngine.solvencyOf(gameState, playerStateIdx, amount, interest);
	if (!solvency.solvent) {
		events.push(
			EventHelper.createEvent(DB_EVENTS.CREDIT_REFUSED, gameState, {
				emitter: PLAYER_TYPE.BANK,
				receiver: playerStateIdx,
				payload: { amount, interest, ...solvency },
			})
		);
		return { refused: true, amount, interest, solvency };
	}

	const created = BankEngine.createCredit(entry, playerStateIdx, amount, interest, CREDIT_ORIGIN.PLAYER_REQUEST);
	return { refused: false, amount, interest, ...created };
};

/** Repay a credit in full: principal is destroyed, interest is earned by the bank. */
BankEngine.settleCredit = (entry, creditId) => {
	const { gameState, events } = entry;
	const credit = findCredit(gameState, creditId);
	const playerState = findLife(gameState, credit.playerStateIdx);

	const { canSettle } = BankEngine.whatCanDoCredit(credit, playerState);
	if (!canSettle) throw new Error('ERROR.NOT_ENOUGH_COINS');

	gameState.currentMassMonetary -= credit.amount + credit.interest;
	gameState.bankInterestEarned += credit.interest;
	gameState.bankMoneyDestroyed += credit.amount;
	playerState.coins -= credit.amount + credit.interest;

	credit.status = CREDIT_STATUS.DONE;
	credit.endAt = new Date();
	credit.remainingTime = 0;

	events.push(
		EventHelper.createEvent(DB_EVENTS.CREDIT_SETTLED, gameState, {
			emitter: credit.playerStateIdx,
			receiver: PLAYER_TYPE.BANK,
			payload: { credit },
		})
	);

	return { credit, playerState };
};

/**
 * Take the interest and restart the credit's clock.
 *
 * `emitter` says who drove it — the borrower when they chose to extend, the bank when maturity
 * extended it on their behalf — and that is the only difference between the two paths.
 */
const payInterest = (entry, credit, playerState, emitter) => {
	const { gameState, rules, events } = entry;
	const interest = credit.interest;
	playerState.coins -= interest;
	gameState.currentMassMonetary -= interest;
	gameState.bankInterestEarned += interest;

	credit.extended++;
	credit.remainingTime = rules.durationCredit * minute;
	credit.status = CREDIT_STATUS.RUNNING;

	events.push(
		EventHelper.createEvent(DB_EVENTS.CREDIT_EXTENDED, gameState, {
			emitter,
			receiver: emitter === PLAYER_TYPE.BANK ? playerState.idx : PLAYER_TYPE.BANK,
			payload: { credit },
		})
	);

	return { credit, playerState };
};

/** The borrower chooses to pay the interest and buy another full term. */
BankEngine.extendCredit = (entry, creditId) => {
	const { gameState } = entry;
	const credit = findCredit(gameState, creditId);
	const playerState = findLife(gameState, credit.playerStateIdx);

	const { canExtend } = BankEngine.whatCanDoCredit(credit, playerState);
	if (!canExtend) throw new Error('ERROR.NOT_ENOUGH_COINS');

	return payInterest(entry, credit, playerState, credit.playerStateIdx);
};

/** Mark a credit defaulted, which is what raises the borrower's police overlay. */
BankEngine.faultCredit = (entry, credit, playerState) => {
	const { gameState, events } = entry;
	credit.status = CREDIT_STATUS.FAULT;
	credit.faultAt = new Date();

	events.push(
		EventHelper.createEvent(DB_EVENTS.CREDIT_FAULT, gameState, {
			emitter: PLAYER_TYPE.BANK,
			receiver: playerState.idx,
			payload: { credit },
		})
	);

	return { credit, playerState };
};

/**
 * Decide what happens to a credit whose term just ran out.
 *
 * Three outcomes, tested in that order: a borrower who can cover the whole debt is asked to
 * settle and the credit waits at REQUESTING; one who can cover only the interest has it taken
 * and the term restarts; one who can cover neither defaults. Only the first involves the player.
 *
 * Resolving a credit that is no longer running is a **no-op, not an error**. A timer that fired
 * just before its credit was settled, cancelled or seized has already queued its callback, and
 * stopping the timer afterwards cannot recall it — so the guard has to live here, where it holds
 * for every caller and every ordering.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @param {string} creditId
 * @returns {{outcome: 'settlement-call'|'extended'|'fault'|'gone', credit: object|null, playerState: object|null}}
 */
BankEngine.resolveCreditMaturity = (entry, creditId) => {
	const { gameState, events } = entry;
	const credit = (gameState.credits || []).find((c) => c.id === creditId);
	const stale =
		!credit || credit.status === CREDIT_STATUS.DONE || credit.status === CREDIT_STATUS.CANCELED;
	if (stale) return { outcome: 'gone', credit: credit ?? null, playerState: null };

	const playerState = gameState.playersStates.find((p) => p.idx === credit.playerStateIdx);
	if (!playerState || playerState.status === PLAYER_STATUS.DEAD) {
		return { outcome: 'gone', credit, playerState: null };
	}

	const { canSettle, canExtend } = BankEngine.whatCanDoCredit(credit, playerState);

	if (canSettle) {
		credit.status = CREDIT_STATUS.REQUESTING;
		events.push(
			EventHelper.createEvent(DB_EVENTS.CREDIT_REQUEST, gameState, {
				emitter: PLAYER_TYPE.BANK,
				receiver: playerState.idx,
				payload: { credit },
			})
		);
		return { outcome: 'settlement-call', credit, playerState };
	}

	if (canExtend) {
		payInterest(entry, credit, playerState, PLAYER_TYPE.BANK);
		return { outcome: 'extended', credit, playerState };
	}

	BankEngine.faultCredit(entry, credit, playerState);
	return { outcome: 'fault', credit, playerState };
};

/** Write a credit off at the animator's discretion, returning the principal to the bank. */
BankEngine.cancelCredit = (entry, creditId) => {
	const { gameState, events } = entry;
	const credit = findCredit(gameState, creditId);
	const playerState = findLife(gameState, credit.playerStateIdx);
	if (playerState.coins < credit.amount) throw new Error('ERROR.NOT_ENOUGH_COINS');

	gameState.currentMassMonetary -= credit.amount;
	playerState.coins -= credit.amount;
	credit.status = CREDIT_STATUS.CANCELED;
	credit.endAt = new Date();

	events.push(
		EventHelper.createEvent(DB_EVENTS.CREDIT_CANCELED, gameState, {
			emitter: PLAYER_TYPE.BANK,
			receiver: credit.playerStateIdx,
			payload: { credit },
		})
	);

	return { credit, playerState };
};

/** Hand a player coins from nowhere, growing the money mass. */
BankEngine.freeMoney = (entry, playerStateIdx, amount) => {
	const { gameState, events } = entry;
	const playerState = findLife(gameState, playerStateIdx);
	if (playerState.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.PLAYER_NOT_ALIVE');

	playerState.coins += amount;
	gameState.currentMassMonetary += amount;

	events.push(
		EventHelper.createEvent(DB_EVENTS.FREE_MONEY, gameState, {
			emitter: PLAYER_TYPE.BANK,
			receiver: playerStateIdx,
			payload: { amount },
		})
	);

	return { playerState, amount };
};

/**
 * The animator's manual seizure of one defaulted credit.
 *
 * Card values are read from the hand, never from what the client sent, and prison is the
 * animator's choice here rather than a rule — unlike auto-seizure, where an empty hand makes it
 * mandatory.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @param {string} creditId
 * @param {number} playerStateIdx
 * @param {{coins: number, cards: Array<{key: string}>, prisonTime?: number}} seizure
 * @returns {{credit: object, playerState: object, seizedCards: object[], coinsSeized: number,
 *            cardsValue: number, unpaid: number, prisonMinutes: number}}
 */
BankEngine.seizure = (entry, creditId, playerStateIdx, seizure) => {
	const { gameState, rules, events } = entry;
	const credit = findCredit(gameState, creditId);
	const playerState = findLife(gameState, playerStateIdx);

	if (Number(credit.playerStateIdx) !== Number(playerStateIdx)) throw new Error('ERROR.OWNERSHIP_CREDIT');
	if (credit.status !== CREDIT_STATUS.FAULT) throw new Error('ERROR.CREDIT_NOT_IN_FAULT');
	if (seizure.coins > playerState.coins) throw new Error('ERROR.SEIZURE_COINS_EXCEED_PLAYER_COINS');

	const seizedKeys = new Set(seizure.cards.map((c) => c.key));
	const seizedCards = playerState.cards.filter((c) => seizedKeys.has(c.key));
	if (seizedCards.length !== seizure.cards.length) throw new Error('ERROR.CARD_NOT_FOUND_IN_HAND');

	const cardsValue = seizedCards.reduce((acc, c) => acc + c.price, 0);
	const interestSeized = seizure.coins >= credit.interest ? credit.interest : 0;
	const unpaid = computeManualSeizureUnpaid(credit, rules, seizure.coins, seizedCards);

	playerState.cards = playerState.cards.filter((c) => !seizedKeys.has(c.key));
	playerState.coins -= seizure.coins;

	gameState.currentMassMonetary -= seizure.coins;
	gameState.bankInterestEarned += interestSeized;
	gameState.bankGoodsEarned += cardsValue;
	gameState.bankMoneyLost += unpaid;

	DecksHelper.pushCardsInDecks(gameState, seizedCards);

	credit.status = CREDIT_STATUS.DONE;
	credit.endAt = new Date();

	events.push(
		EventHelper.createEvent(DB_EVENTS.CREDIT_SEIZURE, gameState, {
			emitter: PLAYER_TYPE.BANK,
			receiver: playerStateIdx,
			payload: { credit, coins: seizure.coins, cards: seizedCards },
		})
	);

	let prisonMinutes = 0;
	if (seizure.prisonTime && seizure.prisonTime > 0) {
		prisonMinutes = Math.min(seizure.prisonTime, rules.timerPrison);
		playerState.status = PLAYER_STATUS.PRISON;

		events.push(
			EventHelper.createEvent(DB_EVENTS.PRISON, gameState, {
				emitter: PLAYER_TYPE.BANK,
				receiver: playerStateIdx,
				payload: { prisonTime: prisonMinutes },
			})
		);
	}

	return { credit, playerState, seizedCards, coinsSeized: seizure.coins, cardsValue, unpaid, prisonMinutes };
};

/**
 * Settle every defaulted credit of one player in one sweep, oldest fault first.
 *
 * Scoped per player rather than per credit because the police overlay is one boolean across all
 * of them, so a single pool of coins and cards drains across the whole batch. Prison follows
 * whenever the hand ends up empty, whether or not the debt was covered — release is the only
 * path back to a playable hand.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @param {number} playerStateIdx
 * @returns {object|null} null when nothing was in fault
 */
BankEngine.applyAutoSeizure = (entry, playerStateIdx) => {
	const { gameState, rules, events } = entry;
	const playerState = findLife(gameState, playerStateIdx);
	const faultedCredits = creditsOfPlayer(gameState, playerStateIdx)
		.filter((c) => c.status === CREDIT_STATUS.FAULT)
		.sort((a, b) => new Date(a.faultAt).getTime() - new Date(b.faultAt).getTime());

	if (faultedCredits.length === 0) return null;

	let totalCoinsSeized = 0;
	let totalInterestSeized = 0;
	let totalCardsFaceValue = 0;
	let totalObjective = 0;
	let totalUnpaid = 0;
	const allSeizedCards = [];
	const resolvedCredits = [];

	for (const credit of faultedCredits) {
		const result = computeAutoSeizureForCredit(playerState.coins, playerState.cards, credit, rules);
		playerState.coins = result.remainingCoins;
		playerState.cards = result.remainingCards;

		totalCoinsSeized += result.coinsSeized;
		totalInterestSeized += result.interestSeized;
		totalCardsFaceValue += result.cardsFaceValue;
		totalObjective += result.objective;
		totalUnpaid += result.unpaid;
		allSeizedCards.push(...result.cardsSeized);

		credit.status = CREDIT_STATUS.DONE;
		credit.endAt = new Date();
		resolvedCredits.push(credit);

		events.push(
			EventHelper.createEvent(DB_EVENTS.CREDIT_SEIZURE, gameState, {
				emitter: PLAYER_TYPE.BANK,
				receiver: playerStateIdx,
				payload: { credit, coins: result.coinsSeized, cards: result.cardsSeized },
			})
		);
	}

	gameState.currentMassMonetary -= totalCoinsSeized;
	gameState.bankInterestEarned += totalInterestSeized;
	gameState.bankGoodsEarned += totalCardsFaceValue;
	gameState.bankMoneyLost += totalUnpaid;
	DecksHelper.pushCardsInDecks(gameState, allSeizedCards);

	let prisonMinutes = 0;
	if (playerState.cards.length === 0) {
		const shortfallRatio = totalObjective > 0 ? totalUnpaid / totalObjective : 0;
		prisonMinutes = computeAutoSeizurePrisonMinutes(shortfallRatio, rules.timerPrison);
		playerState.status = PLAYER_STATUS.PRISON;

		events.push(
			EventHelper.createEvent(DB_EVENTS.PRISON, gameState, {
				emitter: PLAYER_TYPE.BANK,
				receiver: playerStateIdx,
				payload: { prisonTime: prisonMinutes },
			})
		);
	}

	return {
		playerState,
		resolvedCredits,
		seizedCards: allSeizedCards,
		coinsSeized: totalCoinsSeized,
		unpaid: totalUnpaid,
		objective: totalObjective,
		imprisoned: prisonMinutes > 0,
		prisonMinutes,
	};
};

/** End a prison sentence, dealing the four fresh cards that make the hand playable again. */
BankEngine.releaseFromPrison = (entry, playerStateIdx) => {
	const { gameState, events } = entry;
	const playerState = findLife(gameState, playerStateIdx);
	if (playerState.status !== PLAYER_STATUS.PRISON) return null;

	const newCards = gameState.decks[0].splice(0, 4);
	playerState.cards.push(...newCards);
	playerState.status = PLAYER_STATUS.ALIVE;

	events.push(
		EventHelper.createEvent(DB_EVENTS.PRISON_ENDED, gameState, {
			emitter: PLAYER_TYPE.BANK,
			receiver: playerStateIdx,
			payload: { cards: newCards },
		})
	);

	return { playerState, newCards };
};

/**
 * Stamp every living Life pending on the opening credit question.
 *
 * Pending is state, not a broadcast, so a phone that was offline or merely refreshed still gets
 * asked when it next reads its own Life. A Life that already answered is left alone.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @returns {{asked: number, playerStateIdxs: number[], rate: object}}
 */
BankEngine.askFirstCreditQuestion = (entry) => {
	const { gameState, rules, events } = entry;
	if (rules.typeMoney !== GAME_TYPE.DEBT) throw new Error('ERROR.NOT_A_DEBT_GAME');
	if (gameState.status !== GAME_STATUS.INITIALIZED) throw new Error('ERROR.GAME_NOT_INITIALIZED');

	const rate = BankEngine.currentRate(gameState, rules);
	const asked = [];
	for (const p of gameState.playersStates) {
		if (p.status === PLAYER_STATUS.DEAD) continue;
		if (p.firstCreditAnswer) continue;
		p.firstCreditAnswer = CREDIT_QUESTION_ANSWER.PENDING;
		asked.push(p.idx);
	}
	gameState.firstCreditAsked = true;

	events.push(
		EventHelper.createEvent(DB_EVENTS.CREDIT_QUESTION_ASKED, gameState, {
			emitter: PLAYER_TYPE.BANK,
			receiver: '-',
			payload: { asked: asked.length, amount: rate.amount, interest: rate.interest },
		})
	);

	return {
		asked: asked.length,
		playerStateIdxs: asked,
		rate: { amount: rate.amount, interest: rate.interest, allowDouble: rate.allowDouble },
	};
};

/** Record one Life's answer to the opening question, booking the credit if they accepted. */
BankEngine.answerFirstCreditQuestion = (entry, playerStateIdx, answer) => {
	const { gameState, rules, events } = entry;
	const playerState = findLife(gameState, playerStateIdx);
	const answerable = [
		CREDIT_QUESTION_ANSWER.ACCEPT_SINGLE,
		CREDIT_QUESTION_ANSWER.ACCEPT_DOUBLE,
		CREDIT_QUESTION_ANSWER.DECLINE,
	];
	if (!answerable.includes(answer)) throw new Error('ERROR.INVALID_ANSWER');
	if (playerState.firstCreditAnswer !== CREDIT_QUESTION_ANSWER.PENDING) {
		throw new Error('ERROR.FIRST_CREDIT_NOT_PENDING');
	}

	const base = BankEngine.currentRate(gameState, rules);
	playerState.firstCreditAnswer = answer;

	events.push(
		EventHelper.createEvent(DB_EVENTS.CREDIT_QUESTION_ANSWERED, gameState, {
			emitter: PLAYER_TYPE.BANK,
			receiver: playerStateIdx,
			payload: { answer, amount: base.amount, interest: base.interest },
		})
	);

	const accepted =
		answer === CREDIT_QUESTION_ANSWER.ACCEPT_SINGLE || answer === CREDIT_QUESTION_ANSWER.ACCEPT_DOUBLE;
	if (!accepted) return { answer, playerState };

	const useDouble = answer === CREDIT_QUESTION_ANSWER.ACCEPT_DOUBLE && base.allowDouble;
	const created = BankEngine.createCredit(
		entry,
		playerStateIdx,
		useDouble ? base.amount * 2 : base.amount,
		useDouble ? base.interest * 2 : base.interest,
		CREDIT_ORIGIN.FIRST_QUESTION
	);
	return { answer, playerState, ...created };
};

/**
 * Sweep every still-pending Life to no-answer when the round starts.
 *
 * Recorded distinctly from an explicit decline, so silence is never read as a refusal.
 *
 * @param {{gameState: object, events: object[]}} entry
 * @returns {number[]} the Lives swept
 */
BankEngine.sweepUnansweredFirstCredit = (entry) => {
	const { gameState, events } = entry;
	const swept = [];
	for (const p of gameState.playersStates) {
		if (p.firstCreditAnswer !== CREDIT_QUESTION_ANSWER.PENDING) continue;
		p.firstCreditAnswer = CREDIT_QUESTION_ANSWER.NO_ANSWER;
		swept.push(p.idx);
		events.push(
			EventHelper.createEvent(DB_EVENTS.CREDIT_QUESTION_ANSWERED, gameState, {
				emitter: PLAYER_TYPE.BANK,
				receiver: p.idx,
				payload: { answer: CREDIT_QUESTION_ANSWER.NO_ANSWER },
			})
		);
	}
	return swept;
};

/**
 * Settle a dying Life's outstanding credits from its coins and then its cards, at face value.
 *
 * Records no event: the death owns the single event describing the whole moment, and picks its
 * type from these totals. Blind to decote/fees, unlike the animator's manual seizure.
 *
 * @param {{gameState: object}} entry
 * @param {object} player - the dying Life, mutated
 * @returns {{totalCoinSeized: number, totalSeizedCardsValue: number, totalNotPayed: number,
 *            totalPayedInterest: number, totalPayedAmount: number, seizedCards: object[], credits: object[]}}
 */
BankEngine.seizureOnDead = (entry, player) => {
	const { gameState } = entry;
	let cardsValue = _.reduce(player.cards, (acc, card) => card.price + acc, 0);
	const credits = creditsOfPlayer(gameState, player.idx);

	let totalPayedInterest = 0;
	let totalPayedAmount = 0;
	let totalValuesToSeize = 0;
	let totalNotPayed = 0;

	for (const credit of credits) {
		let payedInterest = 0;
		let payedAmount = 0;
		let seizureCardsValue = 0;

		if (player.coins - credit.interest >= 0) {
			payedInterest = credit.interest;
			player.coins -= credit.interest;
			credit.interest = 0;
		} else if (cardsValue >= credit.interest) {
			cardsValue -= credit.interest;
			seizureCardsValue += credit.interest;
			credit.interest = 0;
		} else {
			seizureCardsValue += cardsValue;
			credit.interest -= cardsValue;
			cardsValue = 0;
		}

		if (player.coins - credit.amount >= 0) {
			player.coins -= credit.amount;
			payedAmount += credit.amount;
			credit.amount = 0;
		} else {
			credit.amount -= player.coins;
			payedAmount += player.coins;
			player.coins = 0;
			if (cardsValue >= credit.amount) {
				cardsValue -= credit.amount;
				seizureCardsValue += credit.amount;
				credit.amount = 0;
			} else {
				seizureCardsValue += cardsValue;
				credit.amount -= cardsValue;
				cardsValue = 0;
			}
		}

		totalPayedInterest += payedInterest;
		totalPayedAmount += payedAmount;
		totalValuesToSeize += seizureCardsValue;
		totalNotPayed += credit.interest + credit.amount;
		credit.status = CREDIT_STATUS.DONE;
	}

	const seizedCards = takeCardsWorth(player.cards, totalValuesToSeize);
	const totalSeizedCardsValue = _.reduce(seizedCards, (acc, card) => card.price + acc, 0);
	const totalCoinSeized = totalPayedInterest + totalPayedAmount;

	gameState.bankMoneyLost += totalNotPayed;
	gameState.bankMoneyDestroyed += totalPayedAmount;
	gameState.bankGoodsEarned += totalSeizedCardsValue;
	gameState.bankInterestEarned += totalPayedInterest;
	gameState.currentMassMonetary -= totalCoinSeized;

	DecksHelper.pushCardsInDecks(gameState, seizedCards);
	const seizedKeys = new Set(seizedCards.map((c) => c.key));
	player.cards = player.cards.filter((card) => !seizedKeys.has(card.key));

	return {
		totalCoinSeized,
		totalSeizedCardsValue,
		totalNotPayed,
		totalPayedInterest,
		totalPayedAmount,
		seizedCards,
		credits,
	};
};

export default BankEngine;
