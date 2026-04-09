import { DB_EVENTS, IO, PLAYER_TYPE, SESSION_STATUS } from '@geco/shared';
import log from '#config/log';
import socket from '#config/socket';
import EventService from '../event/event.service.js';
import GameStateService from './services/game.state.service.js';
import SessionService from '../session/session.service.js';
import RulesService from '../session/rules/rules.service.js';
// import gameTimerManager from './managers/GameTimerManager.js';
// import inMemoryGameStateManager from './managers/InMemoryGameStateManager.js';
// import playerMemService from './playersStates/player.mem.service.js';

const GameStateController = {};

// create state in DB
GameStateController.create = async (req, res, next) => {
	try {
		const {ruleIdx, sessionId} = req.body;
		const session = await SessionService.getById(sessionId);
		const rules = session.gamesRules.find(rule => rule.idx === ruleIdx);
		if (!session || !rules) {
			return res.status(404).json({message: 'ERROR.SESSION_NOT_FOUND'});
		}
		if (session.status !== SESSION_STATUS.IN_PROGRESS) {
			return res.status(404).json({message: 'ERROR.SESSION_NOT_STARTED'});
		}
		if (rules.gameStateId) {
			const gameState = await GameStateService.getById(rules.gameStateId);
			if (!gameState || gameState._id.toString() !== rules.gameStateId) {
				return res.status(404).json({message: 'ERROR.GAME_NOT_FOUND'});
			}
			return res.status(300).json({message: 'ERROR.GAME_ALREADY_CREATED', gameState});
		}

		const savedGameState = await GameStateService.create(session, rules);
		const rulesUpdated = await RulesService.updateFromCreatedGameStateId(sessionId, ruleIdx, savedGameState._id);
		await EventService.postNow(
			DB_EVENTS.GAME_CREATED,
			sessionId,
			savedGameState._id,
			PLAYER_TYPE.MASTER,
			'-',
			{
				ruleIdx,
				typeMoney: rules.typeMoney,
				status: savedGameState.status,
			}
		);
        console.log('Game created', {
			gameStateId: savedGameState._id,
			ruleIdx,
			typeMoney: rules.typeMoney,
			gameStatus: savedGameState.status
		});
		socket.emitAckTo(sessionId, IO.GAME.CREATED, {
			gameStateId: savedGameState._id,
			idx: ruleIdx,
			typeMoney: rules.typeMoney,
			gameStatus: savedGameState.status
		});
		return res.status(200).json({gameStateId: savedGameState._id, gameStatus: savedGameState.status});
	} catch (err) {
		log.error('Game creation error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.CREATE',
		});
	}
};

//prepare game stuff like cards coins etc and charge in memory the rules
GameStateController.setupGame = async (req, res, next) => {
	const body = req.body;
	try {
		const game = await GameStateService.setupGame(body.gameStateId);
		return res.status(200).json({
			status: 'done',
			game,
		});
	} catch (err) {
		log.error('init game error', err);
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
		log.error('Get game error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.NOT_FOUND',
		});
	}
};

GameStateController.getCurrentPlayerStateIdx = async (req, res, next) => {
	try {
		const idx = await GameStateService.getCurrentPlayerStateIdx(req.params.sessionId, req.params.gameStateId, req.params.avatarIdx);
		return res.status(200).json({idx});
	} catch (err) {
		log.error('Get game error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.NOT_FOUND',
		});
	}
};


// GameStateController.produce = async (req, res, next) => {
// 	try {
// 		// const game = await GameStateService.produce(req.body);
// 		return res.status(200).json({
// 			status: 'ok',
// 		});
// 	} catch (err) {
// 		log.error('Game produce error:', err);
// 		return res.status(500).json({
// 			status: 'ko',
// 			message: 'ERROR.PRODUCE',
// 		});
// 	}
// };

// GameStateController.transaction = async (req, res, next) => {
// 	try {
// 		// const game = await GameStateService.transaction(req.body);
// 		return res.status(200).json({
// 			status: 'ok',
// 		});
// 	} catch (err) {
// 		log.error('Game transaction error:', err);
// 		return res.status(500).json({
// 			status: 'ko',
// 			message: 'ERROR.TRANSACTION',
// 		});
// 	}
// };


