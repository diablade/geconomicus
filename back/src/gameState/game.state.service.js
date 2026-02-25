import GameStateModel from './game.state.model.js';
import initGameJune from './init.game.service.js';
import RulesService from '../session/rules/rules.service.js';
import RulesManager from './managers/RulesManager.js';
import { C } from '#constantes';
import SessionService from '../session/session.service.js';

const GameStateService = {};

GameStateService.create = async (players, rules) => {
	const newGameState = new GameStateModel({
		typeMoney: rules.typeMoney,
		sessionId: rules.sessionId,
		ruleIdx: rules.idx,
		playerLifeIndexSeq: players.length,
		playersLifes: players.map((p) => {
			return {
				idx: p.idx,
				avatarIdx: p.avatarIdx,
				status: C.ALIVE,
				coins: 0,
				cards: [],
			};
		}),
	});
	// create life for each player
	// link to distribute to players ...
	return await newGameState.save();
};
GameStateService.getById = async (id, enriched = true) => {
	const gameState = await GameStateModel.findById(id).lean();
	if (!gameState) {
		throw new Error('Game state not found');
	}
	if (enriched) {
		let session = await SessionService.getById(gameState.sessionId);
		const rules = session.gamesRules.find((rule) => rule.idx === gameState.ruleIdx);
		session.gamesRules = [];
		return { gameState, session, rules };
	}
	return { gameState };
};
GameStateService.whoHaveCard = async (gameStateId, cardKey) => {
	const gameState = await GameStateModel.findById(gameStateId).lean();
	if (gameState) {
		const player = gameState.playersLifes
			.filter((p) => p.status === 'alive')
			.find((player) => player.cards.find((card) => card.key === cardKey));
		if (player) {
			return {
				status: 'player',
				name: player.name,
			};
		} else {
			const inDeck = gameState.decks.some((deck) => deck.some((card) => card.key === cardKey));
			if (inDeck) {
				return {
					status: 'deck',
					name: '',
				};
			}
			return {
				status: 'ko',
				name: '',
				reason: 'not found in deck and players hands',
			};
		}
	} else {
		return {
			status: 'ko',
			name: '',
			reason: 'GameState not found',
		};
	}
};
GameStateService.initGame = async (gameStateId, socket) => {
	const gameState = await GameStateModel.findById(gameStateId).lean();
	const rules = await RulesService.getByIdx(gameState.sessionId, gameState.ruleIdx);
	RulesManager.setRules(gameState.sessionId, gameState.ruleIdx, rules);
	await initPlayersLifes(gameStateId, rules, socket);
	if (gameState.typeMoney === C.JUNE) {
		return await initGameJune(gameState, rules, socket);
	} else if (gameState.typeMoney === C.DEBT) {
		return await initGameDebt(gameState, rules, socket);
	} else {
		throw new Error('Game state not found');
	}
};
GameStateService.removeAllBySessionId = async (id) => {
	return await GameStateModel.deleteMany({ sessionId: id }).exec();
};

export default GameStateService;
