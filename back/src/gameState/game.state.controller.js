import { DB_EVENTS, IO, PLAYER_TYPE, SESSION_STATUS, GAME_STATUS, ROOMS } from '@geco/shared';
import log from '#config/log';
import socket from '#config/socket';
import EventService from '../event/event.service.js';
import GameStateService from './services/game.state.service.js';
import PlayerStateService from './services/player.state.service.js';
import SessionService from '../session/session.service.js';
import RulesService from '../session/rules/rules.service.js';
import BankStateService from './services/bank.state.service.js';
import DecksStateService from './services/decks.state.service.js';
import ActionStateService from './services/action.state.service.js';

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
GameStateController.start = async (req, res, next) => {
	try {
		const { gameStateId } = req.body;
		const result = await GameStateService.start(gameStateId);
		// Emit socket event to notify clients (timer is started by the service)
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.STARTED, result);

		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] Start game error:', err);
		return res.status(500).json({
			status: 'ko',
			message: err.message,
		});
	}
};
GameStateController.resume = async (req, res, next) => {
	try {
		const { gameStateId } = req.body;
		const result = await GameStateService.resume(gameStateId);
		// Emit socket event to notify clients (timer is started by the service)
		socket.emitTo(ROOMS.gameState(gameStateId), IO.GAME.RESUMED, result);

		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] Resume game error:', err);
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
		const { gameStateId, playerStateIdx, cards } = req.body;
		const result = await DecksStateService.produce(gameStateId, playerStateIdx, cards);
		return res.status(200).json({
			status: 'ok',
			result,
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
GameStateController.creditForAll = async (req, res, next) => {
	try {
		const { gameStateId } = req.body;
		const result = await BankStateService.createCreditForAll(gameStateId);
		return res.status(200).json({
			status: 'ok',
			message: 'CREDIT_FOR_ALL_CREATED',
			data: result,
		});
	} catch (err) {
		log.error('[GameStateController] Create credit for all error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.CREATE_CREDIT_FOR_ALL',
		});
	}
};
GameStateController.freeMoney = async (req, res, next) => {
	try {
		const { gameStateId, playerStateIdx, amount } = req.body;
		const result = await BankStateService.freeMoney(gameStateId, playerStateIdx, amount);
		return res.status(200).json({
			status: 'ok',
			message: 'FREE_MONEY_SEND',
			data: result,
		});
	} catch (err) {
		log.error('[GameStateController] Free money error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.FREE_MONEY',
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
GameStateController.settleCredit = async (req, res, next) => {
	try {
		const { gameStateId, creditId, playerStateIdx } = req.body;
		const result = await BankStateService.settleCredit(gameStateId, creditId, playerStateIdx);
		return res.status(200).json({
			status: 'ok',
			message: 'CREDIT.SETTLE_SUCCESS',
			data: result,
		});
	} catch (err) {
		log.error('[GameStateController] Settle credit error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.SETTLE_CREDIT',
		});
	}
};
GameStateController.extendCredit = async (req, res, next) => {
	try {
		const { gameStateId, creditId, playerStateIdx } = req.body;
		const result = await BankStateService.extendCredit(gameStateId, creditId, playerStateIdx);
		return res.status(200).json({
			status: 'ok',
			message: 'CREDIT.EXTEND_SUCCESS',
			data: result,
		});
	} catch (err) {
		log.error('[GameStateController] Extend credit error:', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.EXTEND_CREDIT',
		});
	}
};


GameStateController.refreshAllPlayers = async (req, res, next) => {
// 	TODO call game state service
};
GameStateController.refreshPlayer = async (req, res, next) => {
// 	TODO call game state service
};

GameStateController.actionGetTargetCards = async (req, res, next) => {
	const { gameStateId, targetIdx } = req.body;
	try {
		const result = await ActionStateService.getTargetCards(gameStateId, targetIdx);
		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] actionGetTargetCards error:', err);
		return res.status(500).json({ status: 'ko', message: err.message });
	}
};

GameStateController.actionGetAvailablePlayers = async (req, res, next) => {
	const { gameStateId, excludeIdx } = req.body;
	try {
		const result = await ActionStateService.getAvailablePlayers(gameStateId, excludeIdx);
		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] actionGetAvailablePlayers error:', err);
		return res.status(500).json({ status: 'ko', message: err.message });
	}
};

GameStateController.actionWhoHaveCard = async (req, res, next) => {
	const { gameStateId, playerStateIdx, cardKey } = req.body;
	try {
		const result = await ActionStateService.whoHaveCard(gameStateId, playerStateIdx, cardKey);
		log.debug('actionWhoHaveCard result:', result);
		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] actionWhoHaveCard error:', err);
		return res.status(500).json({ status: 'ko', message: err.message });
	}
};

GameStateController.actionGive = async (req, res, next) => {
	const { gameStateId, giverIdx, receiverIdx, cardKey } = req.body;
	try {
		const result = await ActionStateService.give(gameStateId, giverIdx, receiverIdx, cardKey);
		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] actionGive error:', err);
		return res.status(500).json({ status: 'ko', message: err.message });
	}
};

GameStateController.actionSteal = async (req, res, next) => {
	const { gameStateId, stealerIdx, victimIdx, cardKey } = req.body;
	try {
		const result = await ActionStateService.steal(gameStateId, stealerIdx, victimIdx, cardKey);
		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] actionSteal error:', err);
		return res.status(500).json({ status: 'ko', message: err.message });
	}
};

GameStateController.actionSilentSteal = async (req, res, next) => {
	const { gameStateId, stealerIdx, victimIdx, cardKey } = req.body;
	try {
		const result = await ActionStateService.silentSteal(gameStateId, stealerIdx, victimIdx, cardKey);
		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] actionSilentSteal error:', err);
		return res.status(500).json({ status: 'ko', message: err.message });
	}
};

GameStateController.actionWar = async (req, res, next) => {
	const { gameStateId, attackerIdx, victim1Idx, victim2Idx } = req.body;
	try {
		const result = await ActionStateService.war(gameStateId, attackerIdx, victim1Idx, victim2Idx);
		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] actionWar error:', err);
		return res.status(500).json({ status: 'ko', message: err.message });
	}
};

GameStateController.actionOng = async (req, res, next) => {
	const { gameStateId, giverIdx, cardKeys, manualTargetIdxs } = req.body;
	try {
		const result = await ActionStateService.ong(gameStateId, giverIdx, cardKeys, manualTargetIdxs);
		return res.status(200).json(result);
	} catch (err) {
		log.error('[GameStateController] actionOng error:', err);
		return res.status(500).json({ status: 'ko', message: err.message });
	}
};

export default GameStateController;
