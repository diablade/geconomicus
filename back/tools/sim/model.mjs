/**
 * The fast in-process game model.
 *
 * Reuses the shipped game's pure helpers for deck generation, production, seizure
 * and the universal dividend, so results can only drift from a real game where the
 * model deliberately diverges. Time is counted in rounds: each living player takes
 * at most one round-costing action per round, and an action costs a round only when
 * it needs another person's cooperation.
 *
 * `./rng.mjs` must stay the first import — it installs the seeded dispatcher that
 * lodash captures, and lodash loads through the helpers imported just below.
 *
 * @module tools/sim/model
 */
import { setSeed, shuffled } from './rng.mjs';
import { setupGameJune, setupGameDebt } from '../../src/gameState/helpers/setup.helper.js';
import PlayerEngine from '../../src/gameState/engine/player.engine.js';
import BankEngine, { creditsOfPlayer } from '../../src/gameState/engine/bank.engine.js';
import DecksEngine from '../../src/gameState/engine/decks.engine.js';
import GameEngine from '../../src/gameState/engine/game.engine.js';
import { PLAYER_STATUS, GAME_TYPE, CREDIT_STATUS, CREDIT_ORIGIN, GAME_STATUS } from '@geco/shared';
import { readySquaresOf, sampleState, giniOf, recipeKeyOf } from './metrics.mjs';
import { triggerTechShift, produceAboveCeiling, topWeightOf, priceLadderOf } from './techshift.mjs';
import {
	pooledCopiesOf,
	findPurchase,
	findAnyAffordableTarget,
	classifySearch,
	wantsCredit,
	maturityChoice,
} from './agent.mjs';

const { ALIVE, DEAD, PRISON } = PLAYER_STATUS;
const JUNE = GAME_TYPE.JUNE;

const MAX_CASCADE = 64;

export const ROUNDS_PER_MINUTE = 2;
export const DEFAULT_ROUNDS = 50;
const MAX_LOG_ENTRIES = 20000;

/**
 * Append one entry to the run's action log, unless the cap has been reached.
 *
 * The cap keeps a long endurance run from exhausting memory; hitting it sets a
 * flag so the report can say the log was cut short rather than silently lie.
 *
 * @param {object} stats - run accumulator, mutated
 * @param {object} entry - the action to record
 * @returns {void}
 */
function logAction(stats, entry) {
	if (!stats.logEnabled) return;
	if (stats.log.length >= MAX_LOG_ENTRIES) {
		stats.logTruncated = true;
		return;
	}
	stats.log.push(entry);
}

const SEARCH_DETAIL = {
	complete: () => 'nothing left to chase — hand already holds a full recipe',
	broke: (outcome, player) => `met a seller at ${outcome.price}, held only ${player.coins}`,
	refused: () => 'met a holder, but they are hoarding that recipe',
	notMet: () => 'nobody met this round held a needed copy',
	nowhere: () => 'no living player holds a needed copy — stranded in the deck',
};

export const REFERENCE_SESSION ={ players: 14, rounds: 50, productions: 62, transactions: 284 };
export const REFERENCE_PRODUCTIONS_PER_PLAYER_ROUND =
	REFERENCE_SESSION.productions / REFERENCE_SESSION.players / REFERENCE_SESSION.rounds;

/**
 * Express a run's production tempo relative to the calibrated baseline.
 *
 * Answers "is this table too starved or too abundant" in one number, independent
 * of player count and session length.
 *
 * @param {number} productions - total productions in the run
 * @param {number} players
 * @param {number} rounds
 * @returns {{ratio: number, perPlayerRound: number, band: 'freezing'|'cold'|'neutral'|'hot'|'burning'}}
 */
