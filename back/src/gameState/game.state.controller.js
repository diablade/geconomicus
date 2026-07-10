import { DB_EVENTS, IO, PLAYER_TYPE, SESSION_STATUS, GAME_STATUS, ROOMS } from '@geco/shared';
import log from '#config/log';
import socket from '#config/socket';
import { AppError, asyncHandler } from '../middleware/errorHandler.middleware.js';
import EventService from '../event/event.service.js';
import GameStateService from './services/game.state.service.js';
import PlayerStateService from './services/player.state.service.js';
import SessionService from '../session/session.service.js';
import RulesService from '../session/rules/rules.service.js';
import BankStateService from './services/bank.state.service.js';
import DecksStateService from './services/decks.state.service.js';
import ActionStateService from './services/action.state.service.js';

const GameStateController = {};

GameStateController.create = asyncHandler(async (req, res, next) => {
	log.info('[GameStateController] creating game state');
	const { ruleIdx, sessionId } = req.body;
	const gameStateFound = await GameStateService.getBySessionIdAndRuleIdx(sessionId, ruleIdx);
	const session = await SessionService.getById(sessionId, false);
	const rules = session.gamesRules.find((rule) => rule.idx === ruleIdx);

	if (!session || !rules) {
		throw new AppError('Session or rules not found', 404, { sessionId, ruleIdx });
	}
	if (session.status === SESSION_STATUS.OPEN || session.status === SESSION_STATUS.ENDED) {
		throw new AppError('Cannot create game while session is not in progress', 400, {
			sessionId,
			status: session.status,
		});
	}
	if (gameStateFound) {
		if (gameStateFound._id.equals(rules.gameStateId)) {
			log.info('[GameStateController] game state already created', { gameStateId: gameStateFound._id });
			return res.status(200).json({ gameStateId: gameStateFound._id, gameStatus: gameStateFound.status });
		} else {
			throw new AppError('Game state mismatch detected', 409, {
				gameStateFoundId: gameStateFound._id,
				rulesGameStateId: rules.gameStateId,
			});
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
	log.info('[GameStateController] game state created successfully', {
		gameStateId: savedGameState._id,
		sessionId,
	});
	return res.status(200).json({ gameStateId: savedGameState._id, gameStatus: savedGameState.status });
});

GameStateController.init = asyncHandler(async (req, res, next) => {
	const { gameStateId } = req.body;
	log.info('[GameStateController] initializing game', { gameStateId });
	const gameState = await GameStateService.initGame(gameStateId);
	log.info('[GameStateController] game initialized successfully', { gameStateId });
	return res.status(200).json({ status: 'done', gameState });
});
GameStateController.getById = asyncHandler(async (req, res, next) => {
	const { gameStateId } = req.params;
	const payload = await GameStateService.getById(gameStateId, req.query.enriched);
	if (!payload) {
		throw new AppError('Game state not found', 404, { gameStateId });
	}
	return res.status(200).json(payload);
});
GameStateController.start = asyncHandler(async (req, res, next) => {
	const { gameStateId } = req.body;
	log.info('[GameStateController] starting game', { gameStateId });
	const result = await GameStateService.start(gameStateId);
	socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.STARTED, result);
	log.info('[GameStateController] game started successfully', { gameStateId });
	return res.status(200).json(result);
});
GameStateController.resume = asyncHandler(async (req, res, next) => {
	const { gameStateId } = req.body;
	log.info('[GameStateController] resuming game', { gameStateId });
	const result = await GameStateService.resume(gameStateId);
	socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.RESUMED, result);
	log.info('[GameStateController] game resumed successfully', { gameStateId });
	return res.status(200).json(result);
});
GameStateController.pause = asyncHandler(async (req, res, next) => {
	const { gameStateId } = req.body;
	log.info('[GameStateController] pausing game', { gameStateId });
	await GameStateService.pause(gameStateId);
	log.info('[GameStateController] game paused successfully', { gameStateId });
	return res.status(200).json({ status: GAME_STATUS.PAUSED });
});
GameStateController.stop = asyncHandler(async (req, res) => {
	const { gameStateId } = req.body;
	log.info('[GameStateController] stopping game', { gameStateId });
	await GameStateService.stop(gameStateId);
	log.info('[GameStateController] game stopped successfully', { gameStateId });
	return res.status(200).json({ status: GAME_STATUS.STOPPED });
});

GameStateController.refreshPlayer = asyncHandler(async (req, res) => {
	const { gameStateId, playerStateIdx } = req.body;
	log.info('[GameStateController] refreshing player', { gameStateId, playerStateIdx });
	await socket.emitAckTo(ROOMS.playerState(gameStateId, playerStateIdx), IO.REFRESH_FORCE, { force: true });
	return res.status(200).json({ status: 'ok' });
});

