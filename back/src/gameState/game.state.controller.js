import {C} from '#constantes';
import log from '#config/log';
import socket from '#config/socket';
import EventService from '../event/event.service.js';
import GameStateService from './game.state.service.js';
import SessionService from '../session/session.service.js';
import RulesService from '../session/rules/rules.service.js';

const GameStateController = {};

GameStateController.create = async (req, res, next) => {
	try {
		const {ruleIdx, sessionId} = req.body;
		const session = await SessionService.getById(sessionId);
		const rules = session.gamesRules.find(rule => rule.idx === ruleIdx);
		if (!session || !rules) {
			return res.status(404).json({message: 'ERROR.SESSION_NOT_FOUND'});
		}
		if (session.status !== C.IN_PROGRESS) {
			return res.status(404).json({message: 'ERROR.SESSION_NOT_STARTED'});
		}
		if (rules.gameStateId) {
			const gameState = await GameStateService.getById(rules.gameStateId);
			if (!gameState || gameState._id.toString() !== rules.gameStateId) {
				return res.status(404).json({message: 'ERROR.GAME_NOT_FOUND'});
			}
			return res.status(300).json({message: 'ERROR.GAME_ALREADY_CREATED', gameState});
		}

		const savedGameState = await GameStateService.create(session.players, rules);
		const rulesUpdated = await RulesService.updateFromCreatedGameStateId(sessionId, ruleIdx, savedGameState._id);
		const resultEvent = await EventService.create(
			C.CREATED_GAME_STATE,
			sessionId,
			savedGameState._id,
			C.MASTER,
			'-',
			{
				ruleIdx,
				typeMoney: rules.typeMoney,
			}
		);
		socket.emitToAck(sessionId, C.CREATED_GAME_STATE, {
			gameStateId: savedGameState._id,
			ruleIdx,
			typeMoney: rules.typeMoney,
			status: rules.status
		});
		return res.status(200).json({gameStateId: savedGameState._id});
	} catch (err) {
		log.error('Game creation error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.CREATE',
		});
	}
};
GameStateController.produce = async (req, res, next) => {
	try {
		// const game = await GameStateService.produce(req.body);
		return res.status(200).json({
			status: 'ok',
		});
	} catch (err) {
		log.error('Game produce error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.PRODUCE',
		});
	}
};

