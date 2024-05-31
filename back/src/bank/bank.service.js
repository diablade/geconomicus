import GameModel from "../game/game.model.js";
import _ from "lodash";

export default {
	getCreditsOfPlayer: async (idGame, idPlayer) => {
		const game = await GameModel.findById(idGame);
		// const game = await GameService.getGame(idGame);
		if (game) {
			return _.filter(game.credits, {idPlayer: idPlayer});
		} else {
			return [];
		}
	}
}
