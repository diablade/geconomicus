import _ from 'lodash';
import EventHelper from './event.helper.js';
import { PLAYER_TYPE, PLAYER_STATUS, DB_EVENTS, IO, ROOMS } from '@geco/shared';
import log from '#config/log';
import socket from '#config/socket';

// ******************************************************************************//
// ***************** DIVIDENDE UNIVERSEL ENGIN **********************************//
export const generateDU = async (gameState, rules) => {
	const nbPlayer = gameState.playersStates.filter((p) => p.status === PLAYER_STATUS.ALIVE).length;
	const moyenne = gameState.currentMassMonetary / nbPlayer;
	const du = (moyenne * rules.tauxCroissance) / 100;
	const duRounded = Number(du.toFixed(2));
	return duRounded;
};
//******************************************************************************//
//******************************************************************************//

const MoneyHelper = {};

MoneyHelper.distributeNewDU = async (entry) => {
	log.info(`[MoneyHelper] Distributing DU for game: ${entry.gameState._id}`);
	const { gameState, rules, events } = entry;
	const DU = await generateDU(gameState, rules);

	gameState.currentDU = DU;
	socket.emitTo(ROOMS.gameState(gameState._id), IO.GAME.CURRENT_DU, {
		du: DU,
	});
	gameState.playersStates.forEach((playerState) => {
		log.debug(`[MoneyHelper] Distributing DU to player ${playerState.idx}: ${DU} coins`);
		if (playerState.status == PLAYER_STATUS.ALIVE) {
			log.debug(`[MoneyHelper] Player ${playerState.idx} is alive, adding ${DU} coins to ${playerState.coins}`);
			playerState.coins += DU;
			gameState.currentMassMonetary += DU;

			socket.emitAckTo(
				ROOMS.playerState(gameState._id, playerState.avatarIdx, playerState.idx),
				IO.PLAYER.DISTRIB_DU,
				{
					du: DU,
					coinsLK: playerState.coins,
				}
			);

			const event = EventHelper.createEvent(
				DB_EVENTS.DISTRIB_DU,
				gameState.sessionId,
				gameState._id,
				PLAYER_TYPE.BANK,
				playerState.idx,
				DU
			);
			events.push(event);
		}
	});

	return entry;
};

export default MoneyHelper;
