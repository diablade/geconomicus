import { CREDIT_STATUS, EVENT_LK_CONTRACT, GAME_TYPE, LK_KEYS, PLAYER_STATUS } from '@geco/shared';

const cardsValueOf = (playerState) => (playerState.cards ?? []).reduce((sum, card) => sum + (card?.price ?? 0), 0);

const debtOf = (gameState, playerStateIdx) =>
	(gameState.credits ?? [])
		.filter(
			(credit) =>
				Number(credit.playerStateIdx) === Number(playerStateIdx) &&
				credit.status !== CREDIT_STATUS.DONE &&
				credit.status !== CREDIT_STATUS.CANCELED
		)
		.reduce((sum, credit) => sum + (credit.amount ?? 0) + (credit.interest ?? 0), 0);

const EXTRACTORS = {
	[LK_KEYS.PLAYERS]: (gameState, touched) => {
		const snapshot = {};
		for (const idx of touched) {
			const playerState = (gameState.playersStates ?? []).find((p) => Number(p.idx) === Number(idx));
			if (!playerState) continue;
			snapshot[playerState.idx] = {
				coins: playerState.coins ?? 0,
				cardsValue: cardsValueOf(playerState),
				...(gameState.typeMoney === GAME_TYPE.DEBT ? { debt: debtOf(gameState, playerState.idx) } : {}),
			};
		}
		return snapshot;
	},
	[LK_KEYS.MASS_MONETARY]: (gameState) => gameState.currentMassMonetary ?? 0,
	[LK_KEYS.DU]: (gameState) => gameState.currentDU ?? 0,
	[LK_KEYS.ALIVE_COUNT]: (gameState) =>
		(gameState.playersStates ?? []).filter((p) => p.status !== PLAYER_STATUS.DEAD).length,
	[LK_KEYS.BANK_INTEREST_EARNED]: (gameState) => gameState.bankInterestEarned ?? 0,
	[LK_KEYS.BANK_MONEY_LOST]: (gameState) => gameState.bankMoneyLost ?? 0,
	[LK_KEYS.BANK_MONEY_DESTROYED]: (gameState) => gameState.bankMoneyDestroyed ?? 0,
	[LK_KEYS.BANK_GOODS_EARNED]: (gameState) => gameState.bankGoodsEarned ?? 0,
};

const LkBuilder = {};

LkBuilder.resolveTouched = (gameState, emitter, receiver, touched) => {
	if (Array.isArray(touched)) return touched;
	const known = new Set((gameState?.playersStates ?? []).map((p) => Number(p.idx)));
	return [emitter, receiver]
		.map((role) => Number(role))
		.filter((idx) => Number.isInteger(idx) && known.has(idx))
		.filter((idx, position, all) => all.indexOf(idx) === position);
};

LkBuilder.build = (typeEvent, gameState, touched) => {
	const pieces = EVENT_LK_CONTRACT[typeEvent];
	if (!pieces || !gameState) return {};
	const lk = {};
	for (const piece of pieces) {
		const extractor = EXTRACTORS[piece];
		if (!extractor) throw new Error(`[LK] no extractor declared for piece "${piece}" (event ${typeEvent})`);
		lk[piece] = extractor(gameState, touched);
	}
	return lk;
};

export default LkBuilder;
