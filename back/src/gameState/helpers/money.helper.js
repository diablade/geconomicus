import _ from 'lodash';
import EventHelper from './event.helper.js';
import { PLAYER_TYPE, DB_EVENTS } from '@geco/shared';

//******************************************************************************//
//***************** DIVIDENDE UNIVERSEL ENGIN **********************************//
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
	log.info(`Distributing DU for game: ${entry.gameState.id}`);
	const { gameState, rules, events } = entry;
	const DU = await generateDU(gameState, rules);

	gameState.currentDU = DU;
	gameState.playersStates.forEach((playerState) => {
		if (playerState.status == PLAYER_STATUS.ALIVE) {
			playerState.coins += DU;
            gameState.currentMassMonetary += DU;

            socket.emitAckTo(ROOMS.playerState(gameState.id, playerState.avatarIdx, playerState.idx), IO.DISTRIB_DU, {
                du: DU,
                coinsLK: playerState.coins,
            });

			const event = EventHelper.createEvent(
				DB_EVENTS.DISTRIB_DU,
				gameState.sessionId,
				gameState.id,
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
