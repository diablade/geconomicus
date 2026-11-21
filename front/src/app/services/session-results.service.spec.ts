import { DB_EVENTS, LK_KEYS, PLAYER_STATUS } from '@geco/shared';
import { GecoEventV2 } from '../models/geco-event';
import { GameState } from '../models/gameState';
import { SessionResultsService } from './session-results.service';

const GS = 'gs1';
const HAND = 4;

/** Minimal event carrying whatever last-known payload the test needs. */
const ev = (typeEvent: string, at: string, payload: Record<string, any> = {}): GecoEventV2 =>
	({ _id: at, typeEvent, sessionId: 's1', gameStateId: GS, emitter: 'master', receiver: '-', at, payload }) as any;

/** Two avatars, one of them reincarnated: its first life is dead but still holds a card. */
const gameState = (): GameState =>
	({
		_id: GS,
		typeMoney: 'june',
		currentMassMonetary: 60,
		currentDU: 5,
		credits: [],
		gameTimers: { startedAt: new Date('2026-01-01T10:02:00Z'), endedAt: new Date('2026-01-01T10:30:00Z') },
		playersStates: [
			{ idx: 1, avatarIdx: 1, status: PLAYER_STATUS.ALIVE, coins: 40, cards: [{ price: 7 }] },
			{ idx: 2, avatarIdx: 2, status: PLAYER_STATUS.DEAD, coins: 0, cards: [{ price: 2 }] },
			{ idx: 3, avatarIdx: 2, status: PLAYER_STATUS.ALIVE, coins: 20, cards: [{ price: 3 }] },
		],
	}) as any;

describe('SessionResultsService', () => {
	const service = new SessionResultsService();

	const stream = [
		ev(DB_EVENTS.GAME_INIT, '2026-01-01T10:00:00Z'),
		ev(DB_EVENTS.PLAYER_INIT, '2026-01-01T10:00:10Z', {
			[LK_KEYS.PLAYERS]: { 1: { coins: 10, cardsValue: 4 } },
			[LK_KEYS.MASS_MONETARY]: 10,
		}),
		ev(DB_EVENTS.PLAYER_INIT, '2026-01-01T10:00:20Z', {
			[LK_KEYS.PLAYERS]: { 2: { coins: 10, cardsValue: 4 } },
			[LK_KEYS.MASS_MONETARY]: 20,
		}),
		ev(DB_EVENTS.FIRST_DU, '2026-01-01T10:01:00Z', { [LK_KEYS.MASS_MONETARY]: 20, [LK_KEYS.DU]: 2 }),
		ev(DB_EVENTS.GAME_STARTED, '2026-01-01T10:02:00Z'),
		ev(DB_EVENTS.TRANSACTION, '2026-01-01T10:05:00Z', {
			[LK_KEYS.PLAYERS]: { 1: { coins: 40, cardsValue: 7 }, 2: { coins: 20, cardsValue: 3 } },
			[LK_KEYS.MASS_MONETARY]: 60,
			cost: 5,
		}),
	];

	it('reads the starting figures at game-started, not at the first setup event', () => {
		const { synthesis } = service.compute(gameState(), stream, [], HAND);
		expect(synthesis.massFirst).toBe(20);
		expect(synthesis.goodsFirst).toBe(8);
		expect(synthesis.duFirst).toBe(2);
	});

	it('falls back to the timer when the stream has no game-started event', () => {
		const withoutStart = stream.filter((e) => e.typeEvent !== DB_EVENTS.GAME_STARTED);
		const { synthesis } = service.compute(gameState(), withoutStart, [], HAND);
		expect(synthesis.massFirst).toBe(20);
		expect(synthesis.goodsFirst).toBe(8);
	});

	it('counts the opening hands at start and every card still held at the end, dead included', () => {
		const { synthesis } = service.compute(gameState(), stream, [], HAND);
		expect(synthesis.goodsCountFirst).toBe(2 * HAND);
		expect(synthesis.goodsCount).toBe(3);
		expect(synthesis.goodsInPlay).toBe(10);
		expect(synthesis.ghostCards).toBe(2);
		expect(synthesis.goodsInPlay + synthesis.ghostCards).toBe(12);
	});

	it('combines coins and cards without subtracting debt, June cards converted at the DU of the moment', () => {
		const { combined } = service.compute(gameState(), stream, [], HAND);
		const life1 = combined.find((s) => s.life.idx === 1)!;
		expect(life1.points[life1.points.length - 1].y).toBe(40 + 7 * 2);
	});

	it('runs a dead life\'s coin line flat to the end of the game', () => {
		const deadKeepsCoins = gameState();
		deadKeepsCoins.playersStates[1].coins = 20;
		const { coins } = service.compute(deadKeepsCoins, stream, [], HAND);
		const life2 = coins.find((s) => s.life.idx === 2)!;
		expect(life2.points[life2.points.length - 1]).toEqual({ x: '2026-01-01T10:30:00.000Z', y: 20 });
	});

	it('scores June cards at the final DU and sums every life of an avatar', () => {
		const { podium } = service.compute(gameState(), stream, [], HAND);
		expect(podium.map((p) => [p.avatar.avatarIdx, p.score])).toEqual([
			[1, 40 + 7 * 5],
			[2, 20 + (2 + 3) * 5],
		]);
	});

	it('counts every credit taken but only the debt still owed', () => {
		const debtGame = {
			...gameState(),
			typeMoney: 'debt',
			credits: [
				{ playerStateIdx: 2, amount: 3, interest: 1, status: 'done' },
				{ playerStateIdx: 3, amount: 3, interest: 1, status: 'running' },
				{ playerStateIdx: 3, amount: 6, interest: 2, status: 'canceled' },
			],
		} as any;
		const avatar2 = service.compute(debtGame, stream, [], HAND).podium.find((p) => p.avatar.avatarIdx === 2)!;
		expect(avatar2.credits).toBe(3);
		expect(avatar2.debt).toBe(4);
		expect(avatar2.score).toBe(20 + 2 + 3);
	});
});
