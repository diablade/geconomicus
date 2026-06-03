import { DB_EVENTS, IO, PLAYER_TYPE, SESSION_STATUS, GAME_STATUS, ROOMS } from '@geco/shared';
import log from '#config/log';
import socket from '#config/socket';
import EventService from '../event/event.service.js';
import GameStateService from './services/game.state.service.js';
import PlayerStateService from './services/player.state.service.js';
import SessionService from '../session/session.service.js';
import RulesService from '../session/rules/rules.service.js';
import BankStateService from './services/bank.state.service.js';

const GameStateController = {};

// create state in DB
GameStateController.create = async (req, res, next) => {
	try {
		log.info('[GameStateController] creating game state...');
		const { ruleIdx, sessionId } = req.body;
		const gameStateFound = await GameStateService.getBySessionIdAndRuleIdx(sessionId, ruleIdx);
		const session = await SessionService.getById(sessionId, false);
		const rules = session.gamesRules.find((rule) => rule.idx === ruleIdx);

		if (!session || !rules) {
			log.error("[GameStateController] can't create Session or rules not found");
			return res.status(404).json({ message: 'ERROR.SESSION_NOT_FOUND' });
		}
		if (session.status === SESSION_STATUS.OPEN || session.status === SESSION_STATUS.ENDED) {
			log.error(`[GameStateController] Can't create while Session status: ${session.status}`);
			return res.status(404).json({ message: 'ERROR.SESSION_NOT_IN_PROGRESS' });
		}
		if (gameStateFound) {
			if (gameStateFound._id.equals(rules.gameStateId)) {
				log.info(
					'[GameStateController] already created - gameStateFound._id: ' +
						gameStateFound._id +
						' rules.gameStateId: ' +
						rules.gameStateId
				);
				return res.status(300).json({ message: 'ERROR.GAME_ALREADY_CREATED', gameState: gameStateFound });
			} else {
				log.error(
					'[GameStateController] mismatch - gameStateFound._id: ' +
						gameStateFound._id +
						' rules.gameStateId: ' +
						rules.gameStateId
				);
				throw new Error('ERROR.GAME_STATE_MISMATCH');
			}
		}
		const savedGameState = await GameStateService.create(session, rules);
		await RulesService.updateGameStateId(sessionId, ruleIdx, savedGameState._id);
		await EventService.postNow(DB_EVENTS.GAME_CREATED, sessionId, savedGameState._id, PLAYER_TYPE.MASTER, '-', {
			ruleIdx,
			typeMoney: rules.typeMoney,
			status: savedGameState.status,
		});
		socket.emitAckTo(ROOMS.session(sessionId), IO.GAME.CREATED, {
			gameStateId: savedGameState._id,
			idx: ruleIdx,
			typeMoney: rules.typeMoney,
			gameStatus: savedGameState.status,
		});
		return res.status(200).json({ gameStateId: savedGameState._id, gameStatus: savedGameState.status });
	} catch (err) {
		log.error('[GameStateController] creation error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.CREATE',
		});
	}
};

//prepare game stuff like cards coins etc and charge in memory the rules
GameStateController.init = async (req, res, next) => {
	const body = req.body;
	try {
		const gameState = await GameStateService.initGame(body.gameStateId);
		return res.status(200).json({
			status: 'done',
			gameState,
		});
	} catch (err) {
		log.error('[GameStateController] init game error:', err);
		next({
			status: 400,
			message: err,
		});
	}
};

GameStateController.getById = async (req, res, next) => {
	try {
		const payload = await GameStateService.getById(req.params.gameStateId, req.query.enriched);
		return res.status(200).json(payload);
	} catch (err) {
		log.error('[GameStateController] getById error:', err);
		return res.status(500).json({
			status: 'ko',
			message: err.message,
		});
	}
};