export function temperatureOf(productions, players, rounds) {
	if (!players || !rounds) return { ratio: 0, band: 'cold' };
	const perPlayerRound = productions / players / rounds;
	const ratio = perPlayerRound / REFERENCE_PRODUCTIONS_PER_PLAYER_ROUND;
	const band =
		ratio < 0.4 ? 'freezing' : ratio < 0.75 ? 'cold' : ratio <= 1.5 ? 'neutral' : ratio <= 3 ? 'hot' : 'burning';
	return { ratio, perPlayerRound, band };
}

/**
 * The shipped game's default rules, with caller overrides applied on top.
 *
 * @param {object} [overrides]
 * @returns {object} a complete rules object accepted by the real setup helpers
 */
export function defaultRules(overrides = {}) {
	return {
		amountCardsForProd: 4,
		generatedIdenticalLetters: 5,
		generateLettersAuto: true,
		generateLettersInDeck: undefined,
		distribInitCards: 4,
		startAmountCoins: 5,
		startingTokens: 1,
		priceWeight1: 1,
		priceWeight2: 2,
		priceWeight3: 4,
		priceWeight4: 8,
		tauxCroissance: 10,
		inequalityStart: false,
		pctPoor: 10,
		pctRich: 10,
		autoDeath: true,
		timerDUInterval: 60,
		durationCredit: 5,
		timerPrison: 5,
		defaultCreditAmount: 3,
		defaultInterestAmount: 1,
		seizureType: CREDIT_STATUS.DECOTE,
		seizureDecote: 33,
		seizureCosts: 2,
		autoBank: false,
		autoSeizure: false,
		firstCreditAcceptance: 0,
		techShiftEnabled: false,
		techShiftExchangeRatio: 1,
		...overrides,
	};
}

/**
 * Players currently alive and able to trade.
 *
 * @param {object} gameState
 * @returns {Array<object>}
 */
function livingOf(gameState) {
	return gameState.playersStates.filter((p) => p.status === ALIVE);
}

/**
 * Players eligible to take an action this round.
 *
 * @param {object} gameState
 * @returns {Array<object>}
 */
function actableOf(gameState) {
	return gameState.playersStates.filter((p) => p.status === ALIVE);
}

/**
 * Spread each avatar's death evenly across the run.
 *
 * Deterministic rather than random, so death pressure is comparable between seeds
 * and every avatar gets a comparable amount of life.
 *
 * @param {number} rounds
 * @param {number} avatarCount
 * @returns {Map<number, number[]>} round to the avatar indexes dying in it
 */
function deathScheduleFor(rounds, avatarCount) {
	const interval = rounds / (avatarCount + 1);
	const schedule = new Map();
	for (let k = 1; k <= avatarCount; k++) {
		const round = Math.max(1, Math.round(interval * k));
		if (!schedule.has(round)) schedule.set(round, []);
		schedule.get(round).push(k - 1);
	}
	return schedule;
}

/**
 * Count cards per level, for a log line that shows the movement rather than a total.
 *
 * @param {Array<{weight: number}>} cards
 * @returns {string} of the form `"w0×3, w1×2"`, or `"nothing"` when empty
 */
function byLevelOf(cards) {
	const tally = new Map();
	for (const card of cards) tally.set(card.weight, (tally.get(card.weight) ?? 0) + 1);
	const parts = [...tally.entries()].sort((a, b) => a[0] - b[0]).map(([w, n]) => `w${w}×${n}`);
	return parts.length ? parts.join(', ') : 'nothing';
}

/**
 * Kill an avatar's life and open a new one, through the real game engine.
 *
 * Delegates every state change to PlayerEngine.reincarnate — seizure, card return,
 * the fresh deal — so the simulator cannot drift from what a live game does. Only
 * the bookkeeping and the action log belong to the simulator.
 *
 * The one deliberate divergence: the dead hand is emptied. A live game keeps it as a
 * frozen snapshot because the final score is read off it, and clones the cards into
 * the decks. The simulator scores nothing, so it lets the cards actually leave the
 * hand — otherwise every death would double the cards it touched.
 *
 * @param {object} gameState - mutated
 * @param {object} rules
 * @param {Array<object>} events - in-memory event log, appended to
 * @param {number} avatarIdx
 * @param {object} stats - run accumulator, mutated
 * @param {number} round
 * @returns {void}
 */
