import { describe, expect, test } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DB_EVENTS, EVENT_LK_CONTRACT, EVENT_LK_EXEMPT, LK_KEYS } from '@geco/shared';
import LkGuard from '../src/gameState/helpers/lk.guard.js';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

const walk = (dir) =>
	readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			return entry === 'legacy' ? [] : walk(full);
		}
		return full.endsWith('.js') ? [full] : [];
	});

const sourceFiles = walk(SRC);

/** Every place in src/ that builds an event, mapped from event type to "file:line" call sites. */
const emissionSites = () => {
	const sites = new Map();
	const record = (name, file, lineNumber) => {
		if (!DB_EVENTS[name]) return;
		const previous = sites.get(DB_EVENTS[name]) ?? [];
		previous.push(`${file.slice(SRC.length + 1).replace(/\\/g, '/')}:${lineNumber}`);
		sites.set(DB_EVENTS[name], previous);
	};

	for (const file of sourceFiles) {
		const lines = readFileSync(file, 'utf8').split('\n');
		lines.forEach((line, i) => {
			const buildsAnEvent = /(?:createEvent|postNow)\(/.test(line);
			if (buildsAnEvent) {
				for (const match of line.matchAll(/DB_EVENTS\.([A-Z_]+)/g)) record(match[1], file, i + 1);
				return;
			}
			const typeOnItsOwnLine = line.match(/DB_EVENTS\.([A-Z_]+),\s*$/);
			if (typeOnItsOwnLine) record(typeOnItsOwnLine[1], file, i + 1);
		});
	}
	return sites;
};

const playersLk = (idx = 0) => ({ [idx]: { coins: 10, cardsValue: 4 } });

describe('event LK contract — coverage', () => {
	test('every declared DB event is either under contract or explicitly exempt', () => {
		const classified = new Set([...Object.keys(EVENT_LK_CONTRACT), ...EVENT_LK_EXEMPT]);
		const unclassified = Object.values(DB_EVENTS).filter((type) => !classified.has(type));
		expect(unclassified).toEqual([]);
	});

	test('no event is both under contract and exempt', () => {
		const both = EVENT_LK_EXEMPT.filter((type) => EVENT_LK_CONTRACT[type]);
		expect(both).toEqual([]);
	});

	test('every event under contract is actually emitted somewhere', () => {
		const sites = emissionSites();
		const declaredButNeverEmitted = Object.keys(EVENT_LK_CONTRACT).filter((type) => !sites.has(type));
		expect(declaredButNeverEmitted).toEqual([]);
	});

	test('every emitted event is classified', () => {
		const sites = emissionSites();
		const classified = new Set([...Object.keys(EVENT_LK_CONTRACT), ...EVENT_LK_EXEMPT]);
		const emittedButUnclassified = [...sites.keys()].filter((type) => !classified.has(type));
		expect(emittedButUnclassified).toEqual([]);
	});
});

describe('event LK contract — guard', () => {
	test('accepts a payload whose declared pieces all carry usable values', () => {
		expect(() =>
			LkGuard.assertLkPieces(DB_EVENTS.CREDIT_NEW, {
				[LK_KEYS.PLAYERS]: playersLk(3),
				[LK_KEYS.MASS_MONETARY]: 120,
			})
		).not.toThrow();
	});

	test('rejects a declared piece with no usable value, naming it', () => {
		expect(() => LkGuard.assertLkPieces(DB_EVENTS.CREDIT_NEW, { [LK_KEYS.PLAYERS]: playersLk(3) })).toThrow(
			/massMonetaryLK/
		);
	});

	test('rejects an empty playersLK map', () => {
		expect(() =>
			LkGuard.assertLkPieces(DB_EVENTS.TRANSACTION, { [LK_KEYS.PLAYERS]: {} })
		).toThrow(/playersLK/);
	});

	test('rejects a playersLK entry missing cardsValue', () => {
		expect(() =>
			LkGuard.assertLkPieces(DB_EVENTS.TRANSACTION, { [LK_KEYS.PLAYERS]: { 0: { coins: 5 } } })
		).toThrow(/playersLK/);
	});

	test('rejects a playersLK keyed by anything other than playerStateIdx', () => {
		expect(() =>
			LkGuard.assertLkPieces(DB_EVENTS.TRANSACTION, { [LK_KEYS.PLAYERS]: { bank: { coins: 5, cardsValue: 0 } } })
		).toThrow(/playersLK/);
	});

	test('rejects an event built without sessionId or gameStateId', () => {
		expect(() =>
			LkGuard.assertEventContract(DB_EVENTS.CREDIT_NEW, undefined, undefined, {
				[LK_KEYS.PLAYERS]: playersLk(0),
				[LK_KEYS.MASS_MONETARY]: 10,
			})
		).toThrow(/sessionId, gameStateId/);
	});

	test('allows a session-scoped event to carry no gameStateId', () => {
		expect(() => LkGuard.assertEventContract(DB_EVENTS.SESSION_STARTED, 'sess_1', null, {})).not.toThrow();
	});

	test('ignores exempt events entirely', () => {
		for (const type of EVENT_LK_EXEMPT) {
			expect(() => LkGuard.assertLkPieces(type, {})).not.toThrow();
		}
	});
});

describe('event LK contract — inventory', () => {
	test('reports every contract event and the call sites that emit it', () => {
		const sites = emissionSites();
		const report = Object.keys(EVENT_LK_CONTRACT)
			.map((type) => `  ${type} -> ${(sites.get(type) ?? []).join(', ')}`)
			.sort()
			.join('\n');
		const ready = Object.keys(EVENT_LK_CONTRACT).length;
		console.log(`LK contract covers ${ready} event types across these call sites:\n${report}`);
		expect(ready).toBeGreaterThan(0);
	});
});