GameStateController.getCurrentPlayerStateIdx = async (req, res, next) => {
	log.debug('[GameStateController] getCurrentPlayerStateIdx', req.params);
	try {
		const idx = await PlayerStateService.getCurrentPlayerStateIdx(
			req.params.sessionId,
			req.params.gameStateId,
			req.params.avatarIdx
		);
		log.debug('[GameStateController] getCurrentPlayerStateIdx', { idx });
		return res.status(200).json({ idx });
	} catch (err) {
		log.error('[GameStateController] getCurrentPlayerStateIdx error:', err);
		return res.status(500).json({
			status: 'ko',
			message: err.message,
		});
	}
};

GameStateController.getPlayerState = async (req, res, next) => {
	try {
		const { sessionId, gameStateId, avatarIdx, playerStateIdx } = req.params;
		const payload = await PlayerStateService.getPlayerState(
			sessionId,
			gameStateId,
			parseInt(avatarIdx),
			parseInt(playerStateIdx)
		);
		if (!payload) {
			return res.status(404).json({ status: 'ko', message: 'ERROR.PLAYER_NOT_FOUND' });
		}
		return res.status(200).json(payload);
	} catch (err) {
		log.error('[GameStateController] Get player state error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.PLAYER_NOT_FOUND',
		});
	}
};

GameStateController.produce = async (req, res, next) => {
	try {
		const game = await DeckStateService.produce(req.body);
		return res.status(200).json({
			status: 'ok',
		});
	} catch (err) {
		log.error('[GameStateController] Game produce error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.PRODUCE',
			error: err.message,
		});
	}
};

GameStateController.transaction = async (req, res, next) => {
	const { gameStateId, buyerIdx, sellerIdx, cardKey } = req.body;
	try {
		const result = await PlayerStateService.transaction(gameStateId, buyerIdx, sellerIdx, cardKey);
		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] Game transaction error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.TRANSACTION',
			error: err.message,
		});
	}
};

GameStateController.killPlayer = async (req, res, next) => {
	const { gameStateId, playerStateId } = req.body;
	try {
		await PlayerStateService.killPlayer(gameStateId, playerStateId);
		return res.status(200).json({
			status: 'done',
		});
	} catch (err) {
		log.error('[GameStateController] kill player error:', err);
		next({
			status: 400,
			message: err,
		});
	}
};

GameStateController.whoHaveCard = async (req, res, next) => {
	const { gameStateId, cardKey } = req.params;
	try {
		const payload = await DeckStateService.whoHaveCard(gameStateId, cardKey);
		if (payload && payload.status !== 'ko') {
			return res.status(200).json(payload);
		} else {
			return res.status(404).json({
				status: 'ko',
				message: payload.reason,
			});
		}
	} catch (err) {
		log.error('[GameStateController] Game who have card error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.FINDING_CARD',
		});
	}
};

GameStateController.start = async (req, res, next) => {
	try {
		const { gameStateId } = req.body;
		const result = await GameStateService.start(gameStateId);
		// Emit socket event to notify clients (timer is started by the service)
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.STARTED, result);

		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] Start round error:', err);
		return res.status(500).json({
			status: 'ko',
			message: err.message,
		});
	}
};
GameStateController.pause = async (req, res, next) => {
	try {
		const { gameStateId } = req.body;
		await GameStateService.pause(gameStateId);
		return res.status(200).json({
			status: GAME_STATUS.PAUSED,
		});
	} catch (err) {
		log.error('[GameStateController] pause game error:', err);
		next({ status: 500, message: err });
	}
};
GameStateController.stop = async (req, res, next) => {
	try {
		const { gameStateId } = req.body;
		const result = await GameStateService.stop(gameStateId);
		return res.status(200).json({
			status: GAME_STATUS.STOPPED,
		});
	} catch (err) {
		log.error('[GameStateController] stop game error:', err);
		next({ status: 500, message: err });
	}
};

GameStateController.createCredit = async (req, res, next) => {
	try {
		const { gameStateId, playerStateIdx, amount, interest } = req.body;
		const result = await BankStateService.createCredit(gameStateId, playerStateIdx, amount, interest);
		return res.status(200).json({
			status: 'ok',
			message: 'CREDIT_CREATED',
			data: result,
		});
	} catch (err) {
		log.error('[GameStateController] Create credit error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.CREATE_CREDIT',
		});
	}
};