function reincarnate(gameState, rules, events, avatarIdx, stats, round) {
	const current = gameState.playersStates.find((p) => p.avatarIdx === avatarIdx && p.status !== DEAD);
	if (!current) return;

	const decksBefore = gameState.decks.map((d) => d.length);
	const heldBefore = current.cards.length;
	const coinsBefore = current.coins;
	const creditsBefore = gameState.credits.filter((c) => c.playerStateIdx === current.idx).length;

	const result = PlayerEngine.reincarnate({ gameState, rules, events }, avatarIdx);
	if (!result) return;

	const returned = result.death.returnedCards;
	current.cards = [];

	const decksAfterReturn = decksBefore.slice();
	for (const card of returned) decksAfterReturn[card.weight] += 1;

	if (creditsBefore && result.death.seizure) {
		stats.seizures++;
		stats.coinsSeized += result.death.seizure.totalCoinSeized;
		logAction(stats, {
			round,
			playerIdx: result.oldPlayerStateIdx,
			avatarIdx,
			type: 'seizure',
			free: true,
			detail: `on death: coins ${result.death.seizure.totalCoinSeized}, ${result.death.seizure.seizedCards.length} card(s)`,
			coins: current.coins,
			handSize: current.cards.length,
		});
	}

	stats.deaths++;
	stats.ghostMoney += current.coins;
	logAction(stats, {
		round,
		playerIdx: result.oldPlayerStateIdx,
		avatarIdx,
		type: 'death',
		free: true,
		detail: `returned ${returned.length} card(s) to decks (${byLevelOf(returned)}), decks [${decksBefore.join(
			'/'
		)}] → [${decksAfterReturn.join('/')}], ${coinsBefore} ghost coins`,
		coins: coinsBefore,
		handSize: heldBefore,
	});

	stats.rebirths++;
	logAction(stats, {
		round,
		playerIdx: result.newPlayerStateIdx,
		avatarIdx,
		type: 'birth',
		free: true,
		detail: `new life dealt ${result.newCards.length} card(s), decks now [${gameState.decks
			.map((d) => d.length)
			.join('/')}]`,
		coins: 0,
		handSize: result.newCards.length,
	});
}

/**
 * Resolve every faulted credit of a debtor through the real auto-seizure engine.
 *
 * The engine decides seizure and imprisonment; the simulator only converts the
 * prison sentence from minutes into rounds and records the log entries.
 *
 * @param {object} gameState - mutated
 * @param {object} rules
 * @param {Array<object>} events - in-memory event log, appended to
 * @param {number} playerStateIdx
 * @param {object} stats - run accumulator, mutated
 * @param {number} round
 * @returns {object|null} the engine outcome, or null when nothing was in fault
 */
function applySeizure(gameState, rules, events, playerStateIdx, stats, round) {
	const outcome = BankEngine.applyAutoSeizure({ gameState, rules, events }, playerStateIdx);
	if (!outcome) return null;

	const player = outcome.playerState;
	stats.seizures++;
	stats.coinsSeized += outcome.coinsSeized;

	logAction(stats, {
		round,
		playerIdx: player.idx,
		avatarIdx: player.avatarIdx,
		type: 'seizure',
		free: true,
		detail: `coins ${outcome.coinsSeized}, ${outcome.seizedCards.length} card(s), unpaid ${outcome.unpaid.toFixed(2)}`,
		coins: player.coins,
		handSize: player.cards.length,
	});

	if (outcome.imprisoned) {
		const sentence = Math.max(1, Math.round(outcome.prisonMinutes * ROUNDS_PER_MINUTE));
		player.prisonUntilRound = round + sentence;
		stats.prisonSentences++;
		logAction(stats, {
			round,
			playerIdx: player.idx,
			avatarIdx: player.avatarIdx,
			type: 'prison',
			free: true,
			detail: `${sentence} round(s), released round ${player.prisonUntilRound}`,
			coins: player.coins,
			handSize: 0,
		});
	}
	return outcome;
}