// GameStateController.whoHaveCard = async (req, res, next) => {
// 	const {gameStateId, cardKey} = req.params;
// 	try {
// 		const payload = await GameStateService.whoHaveCard(gameStateId, cardKey);
// 		if (payload && payload.status !== 'ko') {
// 			return res.status(200).json(payload);
// 		} else {
// 			return res.status(404).json({
// 				status: 'ko',
// 				message: payload.reason,
// 			});
// 		}
// 	} catch (err) {
// 		log.error('Game who have ingredient error:', err);
// 		return res.status(500).json({
// 			status: 'ko',
// 			message: 'ERROR.FINDING_INGREDIENT',
// 		});
// 	}
// };

// GameStateController.start = async (req, res, next) => {
// 	const body = req.body;
// 	try {
// 		const game = await GameStateService.findById(body.gameStateId);
// 		game.typeMoney = body.typeMoney ? body.typeMoney : JUNE;
// 		let gameUpdated;
// 		let startGameEvent = constructor.event(START_GAME, MASTER, '', 0, [], Date.now());
// 		game.events.push(startGameEvent);
// 		gameUpdated = await GameStateService.initGame(game);
// 		//and save the rest
// 		GameStateService.updateOne(
// 			{
// 				_id: body.gameStateId,
// 			},
// 			{
// 				$set: {
// 					status: START_GAME,
// 					decks: gameUpdated.decks,
// 					events: gameUpdated.events,
// 					avatars: gameUpdated.avatars,
// 					round: gameUpdated.round + 1,
// 					currentDU: gameUpdated.currentDU,
// 					currentMassMonetary: gameUpdated.currentMassMonetary,
// 					modified: Date.now(),
// 				},
// 			}
// 		)
// 			.then((updatedGame) => {
// 				return res.status(200).json({
// 					status: START_GAME,
// 					timerCredit: gameUpdated.timerCredit,
// 					typeMoney: gameUpdated.typeMoney,
// 				});
// 			})
// 			.catch((err) => {
// 				log.error('Start game error:', err);
// 				return res.status(500).json({
// 					message: 'Start game error',
// 				});
// 			});
// 	} catch (err) {
// 		log.error('Cannot start Game, not found:', err);
// 		return res.status(404).json({
// 			message: 'Cannot start Game, not found',
// 		});
// 	}
// };
// GameStateController.stop = async (req, res, next) => {
// 	const {gameStateId, round} = req.body;
// 	try {
// 		// Final DB save before removing from memory
// 		await GameStateService.saveGameStateToDB(gameStateId);
// 		gameTimerManager.stopPersistenceTimer(gameStateId);
// 		inMemoryGameStateManager.removeGame(gameStateId);
// 		await GameStateService.stop(gameStateId, round);
// 		return res.status(200).json({
// 			status: STOP,
// 		});
// 	} catch (err) {
// 		log.error('stop game error', err);
// 		next({ status: 500, message: err });
// 	}
// };
// GameStateController.pause = async (req, res, next) => {
// 	const {gameStateId, round} = req.body;
// 	try {
// 		await GameStateService.pause(gameStateId, round);
// 		return res.status(200).json({
// 			status: PAUSE,
// 		});
// 	} catch (err) {
// 		log.error('pause game error', err);
// 		next({ status: 500, message: err });
// 	}
// };
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
// 		log.error('End game error:', err);
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
// 		log.error('delete game error', err);
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
// 		log.error('Game reset error:', err);
// 		next({
// 			status: 500,
// 			message: 'Game reset error',
// 		});
// 	}
// };
// GameStateController.killPlayer = async (req, res, next) => {
// 	const {gameStateId, playerStateId} = req.body;
// 	try {
// 		await playerMemService.killPlayer(gameStateId, playerStateId);
// 		return res.status(200).json({
// 			status: 'done',
// 		});
// 	} catch (err) {
// 		log.error('kill player error', err);
// 		next({
// 			status: 400,
// 			message: err,
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
// 		log.error('Game refresh error:', err);
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
// 		log.error('Game refresh error:', err);
// 		next({
// 			status: 400,
// 			message: 'Game refresh error',
// 		});
// 	}
// };

export default GameStateController;
