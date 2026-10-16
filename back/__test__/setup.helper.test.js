import { jest } from '@jest/globals';

await jest.unstable_mockModule('#config/log', () => ({
	default: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { setupGameDebt } = await import('../src/gameState/helpers/setup.helper.js');

const rules = {
	distribInitCards: 4,
	generateLettersAuto: true,
	generatedIdenticalLetters: 5,
	priceWeight1: 1,
	priceWeight2: 2,
	priceWeight3: 4,
	priceWeight4: 8,
	inequalityCards: true,
	pctRichCards: 10,
	pctPoorCards: 20,
};

const makeGameState = (n) => ({ playersStates: Array.from({ length: n }, (_, idx) => ({ idx })), currentMassMonetary: 0 });

describe('opening hands with unequal cards', () => {
	it('deals poor half, middle full, rich full plus half in level 2', async () => {
		const gameState = await setupGameDebt(makeGameState(10), rules);
		const shape = gameState.playersStates.map((p) => [
			p.cards.filter((c) => c.weight === 0).length,
			p.cards.filter((c) => c.weight === 1).length,
		]);
		expect(shape.filter(([a, b]) => a === 2 && b === 0)).toHaveLength(2);
		expect(shape.filter(([a, b]) => a === 4 && b === 2)).toHaveLength(1);
		expect(shape.filter(([a, b]) => a === 4 && b === 0)).toHaveLength(7);
	});

	it('deals everyone the same hand when the option is off', async () => {
		const gameState = await setupGameDebt(makeGameState(10), { ...rules, inequalityCards: false });
		gameState.playersStates.forEach((p) => expect(p.cards).toHaveLength(4));
	});
});