/**
 * Fire the technological shift and record every trace of it.
 *
 * @param {object} gameState - mutated
 * @param {object} rules
 * @param {Array<object>} events - in-memory event log, appended to
 * @param {object} player - the Life whose production proved the technology
 * @param {object} stats - run accumulator, mutated
 * @param {number} round
 * @returns {void}
 */
function recordTechShift(gameState, rules, events, player, stats, round) {
	const decksBefore = gameState.decks.map((d) => d.length);
	const shift = triggerTechShift(gameState, rules, events, round, player.idx);
	if (!shift) return;

	stats.cardsMintedTotal += shift.cardsMinted;
	stats.techShifts.push({
		round,
		topWeight: shift.topWeight,
		ladder: shift.ladder,
		retiredPlayers: shift.exchanges.length,
		retiredCards: shift.retiredCards,
		replacementCards: shift.replacementCards,
	});
	logAction(stats, {
		round,
		playerIdx: player.idx,
		avatarIdx: player.avatarIdx,
		type: 'techshift',
		free: true,
		detail: `level ${shift.topWeight} opens (${shift.cardsMinted} cards), prices now ${shift.ladder.join(
			'/'
		)}, ${shift.retiredCards} card(s) retired by ${shift.exchanges.length} player(s) for ${
			shift.replacementCards
		} replacement(s), decks [${decksBefore.join('/')}] → [${gameState.decks.map((d) => d.length).join('/')}]`,
		coins: player.coins,
		handSize: player.cards.length,
	});
	for (const exchange of shift.exchanges) {
		stats.retirements++;
		logAction(stats, {
			round,
			playerIdx: exchange.playerIdx,
			avatarIdx: exchange.avatarIdx,
			type: 'retire',
			free: true,
			detail: `returned ${exchange.returned} card(s) at level ${exchange.levels.join('/')}, drew ${
				exchange.drawn
			} one level up (${rules.techShiftExchangeRatio}:1)`,
			handSize: gameState.playersStates.find((p) => p.idx === exchange.playerIdx)?.cards.length,
		});
	}
}

/**
 * Produce every complete recipe in a hand, repeatedly, until none is left.
 *
 * Production costs no round because it is a solo action, and each one draws
 * replacement cards that can complete another recipe — so it cascades.
 *
 * A production that lands a card on the current top level is what triggers the
 * technological shift: the first top-level good proves the technology, and the whole
 * table shifts behind it. Reaching for a level that has no level above it is the wall
 * instead — either the shift is switched off, or the colour ceiling is spent.
 *
 * @param {object} gameState - mutated
 * @param {object} rules
 * @param {Array<object>} events - in-memory event log, appended to
 * @param {object} player - mutated
 * @param {object} stats - run accumulator, mutated
 * @param {number} round
 * @returns {number} how many productions fired
 */