GameStateController.refreshAllPlayers = asyncHandler(async (req, res) => {
	const { gameStateId } = req.body;
	log.info('[GameStateController] refreshing all players', { gameStateId });
	const payload = await GameStateService.getById(gameStateId, false);
	if (!payload?.gameState) {
		throw new AppError('Game state not found', 404, { gameStateId });
	}
	await Promise.all(
		payload.gameState.playersStates.map((playerState) =>
			socket.emitAckTo(ROOMS.playerState(gameStateId, playerState.idx), IO.REFRESH_FORCE, { force: true })
		)
	);
	return res.status(200).json({ status: 'ok' });
});

GameStateController.getCurrentPlayerStateIdx = asyncHandler(async (req, res) => {
	const { sessionId, gameStateId, avatarIdx } = req.params;
	const idx = await PlayerStateService.getCurrentPlayerStateIdx(sessionId, gameStateId, avatarIdx);
	return res.status(200).json({ idx });
});
GameStateController.getPlayerState = asyncHandler(async (req, res) => {
	const { sessionId, gameStateId, avatarIdx, playerStateIdx } = req.params;
	const payload = await PlayerStateService.getPlayerState(
		sessionId,
		gameStateId,
		parseInt(avatarIdx),
		parseInt(playerStateIdx)
	);
	if (!payload) {
		throw new AppError('Player not found', 404, { sessionId, gameStateId, avatarIdx });
	}
	return res.status(200).json(payload);
});
GameStateController.produce = asyncHandler(async (req, res) => {
	const { gameStateId, playerStateIdx, cards } = req.body;
	log.info('[GameStateController] producing cards', { gameStateId, playerStateIdx });
	const result = await DecksStateService.produce(gameStateId, playerStateIdx, cards);
	return res.status(200).json({ status: 'ok', result });
});
GameStateController.transaction = asyncHandler(async (req, res) => {
	const { gameStateId, buyerIdx, sellerIdx, cardKey } = req.body;
	log.info('[GameStateController] processing transaction', { gameStateId, buyerIdx, sellerIdx });
	const result = await PlayerStateService.transaction(gameStateId, buyerIdx, sellerIdx, cardKey);
	return res.status(200).json(result);
});
GameStateController.killPlayer = asyncHandler(async (req, res) => {
	const { gameStateId, playerStateId } = req.body;
	log.info('[GameStateController] killing player', { gameStateId, playerStateId });
	await PlayerStateService.killPlayer(gameStateId, playerStateId);
	return res.status(200).json({ status: 'done' });
});
GameStateController.whoHaveCard = asyncHandler(async (req, res) => {
	const { gameStateId, cardKey } = req.params;
	const payload = await DecksStateService.whoHaveCard(gameStateId, cardKey);
	if (!payload || payload.status === 'ko') {
		throw new AppError('Card not found', 404, { gameStateId, cardKey, reason: payload?.reason });
	}
	return res.status(200).json(payload);
});

GameStateController.createCredit = asyncHandler(async (req, res) => {
	const { gameStateId, playerStateIdx, amount, interest } = req.body;
	log.info('[GameStateController] creating credit', { gameStateId, playerStateIdx, amount });
	const result = await BankStateService.createCredit(gameStateId, playerStateIdx, amount, interest);
	return res.status(200).json({ status: 'ok', message: 'CREDIT_CREATED', data: result });
});
GameStateController.creditForAll = asyncHandler(async (req, res) => {
	const { gameStateId } = req.body;
	log.info('[GameStateController] creating credit for all', { gameStateId });
	const result = await BankStateService.createCreditForAll(gameStateId);
	return res.status(200).json({ status: 'ok', message: 'CREDIT_FOR_ALL_CREATED', data: result });
});
GameStateController.freeMoney = asyncHandler(async (req, res) => {
	const { gameStateId, playerStateIdx, amount } = req.body;
	log.info('[GameStateController] sending free money', { gameStateId, playerStateIdx, amount });
	const result = await BankStateService.freeMoney(gameStateId, playerStateIdx, amount);
	return res.status(200).json({ status: 'ok', message: 'FREE_MONEY_SEND', data: result });
});
GameStateController.cancelCredit = asyncHandler(async (req, res) => {
	const { gameStateId, creditId } = req.body;
	log.info('[GameStateController] canceling credit', { gameStateId, creditId });
	const result = await BankStateService.cancelCredit(gameStateId, creditId);
	return res.status(200).json({ status: 'ok', message: 'CREDIT.CANCEL_SUCCESS', data: result });
});
GameStateController.settleCredit = asyncHandler(async (req, res) => {
	const { gameStateId, creditId, playerStateIdx } = req.body;
	log.info('[GameStateController] settling credit', { gameStateId, creditId });
	const result = await BankStateService.settleCredit(gameStateId, creditId, playerStateIdx);
	return res.status(200).json({ status: 'ok', message: 'CREDIT.SETTLE_SUCCESS', data: result });
});
GameStateController.extendCredit = asyncHandler(async (req, res) => {
	const { gameStateId, creditId, playerStateIdx } = req.body;
	log.info('[GameStateController] extending credit', { gameStateId, creditId });
	const result = await BankStateService.extendCredit(gameStateId, creditId, playerStateIdx);
	return res.status(200).json({ status: 'ok', message: 'CREDIT.EXTEND_SUCCESS', data: result });
});


