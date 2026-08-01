import { Card, Credit, GameState } from '../models/gameState';
import { Rules } from '../models/rules';
import { Avatar } from '../models/avatar';
import { Recipe } from '../models/recipe';
import { getRandomAvatar, getRandomBackgroundBoard } from '../services/avatarTools';
import { GAME_STATUS, GAME_TYPE, CREDIT_STATUS } from '@geco/shared';
import * as _ from 'lodash-es';

export const SOUND_KEYS: string[] = [
	'angel', 'buzzer', 'cardFlipBack', 'cardFlipGet', 'coin', 'coins', 'dead', 'done', 'du', 'end',
	'error', 'glitch', 'gotitem', 'high_alarm', 'iamdeath', 'interest', 'notif1', 'notif2', 'nudge',
	'outPrison', 'police', 'police2', 'prison', 'request', 'start',
];

const PRICES: Record<number, number> = { 0: 1, 1: 2, 2: 4, 3: 8 };
const COLORS: Record<number, string> = { 0: 'red', 1: 'yellow', 2: 'green', 3: 'blue' };

function makeCard(letter: string, weight: number, key: string): Card {
	return {
		key,
		letter,
		color: COLORS[weight] ?? '#8e6bee',
		weight,
		price: PRICES[weight] ?? 3,
		displayed: true,
		count: 1,
	};
}

// Board hand: 3× level 1, 2× level 2, 1× level 3 — distinct letters so none completes a square.
export function makeFakeCards(): Card[] {
	return [
		makeCard('A', 0, 'A01'),
		makeCard('B', 0, 'B01'),
		makeCard('C', 0, 'C01'),
		makeCard('D', 1, 'D11'),
		makeCard('E', 1, 'E11'),
		makeCard('F', 2, 'F11'),
	];
}

export function makeFakeCredit(): Credit {
	const now = Date.now();
	const remainingTime = 240000; // 80% remaining of a 5-min credit → 20% elapsed
	return {
		id: 'fake-credit-1',
		amount: 3,
		interest: 1,
		playerStateIdx: 0,
		status: CREDIT_STATUS.RUNNING,
		extended: 0,
		progress: 20,
		createdAt: new Date(now - 60000),
		startedAt: new Date(now - 60000),
		remainingTime,
		endAt: new Date(now + remainingTime),
	};
}

export function makeFakeAvatar(): Avatar {
	const avatar = getRandomAvatar();
	avatar.idx = _.random(1, 99, false);
	avatar.name = 'Nicolas';
	avatar.boardConf = getRandomBackgroundBoard();
	return avatar;
}

export function makeFakeRate(): { amount: number; interest: number; pct: number; allowDouble: boolean } {
	return { amount: 3, interest: 1, pct: 0.33, allowDouble: true };
}

export function makeFakeRules(typeMoney: string, autoSeizure: boolean): Rules {
	const rules = new Rules();
	rules.typeMoney = typeMoney;
	rules.amountCardsForProd = 4;
	rules.generatedIdenticalLetters = 4;
	rules.durationCredit = 5;
	rules.timerPrison = 5;
	rules.autoBank = true;
	rules.autoSeizure = autoSeizure;
	rules.startingTokens = 4;
	rules.defaultCreditAmount = 3;
	rules.defaultInterestAmount = 1;
	return rules;
}

export function makeFakeGameState(typeMoney: string): GameState {
	const gameState = new GameState();
	gameState._id = 'fake-game';
	gameState.typeMoney = typeMoney;
	gameState.status = GAME_STATUS.PLAYING;
	gameState.currentDU = 2;
	return gameState;
}

export function makeFakeBundle(typeMoney: string, autoSeizure: boolean) {
	const isJune = typeMoney === GAME_TYPE.JUNE;
	return {
		coins: isJune ? 20 : 5, // June: raw 20 with DU 2 → 10.00 DU shown; Debt: 5 €
		cards: makeFakeCards(),
		credits: isJune ? [] : [makeFakeCredit()],
		actionTokens: 4,
		gameState: makeFakeGameState(typeMoney),
		rules: makeFakeRules(typeMoney, autoSeizure),
		rate: makeFakeRate(),
	};
}

// A complete square (4 identical cards) the fake panel hosts to demo Production Reveal.
export const FAKE_PROD_WEIGHT = 1;
const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const randomLetter = letters[_.random(0, letters.length - 1, false)];

export function makeFakeLetter(): string {
	return randomLetter;
}

export function makeFakeProductionGroup(): { recipe: Recipe; cards: Card[] } {
	const recipe = new Recipe(randomLetter, FAKE_PROD_WEIGHT);
	recipe.generateIngredients(4);
	const cards: Card[] = recipe.ingredients.map((ing) => {
		ing.have = 1;
		return makeCard(randomLetter, FAKE_PROD_WEIGHT, ing.key);
	});
	recipe.completed = true;
	return { recipe, cards };
}

export function makeFakeProducedCard(): Card {
	return makeCard(randomLetter, FAKE_PROD_WEIGHT + 1, `${randomLetter}${FAKE_PROD_WEIGHT + 1}1`);
}
