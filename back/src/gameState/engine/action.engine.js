import _ from 'lodash';
import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS } from '@geco/shared';
import EventHelper from '../helpers/event.helper.js';

const ActionEngine = {};

/** The per-game configuration of one action, or a throw when it is unknown or switched off. */
const configOf = (rules, actionKey) => {
	const action = (rules.actions || []).find((a) => a.key === actionKey);
	if (!action) throw new Error('ERROR.ACTION_NOT_FOUND');
	if (!action.enabled) throw new Error('ERROR.ACTION_DISABLED');
	return action;
};

/** Spend an action's cost from a Life's tokens, or throw when it cannot afford it. */
const spendTokens = (player, cost) => {
	if ((player.actionTokens ?? 0) < cost) throw new Error('ERROR.NOT_ENOUGH_TOKENS');
	player.actionTokens = (player.actionTokens ?? 0) - cost;
};

/** A living Life by index, or a throw naming which role was missing. */
const aliveOrThrow = (gameState, idx, error) => {
	const player = gameState.playersStates.find((p) => p.idx === idx);
	if (!player || player.status !== PLAYER_STATUS.ALIVE) throw new Error(error);
	return player;
};

/** A card in a Life's hand, or a throw. */
const cardOrThrow = (player, cardKey) => {
	const card = player.cards.find((c) => c.key === cardKey);
	if (!card) throw new Error('ERROR.CARD_NOT_FOUND');
	return card;
};

/** Net worth used to rank who the ONG should help: cards plus coins, less what is owed. */
ActionEngine.wealthScore = (player, credits, typeMoney) => {
	const cardValue = player.cards.reduce((sum, c) => sum + (c.price ?? 0), 0);
	let debt = 0;
	if (typeMoney === GAME_TYPE.DEBT && credits) {
		debt = credits
			.filter((c) => c.playerStateIdx === player.idx)
			.reduce((sum, c) => sum + (c.amount ?? 0), 0);
	}
	return cardValue + player.coins - debt;
};

/** The two poorest living Lives other than the actor, by {@link ActionEngine.wealthScore}. */
ActionEngine.twoPoorestPlayers = (gameState, excludeIdx) =>
	gameState.playersStates
		.filter((p) => p.status === PLAYER_STATUS.ALIVE && p.idx !== excludeIdx)
		.map((p) => ({ player: p, score: ActionEngine.wealthScore(p, gameState.credits, gameState.typeMoney) }))
		.sort((a, b) => a.score - b.score)
		.slice(0, 2)
		.map((e) => e.player);

/** Up to `count` cards drawn at random from a hand, without replacement. */
const randomCards = (player, count) => _.shuffle(player.cards).slice(0, Math.min(count, player.cards.length));

/** Hand one card to another player, freely. */
ActionEngine.give = (entry, giverIdx, receiverIdx, cardKey) => {
	const { gameState, rules, events } = entry;
	const action = configOf(rules, 'give');
	const giver = aliveOrThrow(gameState, giverIdx, 'ERROR.PLAYER_NOT_FOUND');
	const receiver = aliveOrThrow(gameState, receiverIdx, 'ERROR.TARGET_NOT_FOUND');
	const card = cardOrThrow(giver, cardKey);

	spendTokens(giver, action.cost);
	giver.cards = giver.cards.filter((c) => c.key !== cardKey);
	receiver.cards.push(card);

	events.push(
		EventHelper.createEvent(DB_EVENTS.ACTION_GIVE, gameState, {
			emitter: giverIdx,
			receiver: receiverIdx,
			payload: { card },
		})
	);

	return { giver, receiver, card };
};

