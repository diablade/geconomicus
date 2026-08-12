import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS, PLAYER_TYPE } from '@geco/shared';
import EventHelper from '../helpers/event.helper.js';
import { generateDU } from '../helpers/money.helper.js';

const GameEngine = {};

/**
 * Take the next avatar off the scheduled death order, if one is due.
 *
 * With `autoDeath` off there is no scheduled death at all — the timer still ticks, it simply has
 * nothing to pop, and only the animator's Force Death can end a Life. Popping also refreshes the
 * time-to-next-death so a save or a crash-recovery resumes with a full interval rather than a
 * partial one.
 *
 * @param {{gameState: object, rules: object}} entry
 * @returns {number|null} the avatar due to die, or null when nobody is
 */
GameEngine.popScheduledDeath = (entry) => {
	const { gameState, rules } = entry;
	if (!rules?.autoDeath) return null;

	const deathState = gameState.gameTimers?.deathState;
	const queue = deathState?.deathQueue;
	if (!Array.isArray(queue) || queue.length === 0) return null;

	deathState.intervalDeathLeft = deathState.deathIntervalMs;
	return queue.shift();
};

/**
 * Pay the universal dividend to every living Life.
 *
 * Recorded as one event per recipient rather than one for the whole tick, because the events log
 * filters by receiver — a per-player row is what lets an animator confirm nobody living was
 * skipped. The rows of one tick therefore carry rising partial sums of the mass, and every one of
 * them is a true reading, since coins and mass advance together inside the loop.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @returns {Promise<{du: number, alive: object[], currentMassMonetary: number}>}
 */
GameEngine.distributeDU = async (entry) => {
	const { gameState, rules, events } = entry;
	const du = await generateDU(gameState, rules);
	gameState.currentDU = du;

	const at = Date.now();
	const alive = [];
	for (const playerState of gameState.playersStates) {
		if (playerState.status !== PLAYER_STATUS.ALIVE) continue;

		playerState.coins += du;
		gameState.currentMassMonetary += du;
		alive.push(playerState);

		events.push(
			EventHelper.createEvent(DB_EVENTS.DISTRIB_DU, gameState, {
				emitter: PLAYER_TYPE.BANK,
				receiver: playerState.idx,
				payload: { du },
				at,
			})
		);
	}

	return { du, alive, currentMassMonetary: gameState.currentMassMonetary };
};

/** Whether this game pays a universal dividend at all. */
GameEngine.paysDividend = (gameState) => gameState.typeMoney === GAME_TYPE.JUNE;

export default GameEngine;
