import GameStateManager from '../managers/GameStateManager.js';
import EventHelper from '../helpers/event.helper.js';
import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS, IO, ROOMS } from '@geco/shared';
import socket from '#config/socket';
import SyncHelper from '../helpers/sync.helper.js';
import log from '#config/log';

const ActionStateService = {};

const _getActionConfig = (rules, actionKey) => {
	const action = (rules.actions || []).find((a) => a.key === actionKey);
	if (!action) throw new Error('ERROR.ACTION_NOT_FOUND');
	if (!action.enabled) throw new Error('ERROR.ACTION_DISABLED');
	return action;
};

const _deductTokens = (player, cost) => {
	if ((player.actionTokens ?? 0) < cost) throw new Error('ERROR.NOT_ENOUGH_TOKENS');
	player.actionTokens = (player.actionTokens ?? 0) - cost;
};

const _wealthScore = (player, credits, typeMoney) => {
	const cardValue = player.cards.reduce((sum, c) => sum + (c.price ?? 0), 0);
	let debt = 0;
	if (typeMoney === GAME_TYPE.DEBT && credits) {
		debt = credits
			.filter((c) => c.playerStateIdx === player.idx)
			.reduce((sum, c) => sum + (c.amount ?? 0), 0);
	}
	return cardValue + player.coins - debt;
};

const _twoPooresPlayers = (gameState, excludeIdx) => {
	const alive = gameState.playersStates.filter(
		(p) => p.status === PLAYER_STATUS.ALIVE && p.idx !== excludeIdx
	);
	return alive
		.map((p) => ({ player: p, score: _wealthScore(p, gameState.credits, gameState.typeMoney) }))
		.sort((a, b) => a.score - b.score)
		.slice(0, 2)
		.map((e) => e.player);
};

const _randomCards = (player, count) => {
	const shuffled = [...player.cards].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, Math.min(count, shuffled.length));
};

// ─── GIVE ────────────────────────────────────────────────────────────────────

ActionStateService.give = async (gameStateId, giverIdx, receiverIdx, cardKey) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;

		const action = _getActionConfig(rules, 'give');
		const giver = gameState.playersStates.find((p) => p.idx === giverIdx);
		const receiver = gameState.playersStates.find((p) => p.idx === receiverIdx);

		if (!giver || giver.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.PLAYER_NOT_FOUND');
		if (!receiver || receiver.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.TARGET_NOT_FOUND');

		const card = giver.cards.find((c) => c.key === cardKey);
		if (!card) throw new Error('ERROR.CARD_NOT_FOUND');

		_deductTokens(giver, action.cost);
		giver.cards = giver.cards.filter((c) => c.key !== cardKey);
		receiver.cards.push(card);

		events.push(EventHelper.createEvent(DB_EVENTS.ACTION_GIVE, gameState.sessionId, gameStateId, giverIdx, receiverIdx, { card }));

		socket.emitAckTo(ROOMS.playerState(gameStateId, receiverIdx), IO.PLAYER.ACTION_DONE, {
			actionKey: 'give',
			card,
			fromAvatarIdx: giver.avatarIdx,
		});

		SyncHelper.emitPlayerSync(gameStateId, [giver, receiver]);

		return { cardsLK: giver.cards, actionTokens: giver.actionTokens };
	});
};

// ─── STEAL ───────────────────────────────────────────────────────────────────

ActionStateService.steal = async (gameStateId, stealerIdx, victimIdx, cardKey) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;

		const action = _getActionConfig(rules, 'steal');
		const stealer = gameState.playersStates.find((p) => p.idx === stealerIdx);
		const victim = gameState.playersStates.find((p) => p.idx === victimIdx);

		if (!stealer || stealer.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.PLAYER_NOT_FOUND');
		if (!victim || victim.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.TARGET_NOT_FOUND');

		const card = victim.cards.find((c) => c.key === cardKey);
		if (!card) throw new Error('ERROR.CARD_NOT_FOUND');

		_deductTokens(stealer, action.cost);
		victim.cards = victim.cards.filter((c) => c.key !== cardKey);
		stealer.cards.push(card);

		events.push(EventHelper.createEvent(DB_EVENTS.ACTION_STEAL, gameState.sessionId, gameStateId, stealerIdx, victimIdx, { card }));

		socket.emitAckTo(ROOMS.playerState(gameStateId, victimIdx), IO.PLAYER.ACTION_ROBBED, {
			actionKey: 'steal',
			card,
		});

		SyncHelper.emitPlayerSync(gameStateId, [stealer, victim]);

		return { cardsLK: stealer.cards, actionTokens: stealer.actionTokens };
	});
};

// ─── SILENT STEAL ────────────────────────────────────────────────────────────