function cascadeProduction(gameState, rules, events, player, stats, round) {
	const need = rules.amountCardsForProd;
	let built = 0;
	while (built < MAX_CASCADE) {
		const ready = readySquaresOf(player, need);
		if (!ready.length) break;

		const [letter, weightRaw] = ready[0].split(':');
		const weight = Number(weightRaw);
		if (weight >= topWeightOf(gameState)) {
			stats.techShiftRound = stats.techShiftRound ?? round;
			stats.techShiftReached++;
			break;
		}
		const opensTopLevel = weight + 1 === topWeightOf(gameState);

		const seen = new Set();
		const chosen = [];
		for (const card of player.cards) {
			if (card.letter !== letter || card.weight !== weight) continue;
			if (seen.has(card.key)) continue;
			seen.add(card.key);
			chosen.push({ key: card.key });
			if (chosen.length === need) break;
		}
		if (chosen.length < need) break;

		try {
			const entry = { gameState, rules, events };
			if (weight >= 3) produceAboveCeiling(entry, player.idx, chosen);
			else DecksEngine.produce(entry, player.idx, chosen);
		} catch (error) {
			stats.hardThrows.push({ round, playerIdx: player.idx, weight, message: error.message });
			break;
		}
		built++;
		stats.productions++;
		stats.highestWeightProduced = Math.max(stats.highestWeightProduced, weight + 1);
		stats.productionsByAvatar.set(player.avatarIdx, (stats.productionsByAvatar.get(player.avatarIdx) ?? 0) + 1);
		logAction(stats, {
			round,
			playerIdx: player.idx,
			avatarIdx: player.avatarIdx,
			type: 'produce',
			free: true,
			detail: `${letter} w${weight} → w${weight + 1}`,
			handSize: player.cards.length,
		});

		if (opensTopLevel && rules.techShiftEnabled) recordTechShift(gameState, rules, events, player, stats, round);
	}
	return built;
}

/**
 * Play one complete game and return everything measured about it.
 *
 * Each round every living player takes at most one round-costing action — buy,
 * borrow, or search. Producing, selling, settling a credit and dying are free,
 * because none of them requires another person's cooperation.
 *
 * Deck generation, production, seizure and the universal dividend all run through
 * the shipped game helpers, so the model can only drift from the real game where
 * it deliberately diverges.
 *
 * @param {object} options
 * @param {number} options.players - table size
 * @param {'june'|'debt'} [options.typeMoney] - free money or debt
 * @param {object} [options.rules] - rule overrides merged over the defaults
 * @param {number} [options.seed] - run seed; the same seed replays exactly
 * @param {number} [options.rounds] - length in rounds, the only unit of time
 * @param {number} [options.encountersPerRound] - how many other players are met per round
 * @param {number} [options.animatorCreditsPerRound] - credit throughput, the debt bottleneck
 * @param {boolean} [options.logActions] - record the per-action log
 * @returns {Promise<object>} totals, per-round samples, temperature and the action log
 */
