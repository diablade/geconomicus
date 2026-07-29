import { IO, ROOMS } from '@geco/shared';
import socket from '#config/socket';

// ── Table-room Last-Known (LK) state sync — see docs/adr/0008-table-omniscient-observer-lk-sync.md ──
// The Table console is fed absolute snapshots of whatever an operation touched; it replaces those
// fields wholesale (never computes a delta). Emitted to the table room *in addition* to the unchanged
// player-facing events. Aggregates (currentMassMonetary, bank indicators) are NOT here — they ride
// their causing domain events (credit / DU / death).

const SyncHelper = {};

/** Broadcast the affected players' absolute rows to the table room. Pass the live player objects. */
SyncHelper.emitPlayerSync = (gameStateId, players) => {
	const rows = (players || [])
		.filter((p) => !!p)
		.map((p) => ({ idx: p.idx, coins: p.coins, cards: p.cards, actionTokens: p.actionTokens }));
	if (rows.length === 0) return;
	socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.PLAYER.STATE_SYNC, { players: rows });
};

/** Broadcast the changed deck levels' absolute card arrays to the table room. `levels` are deck (weight) indices. */
SyncHelper.emitDecksSync = (gameStateId, gameState, levels) => {
	const unique = [...new Set(levels)].filter((lvl) => Array.isArray(gameState.decks?.[lvl]));
	if (unique.length === 0) return;
	const decks = unique.map((level) => ({ level, cards: gameState.decks[level] }));
	socket.emitTo(ROOMS.gameStateTable(gameStateId), IO.DECKS_STATE_SYNC, { decks });
};

export default SyncHelper;