ActionStateService.silentSteal = async (gameStateId, stealerIdx, victimIdx, cardKey) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;

		const action = _getActionConfig(rules, 'silentSteal');
		const stealer = gameState.playersStates.find((p) => p.idx === stealerIdx);
		const victim = gameState.playersStates.find((p) => p.idx === victimIdx);

		if (!stealer || stealer.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.PLAYER_NOT_FOUND');
		if (!victim || victim.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.TARGET_NOT_FOUND');

		const card = victim.cards.find((c) => c.key === cardKey);
		if (!card) throw new Error('ERROR.CARD_NOT_FOUND');

		_deductTokens(stealer, action.cost);
		victim.cards = victim.cards.filter((c) => c.key !== cardKey);
		stealer.cards.push(card);

		events.push(EventHelper.createEvent(DB_EVENTS.ACTION_SILENT_STEAL, gameState.sessionId, gameStateId, stealerIdx, victimIdx, { card }));

		// Victim's card is removed silently — no popup, just state update
		socket.emitAckTo(ROOMS.playerState(gameStateId, victimIdx), IO.PLAYER.ACTION_ROBBED, {
			actionKey: 'silentSteal',
			card,
			silent: true,
		});

		SyncHelper.emitPlayerSync(gameStateId, [stealer, victim]);

		return { cardsLK: stealer.cards, actionTokens: stealer.actionTokens };
	});
};

// ─── ASSOCIATION ─────────────────────────────────────────────────────────────

ActionStateService.association = async (gameStateId, giverIdx, cardKeys, targetIdxs) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;

		const action = _getActionConfig(rules, 'association');
		const giver = gameState.playersStates.find((p) => p.idx === giverIdx);

		if (!giver || giver.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.PLAYER_NOT_FOUND');
		if (cardKeys.length !== 2) throw new Error('ERROR.ASSOCIATION_REQUIRES_2_CARDS');
		if (targetIdxs[0] === targetIdxs[1]) throw new Error('ERROR.TARGETS_MUST_BE_DIFFERENT');

		const cardsToGive = cardKeys.map((key) => {
			const card = giver.cards.find((c) => c.key === key);
			if (!card) throw new Error('ERROR.CARD_NOT_FOUND');
			return card;
		});

		const targets = targetIdxs.map((idx) => {
			const target = gameState.playersStates.find((p) => p.idx === idx);
			if (!target || target.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.TARGET_NOT_FOUND');
			return target;
		});

		_deductTokens(giver, action.cost);

		const givenKeys = cardsToGive.map((c) => c.key);
		giver.cards = giver.cards.filter((c) => !givenKeys.includes(c.key));

		targets.forEach((target, i) => target.cards.push(cardsToGive[i]));

		events.push(EventHelper.createEvent(DB_EVENTS.ACTION_ASSOCIATION, gameState.sessionId, gameStateId, giverIdx, giverIdx, {
			cards: cardsToGive,
			recipients: targets.map((t) => t.idx),
		}));

		targets.forEach((target, i) => {
			socket.emitAckTo(ROOMS.playerState(gameStateId, target.idx), IO.PLAYER.ACTION_DONE, {
				actionKey: 'association',
				card: cardsToGive[i],
				fromAvatarIdx: giver.avatarIdx,
			});
		});

		SyncHelper.emitPlayerSync(gameStateId, [giver, ...targets]);

		return { cardsLK: giver.cards, actionTokens: giver.actionTokens };
	});
};

// ─── WAR ─────────────────────────────────────────────────────────────────────