export async function runGame(options) {
	const {
		players,
		typeMoney = JUNE,
		rules: ruleOverrides = {},
		seed = 1,
		rounds = DEFAULT_ROUNDS,
		encountersPerRound = 1,
		animatorCreditsPerRound = Infinity,
		logActions = true,
	} = options;

	const rules = defaultRules(ruleOverrides);
	setSeed(seed);

	{
		const gameState = {
			_id: `sim-${typeMoney}-${players}p-seed${seed}`,
			sessionId: 'simulation',
			status: GAME_STATUS.PLAYING,
			typeMoney,
			playersStates: Array.from({ length: players }, (_, i) => ({
				idx: i,
				avatarIdx: i,
				status: ALIVE,
				coins: 0,
				cards: [],
				actionTokens: rules.startingTokens ?? 1,
			})),
			playerStateIndexSeq: players,
			currentMassMonetary: 0,
			currentDU: 0,
			decks: [],
			credits: [],
			creditIndexSeq: 0,
			bankInterestEarned: 0,
			bankMoneyLost: 0,
			bankMoneyDestroyed: 0,
			bankGoodsEarned: 0,
		};
		const events = [];

		if (typeMoney === JUNE) await setupGameJune(gameState, rules);
		else await setupGameDebt(gameState, rules);
		gameState.credits = gameState.credits ?? [];
		gameState.priceLadder = priceLadderOf(rules);
		const initialCards = gameState.decks.reduce((sum, d) => sum + d.length, 0) + gameState.playersStates.reduce((sum, p) => sum + p.cards.length, 0);

		const stats = {
			transactions: 0,
			productions: 0,
			searches: 0,
			searchReasons: {},
			creditActions: 0,
			creditsCreated: 0,
			creditsExtended: 0,
			creditsSettled: 0,
			faults: 0,
			seizures: 0,
			coinsSeized: 0,
			prisonSentences: 0,
			interestPaid: 0,
			firstQuestionCredits: 0,
			seizuresDelayed: 0,
			deaths: 0,
			rebirths: 0,
			ghostMoney: 0,
			techShiftReached: 0,
			techShiftRound: null,
			techShifts: [],
			highestWeightProduced: 0,
			cardsMintedTotal: 0,
			retirements: 0,
			hardThrows: [],
			productionsByAvatar: new Map(),
			slots: 0,
			samples: [],
			log: [],
			logEnabled: logActions,
			logTruncated: false,
		};

		const need = rules.amountCardsForProd;
		const duEvery = Math.max(1, Math.round((rules.timerDUInterval / 60) * ROUNDS_PER_MINUTE));
		const creditRounds = Math.max(1, Math.round(rules.durationCredit * ROUNDS_PER_MINUTE));
		const animatorSlotsPerRound = rules.autoBank ? Infinity : animatorCreditsPerRound;
		const pendingSeizures = [];

		const openCreditsOf = (player) =>
			creditsOfPlayer(gameState, player.idx).filter(
				(c) =>
					c.status !== CREDIT_STATUS.DONE &&
					c.status !== CREDIT_STATUS.CANCELED &&
					c.status !== CREDIT_STATUS.FAULT
			);

		const issueCredit = (player, round, origin) => {
			const { credit } = BankEngine.createCredit(
				{ gameState, rules, events },
				player.idx,
				rules.defaultCreditAmount,
				rules.defaultInterestAmount,
				origin
			);
			credit.maturesAtRound = round + creditRounds;
			stats.creditsCreated++;
			return credit;
		};

		if (typeMoney !== JUNE && rules.firstCreditAcceptance > 0) {
			const takers = shuffled(gameState.playersStates).slice(
				0,
				Math.round((rules.firstCreditAcceptance / 100) * players)
			);
			for (const taker of takers) {
				issueCredit(taker, 0, CREDIT_ORIGIN.FIRST_QUESTION);
				stats.firstQuestionCredits++;
			}
		}
		const deathSchedule = rules.autoDeath ? deathScheduleFor(rounds, players) : new Map();
		const priceOf = (card) => PlayerEngine.priceOfCard({ gameState }, card);

		for (let round = 1; round <= rounds; round++) {
			for (const avatarIdx of deathSchedule.get(round) ?? []) {
				reincarnate(gameState, rules, events, avatarIdx, stats, round);
			}

			for (const player of gameState.playersStates) {
				if (player.status !== PRISON || player.prisonUntilRound > round) continue;
				const released = BankEngine.releaseFromPrison({ gameState, rules, events }, player.idx);
				if (!released) continue;
				logAction(stats, {
					round,
					playerIdx: player.idx,
					avatarIdx: player.avatarIdx,
					type: 'release',
					free: true,
					detail: `out of prison, dealt ${released.newCards.length} card(s)`,
					coins: player.coins,
					handSize: player.cards.length,
				});
			}

			if (GameEngine.paysDividend(gameState) && round % duEvery === 0 && livingOf(gameState).length) {
				const { du, alive } = await GameEngine.distributeDU({ gameState, rules, events });
				logAction(stats, {
					round,
					playerIdx: -1,
					avatarIdx: -1,
					type: 'du',
					free: true,
					detail: `+${du} to ${alive.length} alive, mass ${gameState.currentMassMonetary.toFixed(2)}`,
				});
			}

			const pooledForMaturity = pooledCopiesOf(livingOf(gameState));
			for (const player of gameState.playersStates) {
				if (player.status === DEAD) continue;
				for (const credit of openCreditsOf(player)) {
					if (credit.maturesAtRound > round) continue;
					const neededPrice = findAnyAffordableTarget(player, livingOf(gameState), pooledForMaturity, priceOf, need);
					const choice = maturityChoice(player, credit, neededPrice);

					if (choice === 'settle') {
						BankEngine.settleCredit({ gameState, rules, events }, credit.id);
						stats.creditsSettled++;
						stats.interestPaid += credit.interest;
						logAction(stats, {
							round,
							playerIdx: player.idx,
							avatarIdx: player.avatarIdx,
							type: 'settle',
							free: true,
							detail: `repaid ${credit.amount} + ${credit.interest}`,
							coins: player.coins,
							handSize: player.cards.length,
						});
					} else if (choice === 'extend') {
						const interest = credit.interest;
						BankEngine.extendCredit({ gameState, rules, events }, credit.id);
						credit.maturesAtRound = round + creditRounds;
						stats.creditsExtended++;
						stats.interestPaid += interest;
						logAction(stats, {
							round,
							playerIdx: player.idx,
							avatarIdx: player.avatarIdx,
							type: 'extend',
							free: true,
							detail: `interest ${interest} paid, due round ${credit.maturesAtRound}`,
							coins: player.coins,
							handSize: player.cards.length,
						});
					} else {
						BankEngine.faultCredit({ gameState, rules, events }, credit, player);
						stats.faults++;
						logAction(stats, {
							round,
							playerIdx: player.idx,
							avatarIdx: player.avatarIdx,
							type: 'fault',
							free: true,
							detail: `owed ${credit.amount + credit.interest}, coins ${player.coins}`,
							coins: player.coins,
							handSize: player.cards.length,
						});
						if (rules.autoSeizure) {
							applySeizure(gameState, rules, events, player.idx, stats, round);
						} else {
							pendingSeizures.push({ playerIdx: player.idx });
							stats.seizuresDelayed++;
						}
					}
				}
			}

			let animatorSlotsLeft = animatorSlotsPerRound;

			while (animatorSlotsLeft > 0 && pendingSeizures.length) {
				const queued = pendingSeizures.shift();
				const debtor = gameState.playersStates.find((p) => p.idx === queued.playerIdx);
				animatorSlotsLeft--;
				if (!debtor || debtor.status === DEAD) continue;
				applySeizure(gameState, rules, events, debtor.idx, stats, round);
			}

			const actors = shuffled(actableOf(gameState));
			for (const player of actors) {
				if (player.status !== ALIVE) continue;
				stats.slots++;
				cascadeProduction(gameState, rules, events, player, stats, round);

				const living = livingOf(gameState);
				const pooled = pooledCopiesOf(living);
				const encounterCount =
					Math.floor(encountersPerRound) + (Math.random() < encountersPerRound % 1 ? 1 : 0);
				const encountered = shuffled(living.filter((p) => p.idx !== player.idx)).slice(0, encounterCount);
				const purchase = findPurchase(player, encountered, pooled, priceOf, need);

				if (purchase) {
					const { seller, card } = purchase;
					const { cost: price } = PlayerEngine.applyTransaction(
						{ gameState, rules, events },
						player.idx,
						seller.idx,
						card.key
					);
					stats.transactions++;
					logAction(stats, {
						round,
						playerIdx: player.idx,
						avatarIdx: player.avatarIdx,
						type: 'buy',
						free: false,
						detail: `${card.key} from #${seller.idx} for ${price}`,
						counterparty: seller.idx,
						coins: player.coins,
						handSize: player.cards.length,
					});
					logAction(stats, {
						round,
						playerIdx: seller.idx,
						avatarIdx: seller.avatarIdx,
						type: 'sell',
						free: true,
						detail: `${card.key} to #${player.idx} for ${price}`,
						counterparty: player.idx,
						coins: seller.coins,
						handSize: seller.cards.length,
					});
					cascadeProduction(gameState, rules, events, player, stats, round);
					continue;
				}

				if (typeMoney !== JUNE) {
					const neededPrice = findAnyAffordableTarget(player, living, pooled, priceOf, need);
					if (animatorSlotsLeft > 0 && wantsCredit(gameState, player, neededPrice, rules)) {
						animatorSlotsLeft--;
						issueCredit(player, round, CREDIT_ORIGIN.PLAYER_REQUEST);
						stats.creditActions++;
						logAction(stats, {
							round,
							playerIdx: player.idx,
							avatarIdx: player.avatarIdx,
							type: 'credit',
							free: false,
							detail: `+${rules.defaultCreditAmount} (interest ${rules.defaultInterestAmount})`,
							coins: player.coins,
							handSize: player.cards.length,
						});
						continue;
					}
				}

				stats.searches++;
				const searchOutcome = classifySearch(player, encountered, living, pooled, priceOf, need);
				stats.searchReasons[searchOutcome.reason] = (stats.searchReasons[searchOutcome.reason] ?? 0) + 1;
				logAction(stats, {
					round,
					playerIdx: player.idx,
					avatarIdx: player.avatarIdx,
					type: 'search',
					free: false,
					reason: searchOutcome.reason,
					reasonPrice: searchOutcome.price,
					detail: SEARCH_DETAIL[searchOutcome.reason](searchOutcome, player),
					coins: player.coins,
					handSize: player.cards.length,
				});
			}

			stats.samples.push({ round, ...sampleState(gameState, need, livingOf(gameState)) });
		}

		const living = livingOf(gameState);
		const perAvatar = Array.from({ length: players }, (_, a) => stats.productionsByAvatar.get(a) ?? 0);
		const finalSample = stats.samples[stats.samples.length - 1] ?? null;

		return {
			config: { players, typeMoney, rounds, seed, rules },
			transactions: stats.transactions,
			productions: stats.productions,
			searches: stats.searches,
			searchReasons: stats.searchReasons,
			creditActions: stats.creditActions,
			slots: stats.slots,
			utilisation: stats.slots ? (stats.transactions + stats.creditActions) / stats.slots : 0,
			transactionsPerProduction: stats.productions ? stats.transactions / stats.productions : null,
			productionsPerAvatar: perAvatar,
			minProductions: Math.min(...perAvatar),
			everyoneProduced: perAvatar.every((n) => n > 0),
			giniProductions: giniOf(perAvatar),
			deaths: stats.deaths,
			rebirths: stats.rebirths,
			ghostMoney: stats.ghostMoney,
			temperature: temperatureOf(stats.productions, players, rounds),
			referenceProductionsPerPlayerRound: REFERENCE_PRODUCTIONS_PER_PLAYER_ROUND,
			firstQuestionCredits: stats.firstQuestionCredits,
			seizuresDelayed: stats.seizuresDelayed,
			creditsCreated: stats.creditsCreated,
			creditsExtended: stats.creditsExtended,
			creditsSettled: stats.creditsSettled,
			faults: stats.faults,
			seizures: stats.seizures,
			prisonSentences: stats.prisonSentences,
			interestPaid: stats.interestPaid,
			techShiftReached: stats.techShiftReached,
			techShifts: stats.techShifts,
			highestWeightProduced: stats.highestWeightProduced,
			retirements: stats.retirements,
			events,
			finalHandCards: gameState.playersStates.reduce((sum, p) => sum + p.cards.length, 0),
			cardsMintedTotal: initialCards + stats.cardsMintedTotal,
			priceLadder: gameState.priceLadder,
			topWeight: topWeightOf(gameState),
			techShiftRound: stats.techShiftRound,
			hardThrows: stats.hardThrows,
			log: stats.log,
			logTruncated: stats.logTruncated,
			finalSample,
			finalMass: gameState.currentMassMonetary,
			finalDU: gameState.currentDU,
			aliveAtEnd: living.length,
			samples: stats.samples,
		};
	}
}
