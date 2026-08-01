import { DB_EVENTS, EVENT_LK_CONTRACT, LK_KEYS } from '@geco/shared';

const SESSION_SCOPED_EVENTS = [DB_EVENTS.SESSION_STARTED, DB_EVENTS.SESSION_ENDED];

const isPlayerSnapshot = (snapshot) =>
	snapshot !== null &&
	typeof snapshot === 'object' &&
	Number.isFinite(snapshot.coins) &&
	Number.isFinite(snapshot.cardsValue);

const isPlayersLk = (value) => {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const entries = Object.entries(value);
	return entries.length > 0 && entries.every(([idx, snapshot]) => /^\d+$/.test(idx) && isPlayerSnapshot(snapshot));
};

const LkGuard = {};

LkGuard.missingLkKeys = (typeEvent, payload) => {
	const required = EVENT_LK_CONTRACT[typeEvent];
	if (!required) return [];
	const body = payload ?? {};
	return required.filter((key) =>
		key === LK_KEYS.PLAYERS ? !isPlayersLk(body[key]) : !Number.isFinite(body[key])
	);
};

LkGuard.missingIdentity = (typeEvent, sessionId, gameStateId) => {
	const missing = [];
	if (sessionId === undefined || sessionId === null || sessionId === '') missing.push('sessionId');
	if (!SESSION_SCOPED_EVENTS.includes(typeEvent) && (gameStateId === undefined || gameStateId === null || gameStateId === '')) {
		missing.push('gameStateId');
	}
	return missing;
};

LkGuard.assertLkContract = (typeEvent, payload) => {
	const missing = LkGuard.missingLkKeys(typeEvent, payload);
	if (missing.length > 0) {
		throw new Error(`[LK] ${typeEvent} missing required Last-Known data: ${missing.join(', ')}`);
	}
};

LkGuard.assertEventContract = (typeEvent, sessionId, gameStateId, payload) => {
	const missingIds = LkGuard.missingIdentity(typeEvent, sessionId, gameStateId);
	if (missingIds.length > 0) {
		throw new Error(`[LK] ${typeEvent} missing event identity: ${missingIds.join(', ')}`);
	}
	LkGuard.assertLkContract(typeEvent, payload);
};

export default LkGuard;