ActionStateService.war = async (gameStateId, attackerIdx, victim1Idx, victim2Idx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;

		const action = _getActionConfig(rules, 'war');
		const attacker = gameState.playersStates.find((p) => p.idx === attackerIdx);
		const victim1 = gameState.playersStates.find((p) => p.idx === victim1Idx);
		const victim2 = gameState.playersStates.find((p) => p.idx === victim2Idx);

		if (!attacker || attacker.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.PLAYER_NOT_FOUND');
		if (!victim1 || victim1.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.TARGET1_NOT_FOUND');
		if (!victim2 || victim2.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.TARGET2_NOT_FOUND');
		if (victim1Idx === victim2Idx) throw new Error('ERROR.TARGETS_MUST_BE_DIFFERENT');

		_deductTokens(attacker, action.cost);

		const stolen1 = _randomCards(victim1, 2);
		const stolen2 = _randomCards(victim2, 2);
		const stolenKeys1 = stolen1.map((c) => c.key);
		const stolenKeys2 = stolen2.map((c) => c.key);

		victim1.cards = victim1.cards.filter((c) => !stolenKeys1.includes(c.key));
		victim2.cards = victim2.cards.filter((c) => !stolenKeys2.includes(c.key));
		attacker.cards.push(...stolen1, ...stolen2);

		events.push(EventHelper.createEvent(DB_EVENTS.ACTION_WAR, gameState.sessionId, gameStateId, attackerIdx, attackerIdx, {
			stolen: [...stolen1, ...stolen2],
			victims: [victim1Idx, victim2Idx],
		}));

		socket.emitAckTo(ROOMS.playerState(gameStateId, victim1Idx), IO.PLAYER.ACTION_ROBBED, {
			actionKey: 'war',
			cards: stolen1,
		});
		socket.emitAckTo(ROOMS.playerState(gameStateId, victim2Idx), IO.PLAYER.ACTION_ROBBED, {
			actionKey: 'war',
			cards: stolen2,
		});

		SyncHelper.emitPlayerSync(gameStateId, [attacker, victim1, victim2]);

		return { cardsLK: attacker.cards, actionTokens: attacker.actionTokens };
	});
};

// ─── ONG ─────────────────────────────────────────────────────────────────────

ActionStateService.ong = async (gameStateId, giverIdx, cardKeys, manualTargetIdxs) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules, events } = entry;

		const action = _getActionConfig(rules, 'ong');
		const giver = gameState.playersStates.find((p) => p.idx === giverIdx);

		if (!giver || giver.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.PLAYER_NOT_FOUND');
		if (cardKeys.length !== 4) throw new Error('ERROR.ONG_REQUIRES_4_CARDS');

		const cardsToGive = cardKeys.map((key) => {
			const card = giver.cards.find((c) => c.key === key);
			if (!card) throw new Error(`ERROR.CARD_NOT_FOUND`);
			return card;
		});

		let targets;
		if (manualTargetIdxs && manualTargetIdxs.length === 2) {
			targets = manualTargetIdxs.map((idx) => {
				const t = gameState.playersStates.find((p) => p.idx === idx);
				if (!t || t.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.TARGET_NOT_FOUND');
				return t;
			});
		} else {
			targets = _twoPooresPlayers(gameState, giverIdx);
			if (targets.length < 2) throw new Error('ERROR.NOT_ENOUGH_PLAYERS');
		}

		_deductTokens(giver, action.cost);

		const givenKeys = cardsToGive.map((c) => c.key);
		giver.cards = giver.cards.filter((c) => !givenKeys.includes(c.key));

		// 2 cards to each target
		const batch1 = cardsToGive.slice(0, 2);
		const batch2 = cardsToGive.slice(2, 4);
		targets[0].cards.push(...batch1);
		targets[1].cards.push(...batch2);

		events.push(EventHelper.createEvent(DB_EVENTS.ACTION_ONG, gameState.sessionId, gameStateId, giverIdx, giverIdx, {
			cards: cardsToGive,
			recipients: [targets[0].idx, targets[1].idx],
		}));

		socket.emitAckTo(ROOMS.playerState(gameStateId, targets[0].idx), IO.PLAYER.ACTION_DONE, {
			actionKey: 'ong',
			cards: batch1,
			fromAvatarIdx: giver.avatarIdx,
		});
		socket.emitAckTo(ROOMS.playerState(gameStateId, targets[1].idx), IO.PLAYER.ACTION_DONE, {
			actionKey: 'ong',
			cards: batch2,
			fromAvatarIdx: giver.avatarIdx,
		});

		SyncHelper.emitPlayerSync(gameStateId, [giver, targets[0], targets[1]]);

		return { cardsLK: giver.cards, actionTokens: giver.actionTokens };
	});
};

// ─── WHO HAVE CARD ───────────────────────────────────────────────────────────

ActionStateService.whoHaveCard = async (gameStateId, playerStateIdx, cardKey) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState, rules } = entry;

		const action = _getActionConfig(rules, 'whoHaveCard');
		const player = gameState.playersStates.find((p) => p.idx === playerStateIdx);
		if (!player || player.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.PLAYER_NOT_FOUND');

		_deductTokens(player, action.cost);

		// Search by family (letter prefix of the card key, e.g. "A" from "A01")
		const family = cardKey.replace(/\d/g, '');

		const owner = gameState.playersStates
			.filter((p) => p.status === PLAYER_STATUS.ALIVE && p.idx !== playerStateIdx)
			.find((p) => p.cards.some((c) => c.key.replace(/\d/g, '') === family));

		if (owner) {
			return { status: 'player', avatarIdx: owner.avatarIdx, actionTokens: player.actionTokens };
		}
		const inDeck = gameState.decks.some((deck) => deck.some((c) => c.key.replace(/\d/g, '') === family));
		return { status: inDeck ? 'deck' : 'unknown', actionTokens: player.actionTokens };
	});
};

// ─── GET TARGET CARDS ────────────────────────────────────────────────────────

ActionStateService.getTargetCards = async (gameStateId, targetIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const target = entry.gameState.playersStates.find((p) => p.idx === targetIdx);
		if (!target || target.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.TARGET_NOT_FOUND');
		return { cards: target.cards };
	});
};

// ─── GET AVAILABLE PLAYERS ───────────────────────────────────────────────────

ActionStateService.getAvailablePlayers = async (gameStateId, excludeIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { gameState } = entry;
		const alive = gameState.playersStates.filter(
			(p) => p.status === PLAYER_STATUS.ALIVE && p.idx !== excludeIdx
		);
		return { players: alive.map((p) => ({ idx: p.idx, name: p.name, avatarIdx: p.avatarIdx })) };
	});
};

export default ActionStateService;