/** Take one named card from another player, who is told about it. */
ActionEngine.steal = (entry, stealerIdx, victimIdx, cardKey) => {
	const { gameState, rules, events } = entry;
	const action = configOf(rules, 'steal');
	const stealer = aliveOrThrow(gameState, stealerIdx, 'ERROR.PLAYER_NOT_FOUND');
	const victim = aliveOrThrow(gameState, victimIdx, 'ERROR.TARGET_NOT_FOUND');
	const card = cardOrThrow(victim, cardKey);

	spendTokens(stealer, action.cost);
	victim.cards = victim.cards.filter((c) => c.key !== cardKey);
	stealer.cards.push(card);

	events.push(
		EventHelper.createEvent(DB_EVENTS.ACTION_STEAL, gameState, {
			emitter: stealerIdx,
			receiver: victimIdx,
			payload: { card },
		})
	);

	return { stealer, victim, card };
};

/** Steal without the theatre: the victim's board simply updates, with no popup. */
ActionEngine.silentSteal = (entry, stealerIdx, victimIdx, cardKey) => {
	const { gameState, rules, events } = entry;
	const action = configOf(rules, 'silentSteal');
	const stealer = aliveOrThrow(gameState, stealerIdx, 'ERROR.PLAYER_NOT_FOUND');
	const victim = aliveOrThrow(gameState, victimIdx, 'ERROR.TARGET_NOT_FOUND');
	const card = cardOrThrow(victim, cardKey);

	spendTokens(stealer, action.cost);
	victim.cards = victim.cards.filter((c) => c.key !== cardKey);
	stealer.cards.push(card);

	events.push(
		EventHelper.createEvent(DB_EVENTS.ACTION_SILENT_STEAL, gameState, {
			emitter: stealerIdx,
			receiver: victimIdx,
			payload: { card },
		})
	);

	return { stealer, victim, card };
};

/** Give one card each to two different players at once. */
ActionEngine.association = (entry, giverIdx, cardKeys, targetIdxs) => {
	const { gameState, rules, events } = entry;
	const action = configOf(rules, 'association');
	const giver = aliveOrThrow(gameState, giverIdx, 'ERROR.PLAYER_NOT_FOUND');
	if (cardKeys.length !== 2) throw new Error('ERROR.ASSOCIATION_REQUIRES_2_CARDS');
	if (targetIdxs[0] === targetIdxs[1]) throw new Error('ERROR.TARGETS_MUST_BE_DIFFERENT');

	const cards = cardKeys.map((key) => cardOrThrow(giver, key));
	const targets = targetIdxs.map((idx) => aliveOrThrow(gameState, idx, 'ERROR.TARGET_NOT_FOUND'));

	spendTokens(giver, action.cost);
	const givenKeys = cards.map((c) => c.key);
	giver.cards = giver.cards.filter((c) => !givenKeys.includes(c.key));
	targets.forEach((target, i) => target.cards.push(cards[i]));

	events.push(
		EventHelper.createEvent(DB_EVENTS.ACTION_ASSOCIATION, gameState, {
			emitter: giverIdx,
			receiver: giverIdx,
			touched: [giverIdx, ...targets.map((t) => t.idx)],
			payload: { cards, recipients: targets.map((t) => t.idx) },
		})
	);

	return { giver, targets, cards };
};

/** Take two cards at random from each of two victims. */
ActionEngine.war = (entry, attackerIdx, victim1Idx, victim2Idx) => {
	const { gameState, rules, events } = entry;
	const action = configOf(rules, 'war');
	const attacker = aliveOrThrow(gameState, attackerIdx, 'ERROR.PLAYER_NOT_FOUND');
	const victim1 = aliveOrThrow(gameState, victim1Idx, 'ERROR.TARGET1_NOT_FOUND');
	const victim2 = aliveOrThrow(gameState, victim2Idx, 'ERROR.TARGET2_NOT_FOUND');
	if (victim1Idx === victim2Idx) throw new Error('ERROR.TARGETS_MUST_BE_DIFFERENT');

	spendTokens(attacker, action.cost);

	const stolen1 = randomCards(victim1, 2);
	const stolen2 = randomCards(victim2, 2);
	const keys1 = stolen1.map((c) => c.key);
	const keys2 = stolen2.map((c) => c.key);

	victim1.cards = victim1.cards.filter((c) => !keys1.includes(c.key));
	victim2.cards = victim2.cards.filter((c) => !keys2.includes(c.key));
	attacker.cards.push(...stolen1, ...stolen2);

	events.push(
		EventHelper.createEvent(DB_EVENTS.ACTION_WAR, gameState, {
			emitter: attackerIdx,
			receiver: attackerIdx,
			touched: [attackerIdx, victim1Idx, victim2Idx],
			payload: { stolen: [...stolen1, ...stolen2], victims: [victim1Idx, victim2Idx] },
		})
	);

	return { attacker, victims: [victim1, victim2], stolen: [stolen1, stolen2] };
};