GameStateController.transaction = async (req, res, next) => {
	try {
		// const game = await GameStateService.transaction(req.body);
		return res.status(200).json({
			status: 'ok',
		});
	} catch (err) {
		log.error('Game transaction error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.TRANSACTION',
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
GameStateController.whoHaveCard = async (req, res, next) => {
	const {gameStateId, cardKey} = req.params;
	try {
		const payload = await GameStateService.whoHaveCard(gameStateId, cardKey);
		if (payload && payload.status !== 'ko') {
			return res.status(200).json(payload);
		} else {
			return res.status(404).json({
				status: 'ko',
				message: payload.reason,
			});
		}
	} catch (err) {
		log.error('Game who have ingredient error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.FINDING_INGREDIENT',
		});
	}
};
//prepare game stuff like cards coins etc and charge in memory the rules
GameStateController.initGame = async (req, res, next) => {
	const body = req.body;
	try {
		const game = await GameStateService.initGame(body.gameStateId);
		socket.emitTo(body.gameStateId, C.INIT_GAME_STATE, game);
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

GameStateController.start = async (req, res, next) => {
	const body = req.body;
	try {
		const game = await GameStateService.findById(body.gameStateId);
		game.typeMoney = body.typeMoney ? body.typeMoney : C.JUNE;
		let gameUpdated;
		let startGameEvent = constructor.event(C.START_GAME, C.MASTER, '', 0, [], Date.now());
		game.events.push(startGameEvent);
		gameUpdated = await GameStateService.initGame(game);
		//and save the rest
		GameStateService.updateOne(
			{
				_id: body.gameStateId,
			},
			{
				$set: {
					status: C.START_GAME,
					decks: gameUpdated.decks,
					events: gameUpdated.events,
					players: gameUpdated.players,
					round: gameUpdated.round + 1,
					currentDU: gameUpdated.currentDU,
					currentMassMonetary: gameUpdated.currentMassMonetary,
					modified: Date.now(),
				},
			}
		)
			.then((updatedGame) => {
				return res.status(200).json({
					status: C.START_GAME,
					timerCredit: gameUpdated.timerCredit,
					typeMoney: gameUpdated.typeMoney,
				});
			})
			.catch((err) => {
				log.error('Start game error:', err);
				return res.status(500).json({
					message: 'Start game error',
				});
			});
	} catch (err) {
		log.error('Cannot start Game, not found:', err);
		return res.status(404).json({
			message: 'Cannot start Game, not found',
		});
	}
};
GameStateController.stop = async (req, res, next) => {
	const {gameStateId, round} = req.body;
	await GameStateService.stop(gameStateId, round);
	return res.status(200).json({
		status: C.STOP,
	});
};
GameStateController.pause = async (req, res, next) => {
	const {gameStateId, round} = req.body;
	await GameStateService.pause(gameStateId, round);
	return res.status(200).json({
		status: C.PAUSE,
	});
};
GameStateController.end = async (req, res, next) => {
	const gameStateId = req.body.gameStateId;
	let stopGameEvent = constructor.event(C.END_GAME, C.MASTER, C.MASTER, 0, [], Date.now());
	GameStateService.findByIdAndUpdate(
		{
			_id: gameStateId,
		},
		{
			$set: {
				status: C.END_GAME,
				modified: Date.now(),
			},
			$push: {
				events: stopGameEvent,
			},
		},
		{
			new: true,
		}
	)
		.then((game) => {
			socket.emitTo(
				gameStateId,
				C.END_GAME,
				game.surveyEnabled
					? {
						redirect: 'survey',
					}
					: {}
			);
			socket.emitTo(gameStateId + C.EVENT, C.EVENT, stopGameEvent);
			return res.status(200).json({
				status: C.END_GAME,
			});
		})
		.catch((err) => {
			log.error('End game error:', err);
			return res.status(404).json({
				message: 'End Game error',
			});
		});
};
GameStateController.delete = async (req, res, next) => {
	const {gameStateId, password} = req.body;
	try {
		if (
			process.env.GECO_NODE_ENV === 'production' &&
			bcrypt.compareSync(password, process.env.GECO_ADMIN_PASSWORD)
		) {
			await GameStateService.findByIdAndDelete(gameStateId);
			return res.status(200).json({
				status: 'delete done',
			});
		} else if (process.env.GECO_NODE_ENV !== 'production' && password === 'admin') {
			await GameStateService.findByIdAndDelete(gameStateId);
			return res.status(200).json({
				status: 'delete done',
			});
		} else {
			next({
				status: 500,
				message: 'error',
			});
		}
	} catch (err) {
		log.error('delete game error', err);
		next({
			status: 400,
			message: err,
		});
	}
};
GameStateController.reset = async (req, res, next) => {
	try {
		const done = await GameStateService.resetGame(req.body.gameStateId);
		if (done) {
			return res.status(200).json({
				status: 'reset done',
			});
		} else {
			return res.status(500).json({
				message: 'Game reset error',
			});
		}
	} catch (err) {
		log.error('Game reset error:', err);
		next({
			status: 500,
			message: 'Game reset error',
		});
	}
};
GameStateController.killPlayer = async (req, res, next) => {
	const {gameStateId, idPlayer} = req.body;
	try {
		await GameStateService.killPlayer(gameStateId, idPlayer);

		return res.status(200).json({
			status: 'done',
		});
	} catch (err) {
		log.error('kill player error', err);
		next({
			status: 400,
			message: err,
		});
	}
};
GameStateController.refreshForceAllPlayers = async (req, res, next) => {
	try {
		const done = await GameStateService.refreshForceAllPlayers(req.body.gameStateId);
		if (done) {
			return res.status(200).json({
				status: 'refresh done',
			});
		} else {
			return res.status(500).json({
				message: 'Game refresh error',
			});
		}
	} catch (err) {
		log.error('Game refresh error:', err);
		next({
			status: 400,
			message: 'ERROR.REFRESH',
		});
	}
};
GameStateController.refreshPlayer = async (req, res, next) => {
	try {
		const done = await GameStateService.refreshPlayer(req.body.gameStateId, req.body.idPlayer);
		if (done) {
			return res.status(200).json({
				status: 'refresh done',
			});
		} else {
			return res.status(500).json({
				message: 'Game refresh error',
			});
		}
	} catch (err) {
		log.error('Game refresh error:', err);
		next({
			status: 400,
			message: 'Game refresh error',
		});
	}
};

export default GameStateController;