GameStateController.actionGetTargetCards = asyncHandler(async (req, res) => {
	const { gameStateId, targetIdx } = req.body;
	const result = await ActionStateService.getTargetCards(gameStateId, targetIdx);
	return res.status(200).json(result);
});

GameStateController.actionGetAvailablePlayers = asyncHandler(async (req, res) => {
	const { gameStateId, excludeIdx } = req.body;
	const result = await ActionStateService.getAvailablePlayers(gameStateId, excludeIdx);
	return res.status(200).json(result);
});

GameStateController.actionWhoHaveCard = asyncHandler(async (req, res) => {
	const { gameStateId, playerStateIdx, cardKey } = req.body;
	const result = await ActionStateService.whoHaveCard(gameStateId, playerStateIdx, cardKey);
	return res.status(200).json(result);
});

GameStateController.actionGive = asyncHandler(async (req, res) => {
	const { gameStateId, giverIdx, receiverIdx, cardKey } = req.body;
	log.info('[GameStateController] giving card', { gameStateId, giverIdx, receiverIdx });
	const result = await ActionStateService.give(gameStateId, giverIdx, receiverIdx, cardKey);
	return res.status(200).json(result);
});

GameStateController.actionSteal = asyncHandler(async (req, res) => {
	const { gameStateId, stealerIdx, victimIdx, cardKey } = req.body;
	log.info('[GameStateController] stealing card', { gameStateId, stealerIdx, victimIdx });
	const result = await ActionStateService.steal(gameStateId, stealerIdx, victimIdx, cardKey);
	return res.status(200).json(result);
});

GameStateController.actionSilentSteal = asyncHandler(async (req, res) => {
	const { gameStateId, stealerIdx, victimIdx, cardKey } = req.body;
	log.info('[GameStateController] silent stealing card', { gameStateId, stealerIdx, victimIdx });
	const result = await ActionStateService.silentSteal(gameStateId, stealerIdx, victimIdx, cardKey);
	return res.status(200).json(result);
});

GameStateController.actionWar = asyncHandler(async (req, res) => {
	const { gameStateId, attackerIdx, victim1Idx, victim2Idx } = req.body;
	log.info('[GameStateController] war action', { gameStateId, attackerIdx });
	const result = await ActionStateService.war(gameStateId, attackerIdx, victim1Idx, victim2Idx);
	return res.status(200).json(result);
});

GameStateController.actionOng = asyncHandler(async (req, res) => {
	const { gameStateId, giverIdx, cardKeys, manualTargetIdxs } = req.body;
	log.info('[GameStateController] ong action', { gameStateId, giverIdx });
	const result = await ActionStateService.ong(gameStateId, giverIdx, cardKeys, manualTargetIdxs);
	return res.status(200).json(result);
});

GameStateController.seizure = asyncHandler(async (req, res) => {
	const { gameStateId, creditId, playerStateIdx, seizure } = req.body;
	log.info('[GameStateController] seizure', { gameStateId, creditId, playerStateIdx });
	const result = await BankStateService.seizure(gameStateId, creditId, playerStateIdx, seizure);
	return res.status(200).json({ status: 'ok', message: 'CREDIT.SEIZURE_SUCCESS', data: result });
});

GameStateController.prisonBreak = asyncHandler(async (req, res) => {
	const { gameStateId, playerStateIdx } = req.body;
	log.info('[GameStateController] prison break', { gameStateId, playerStateIdx });
	const result = await BankStateService.prisonBreak(gameStateId, playerStateIdx);
	return res.status(200).json({ status: 'ok', message: 'PRISON.BREAK_SUCCESS', data: result });
});

export default GameStateController;