/** Give four cards away in pairs, to two named players or else to the two poorest. */
ActionEngine.ong = (entry, giverIdx, cardKeys, manualTargetIdxs) => {
	const { gameState, rules, events } = entry;
	const action = configOf(rules, 'ong');
	const giver = aliveOrThrow(gameState, giverIdx, 'ERROR.PLAYER_NOT_FOUND');
	if (cardKeys.length !== 4) throw new Error('ERROR.ONG_REQUIRES_4_CARDS');

	const cards = cardKeys.map((key) => cardOrThrow(giver, key));

	let targets;
	if (manualTargetIdxs && manualTargetIdxs.length === 2) {
		targets = manualTargetIdxs.map((idx) => aliveOrThrow(gameState, idx, 'ERROR.TARGET_NOT_FOUND'));
	} else {
		targets = ActionEngine.twoPoorestPlayers(gameState, giverIdx);
		if (targets.length < 2) throw new Error('ERROR.NOT_ENOUGH_PLAYERS');
	}

	spendTokens(giver, action.cost);
	const givenKeys = cards.map((c) => c.key);
	giver.cards = giver.cards.filter((c) => !givenKeys.includes(c.key));

	const batches = [cards.slice(0, 2), cards.slice(2, 4)];
	targets[0].cards.push(...batches[0]);
	targets[1].cards.push(...batches[1]);

	events.push(
		EventHelper.createEvent(DB_EVENTS.ACTION_ONG, gameState, {
			emitter: giverIdx,
			receiver: giverIdx,
			touched: [giverIdx, targets[0].idx, targets[1].idx],
			payload: { cards, recipients: [targets[0].idx, targets[1].idx] },
		})
	);

	return { giver, targets, cards, batches };
};

/**
 * Pay a token to learn who holds a card family, or that it is stranded in a deck.
 *
 * A mutation despite reading like a query: the token is spent whatever the answer, which is
 * what makes a doomed chase cost something. Records no event.
 *
 * @param {{gameState: object, rules: object}} entry
 * @param {number} playerStateIdx - who is asking
 * @param {string} cardKey - any copy of the family being hunted
 * @returns {{status: 'player'|'deck'|'unknown', avatarIdx?: number, actionTokens: number, player: object}}
 */
ActionEngine.whoHaveCard = (entry, playerStateIdx, cardKey) => {
	const { gameState, rules } = entry;
	const action = configOf(rules, 'whoHaveCard');
	const player = aliveOrThrow(gameState, playerStateIdx, 'ERROR.PLAYER_NOT_FOUND');

	spendTokens(player, action.cost);

	const family = cardKey.replace(/\d/g, '');
	const holds = (p) => p.cards.some((c) => c.key.replace(/\d/g, '') === family);

	const owner = gameState.playersStates
		.filter((p) => p.status === PLAYER_STATUS.ALIVE && p.idx !== playerStateIdx)
		.find(holds);

	if (owner) {
		return { status: 'player', avatarIdx: owner.avatarIdx, actionTokens: player.actionTokens, player };
	}

	const inDeck = gameState.decks.some((deck) => deck.some((c) => c.key.replace(/\d/g, '') === family));
	return { status: inDeck ? 'deck' : 'unknown', actionTokens: player.actionTokens, player };
};

export default ActionEngine;