GameStateController.cancelCredit = async (req, res, next) => {
	try {
		const { gameStateId, creditId } = req.body;
		const result = await BankStateService.cancelCredit(gameStateId, creditId);
		return res.status(200).json({
			status: 'ok',
			message: 'CREDIT.CANCEL_SUCCESS',
			data: result,
		});
	} catch (err) {
		log.error('[GameStateController] Cancel credit error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.CANCEL_CREDIT',
		});
	}
};

// GameStateController.end = async (req, res, next) => {
// 	const gameStateId = req.body.gameStateId;
// 	try {
// 		// Final DB save before removing from memory
// 		await GameStateService.saveGameStateToDB(gameStateId);
// 		gameTimerManager.stopPersistenceTimer(gameStateId);
// 		inMemoryGameStateManager.removeGame(gameStateId);
// 		socket.emitTo(gameStateId, END_GAME, {});
// 		return res.status(200).json({
// 			status: END_GAME,
// 		});
// 	} catch (err) {
// 		log.error(`End game error: `, err);
// 		next({ status: 500, message: err });
// 	}
// };
// GameStateController.delete = async (req, res, next) => {
// 	const {gameStateId, password} = req.body;
// 	try {
// 		if (
// 			process.env.GECO_NODE_ENV === 'production' &&
// 			bcrypt.compareSync(password, process.env.GECO_ADMIN_PASSWORD)
// 		) {
// 			await GameStateService.findByIdAndDelete(gameStateId);
// 			return res.status(200).json({
// 				status: 'delete done',
// 			});
// 		} else if (process.env.GECO_NODE_ENV !== 'production' && password === 'admin') {
// 			await GameStateService.findByIdAndDelete(gameStateId);
// 			return res.status(200).json({
// 				status: 'delete done',
// 			});
// 		} else {
// 			next({
// 				status: 500,
// 				message: 'error',
// 			});
// 		}
// 	} catch (err) {
// 		log.error(`delete game error: `, err);
// 		next({
// 			status: 400,
// 			message: err,
// 		});
// 	}
// };
// GameStateController.reset = async (req, res, next) => {
// 	try {
// 		const done = await GameStateService.resetGame(req.body.gameStateId);
// 		if (done) {
// 			return res.status(200).json({
// 				status: 'reset done',
// 			});
// 		} else {
// 			return res.status(500).json({
// 				message: 'Game reset error',
// 			});
// 		}
// 	} catch (err) {
// 		log.error(`Game reset error: `, err);
// 		next({
// 			status: 500,
// 			message: 'Game reset error',
// 		});
// 	}
// };

// GameStateController.refreshForceAllPlayers = async (req, res, next) => {
// 	try {
// 		const done = await GameStateService.refreshForceAllPlayers(req.body.gameStateId);
// 		if (done) {
// 			return res.status(200).json({
// 				status: 'refresh done',
// 			});
// 		} else {
// 			return res.status(500).json({
// 				message: 'Game refresh error',
// 			});
// 		}
// 	} catch (err) {
// 		log.error(`Game refresh error: `, err);
// 		next({
// 			status: 400,
// 			message: 'ERROR.REFRESH',
// 		});
// 	}
// };
// GameStateController.refreshPlayer = async (req, res, next) => {
// 	try {
// 		const done = await GameStateService.refreshPlayer(req.body.gameStateId, req.body.idPlayer);
// 		if (done) {
// 			return res.status(200).json({
// 				status: 'refresh done',
// 			});
// 		} else {
// 			return res.status(500).json({
// 				message: 'Game refresh error',
// 			});
// 		}
// 	} catch (err) {
// 		log.error(`Game refresh error: `, err);
// 		next({
// 			status: 400,
// 			message: 'Game refresh error',
// 		});
// 	}
// };

export default GameStateController;
