import GameStateManager from '../managers/GameStateManager.js';
import ActionEngine from '../engine/action.engine.js';
import { IO, ROOMS, PLAYER_STATUS } from '@geco/shared';
import socket from '#config/socket';
import SyncHelper from '../helpers/sync.helper.js';

const ActionStateService = {};

/** Tell one player something was done to them by an action. */
const _notify = (gameStateId, targetIdx, event, payload) =>
	socket.emitAckTo(ROOMS.playerState(gameStateId, targetIdx), event, payload);

// ─── GIVE ────────────────────────────────────────────────────────────────────

/** Hand one card to another player. */
ActionStateService.give = async (gameStateId, giverIdx, receiverIdx, cardKey) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { giver, receiver, card } = ActionEngine.give(entry, giverIdx, receiverIdx, cardKey);

		_notify(gameStateId, receiverIdx, IO.PLAYER.ACTION_DONE, {
			actionKey: 'give',
			card,
			fromAvatarIdx: giver.avatarIdx,
		});
		SyncHelper.emitPlayerSync(gameStateId, [giver, receiver]);

		return { cardsLK: giver.cards, actionTokens: giver.actionTokens };
	});
};

// ─── STEAL ───────────────────────────────────────────────────────────────────

/** Take one named card from another player, who is told. */
ActionStateService.steal = async (gameStateId, stealerIdx, victimIdx, cardKey) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { stealer, victim, card } = ActionEngine.steal(entry, stealerIdx, victimIdx, cardKey);

		_notify(gameStateId, victimIdx, IO.PLAYER.ACTION_ROBBED, { actionKey: 'steal', card });
		SyncHelper.emitPlayerSync(gameStateId, [stealer, victim]);

		return { cardsLK: stealer.cards, actionTokens: stealer.actionTokens };
	});
};

// ─── SILENT STEAL ────────────────────────────────────────────────────────────

/** Steal with no popup on the victim's board — the hand just changes. */
ActionStateService.silentSteal = async (gameStateId, stealerIdx, victimIdx, cardKey) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { stealer, victim, card } = ActionEngine.silentSteal(entry, stealerIdx, victimIdx, cardKey);

		_notify(gameStateId, victimIdx, IO.PLAYER.ACTION_ROBBED, { actionKey: 'silentSteal', card, silent: true });
		SyncHelper.emitPlayerSync(gameStateId, [stealer, victim]);

		return { cardsLK: stealer.cards, actionTokens: stealer.actionTokens };
	});
};

// ─── ASSOCIATION ─────────────────────────────────────────────────────────────

/** Give one card each to two different players at once. */
ActionStateService.association = async (gameStateId, giverIdx, cardKeys, targetIdxs) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { giver, targets, cards } = ActionEngine.association(entry, giverIdx, cardKeys, targetIdxs);

		targets.forEach((target, i) =>
			_notify(gameStateId, target.idx, IO.PLAYER.ACTION_DONE, {
				actionKey: 'association',
				card: cards[i],
				fromAvatarIdx: giver.avatarIdx,
			})
		);
		SyncHelper.emitPlayerSync(gameStateId, [giver, ...targets]);

		return { cardsLK: giver.cards, actionTokens: giver.actionTokens };
	});
};

// ─── WAR ─────────────────────────────────────────────────────────────────────

/** Take two random cards from each of two victims. */
ActionStateService.war = async (gameStateId, attackerIdx, victim1Idx, victim2Idx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { attacker, victims, stolen } = ActionEngine.war(entry, attackerIdx, victim1Idx, victim2Idx);

		victims.forEach((victim, i) =>
			_notify(gameStateId, victim.idx, IO.PLAYER.ACTION_ROBBED, { actionKey: 'war', cards: stolen[i] })
		);
		SyncHelper.emitPlayerSync(gameStateId, [attacker, ...victims]);

		return { cardsLK: attacker.cards, actionTokens: attacker.actionTokens };
	});
};

// ─── ONG ─────────────────────────────────────────────────────────────────────

/** Give four cards away in pairs, to two named players or the two poorest. */
ActionStateService.ong = async (gameStateId, giverIdx, cardKeys, manualTargetIdxs) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { giver, targets, batches } = ActionEngine.ong(entry, giverIdx, cardKeys, manualTargetIdxs);

		targets.forEach((target, i) =>
			_notify(gameStateId, target.idx, IO.PLAYER.ACTION_DONE, {
				actionKey: 'ong',
				cards: batches[i],
				fromAvatarIdx: giver.avatarIdx,
			})
		);
		SyncHelper.emitPlayerSync(gameStateId, [giver, ...targets]);

		return { cardsLK: giver.cards, actionTokens: giver.actionTokens };
	});
};

// ─── WHO HAVE CARD ───────────────────────────────────────────────────────────

/** Pay a token to learn who holds a card family, or that it is stranded in a deck. */
ActionStateService.whoHaveCard = async (gameStateId, playerStateIdx, cardKey) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const { player, ...answer } = ActionEngine.whoHaveCard(entry, playerStateIdx, cardKey);

		SyncHelper.emitPlayerSync(gameStateId, [player]);

		return answer;
	});
};

// ─── GET TARGET CARDS ────────────────────────────────────────────────────────

/** The hand an action is about to be aimed at. */
ActionStateService.getTargetCards = async (gameStateId, targetIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const target = entry.gameState.playersStates.find((p) => p.idx === targetIdx);
		if (!target || target.status !== PLAYER_STATUS.ALIVE) throw new Error('ERROR.TARGET_NOT_FOUND');
		return { cards: target.cards };
	});
};

// ─── GET AVAILABLE PLAYERS ───────────────────────────────────────────────────

/** Every living Life an action could be aimed at. */
ActionStateService.getAvailablePlayers = async (gameStateId, excludeIdx) => {
	return await GameStateManager.withQueue(gameStateId, async (entry) => {
		const alive = entry.gameState.playersStates.filter(
			(p) => p.status === PLAYER_STATUS.ALIVE && p.idx !== excludeIdx
		);
		return { players: alive.map((p) => ({ idx: p.idx, name: p.name, avatarIdx: p.avatarIdx })) };
	});
};

export default ActionStateService;
