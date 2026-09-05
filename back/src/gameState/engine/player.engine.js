import { DB_EVENTS, GAME_TYPE, PLAYER_STATUS, PLAYER_TYPE } from '@geco/shared';
import EventHelper from '../helpers/event.helper.js';
import DecksHelper from '../helpers/decks.helper.js';
import BankEngine from './bank.engine.js';

const PlayerEngine = {};

/** The Life an avatar is currently living, or undefined once it has died terminally. */
export const currentLifeOf = (gameState, avatarIdx) =>
	gameState.playersStates.find((p) => p.avatarIdx === avatarIdx && p.status !== PLAYER_STATUS.DEAD);

/** Find a Life by its playerStateIdx, or throw. */
const findLife = (gameState, playerStateIdx) => {
	const player = gameState.playersStates.find((p) => p.idx === playerStateIdx);
	if (!player) throw new Error('ERROR.PLAYER_NOT_FOUND');
	return player;
};

/**
 * How many cards a reincarnated Life opens with, in level-0-equivalent units.
 *
 * The same `distribInitCards` the opening deal uses, so a new Life starts on the terms the table
 * started on. Unlike the opening deal this never throws when the decks are thin — the draw
 * degrades to whatever is available rather than blocking a death mid-round.
 */
PlayerEngine.openingCardUnits = (entry) => entry.rules.distribInitCards;

/** What a card costs right now — June prices scale with the DU, debt prices are absolute. */
PlayerEngine.priceOfCard = (entry, card) => {
	const { gameState } = entry;
	return gameState.typeMoney === GAME_TYPE.JUNE
		? Number((card.price * gameState.currentDU).toFixed(2))
		: card.price;
};

/**
 * Move one card from a seller to a buyer and the coins the other way.
 *
 * @param {{gameState: object, events: object[]}} entry
 * @param {number} buyerIdx
 * @param {number} sellerIdx
 * @param {string} cardKey
 * @returns {{cost: number, card: object, buyer: object, seller: object}}
 */
PlayerEngine.applyTransaction = (entry, buyerIdx, sellerIdx, cardKey) => {
	const { gameState, events } = entry;
	const buyer = gameState.playersStates.find((p) => p.idx === buyerIdx);
	const seller = gameState.playersStates.find((p) => p.idx === sellerIdx);
	if (!buyer) throw new Error('ERROR.BUYER_NOT_FOUND');
	if (!seller) throw new Error('ERROR.SELLER_NOT_FOUND');
	if (buyer.status !== PLAYER_STATUS.ALIVE || seller.status !== PLAYER_STATUS.ALIVE)
		throw new Error('ERROR.TRANSACTION_CANNOT_INVOLVE_DEAD');

	const card = seller.cards.find((c) => c.key === cardKey);
	if (!card) throw new Error('ERROR.CARD_NOT_FOUND');

	const cost = PlayerEngine.priceOfCard(entry, card);
	if (buyer.coins < cost) throw new Error('ERROR.NOT_ENOUGH_COINS');

	buyer.coins = Number((buyer.coins - cost).toFixed(2));
	seller.coins = Number((seller.coins + cost).toFixed(2));
	buyer.cards.push(card);
	seller.cards = seller.cards.filter((c) => c.key !== cardKey);

	events.push(
		EventHelper.createEvent(DB_EVENTS.TRANSACTION, gameState, {
			emitter: buyerIdx,
			receiver: sellerIdx,
			payload: { cost, card },
		})
	);

	return { cost, card, buyer, seller };
};

/**
 * End a Life terminally: seize what it owes, return its hand to the decks, mark it DEAD.
 *
 * Emits exactly one event for the whole moment — `player-died-with-seizure` when the claw-back
 * actually moved something, `player-died` otherwise. The choice is keyed on effect, not on game
 * type, so a debt Life that owed nothing emits the same event a June Life does.
 *
 * The dead Life keeps its coins and its hand: that frozen snapshot is the historical record, and
 * its cards being cloned back into the decks is a supply mechanic, not a loss of the record.
 *
 * @param {{gameState: object, events: object[]}} entry
 * @param {object} player - the Life to end, mutated
 * @returns {{player: object, returnedCards: object[], seizure: object|null, wasInPrison: boolean,
 *            resolvedCredits: object[], ghostCoins: number}}
 */
PlayerEngine.endLife = (entry, player) => {
	const { gameState, events } = entry;
	const wasInPrison = player.status === PLAYER_STATUS.PRISON;
	player.status = PLAYER_STATUS.DEAD;

	const seizure = gameState.typeMoney === GAME_TYPE.DEBT ? BankEngine.seizureOnDead(entry, player) : null;

	const returnedCards = player.cards.map((c) => ({ ...c }));
	DecksHelper.pushCardsInDecks(gameState, returnedCards);

	const seized = Boolean(
		seizure && (seizure.totalCoinSeized || seizure.totalSeizedCardsValue || seizure.totalNotPayed)
	);
	const payload = { cards: player.cards };
	if (seized) {
		payload.seizure = {
			totalCoinSeized: seizure.totalCoinSeized,
			interest: seizure.totalPayedInterest,
			amount: seizure.totalPayedAmount,
			cards: seizure.seizedCards,
			notPayed: seizure.totalNotPayed,
		};
	}

	events.push(
		EventHelper.createEvent(seized ? DB_EVENTS.PLAYER_DIED_WITH_SEIZURE : DB_EVENTS.PLAYER_DIED, gameState, {
			emitter: PLAYER_TYPE.MASTER,
			receiver: player.idx,
			payload,
		})
	);

	return {
		player,
		returnedCards,
		seizure,
		wasInPrison,
		resolvedCredits: seizure?.credits ?? [],
		ghostCoins: player.coins,
	};
};

/**
 * End an avatar's current Life and open a fresh one for the same avatar.
 *
 * Returns null when the avatar has no living Life, which is how a death scheduled against an
 * already-terminal avatar becomes a no-op rather than an error.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @param {number} avatarIdx
 * @returns {{oldPlayerStateIdx: number, newPlayerStateIdx: number, newCards: object[], newLife: object,
 *            wasInPrison: boolean, death: object}|null}
 */
PlayerEngine.reincarnate = (entry, avatarIdx) => {
	const { gameState, rules, events } = entry;
	const current = currentLifeOf(gameState, avatarIdx);
	if (!current) return null;

	const oldPlayerStateIdx = current.idx;
	const death = PlayerEngine.endLife(entry, current);

	const newPlayerStateIdx = gameState.playerStateIndexSeq;
	gameState.playerStateIndexSeq += 1;
	const newCards = DecksHelper.drawReincarnationCards(gameState, PlayerEngine.openingCardUnits(entry));
	const newLife = {
		idx: newPlayerStateIdx,
		avatarIdx,
		status: PLAYER_STATUS.ALIVE,
		coins: 0,
		cards: newCards,
		actionTokens: rules.startingTokens ?? 1,
	};
	gameState.playersStates.push(newLife);

	events.push(
		EventHelper.createEvent(DB_EVENTS.PLAYER_BIRTH, gameState, {
			emitter: PLAYER_TYPE.MASTER,
			receiver: newPlayerStateIdx,
			payload: { cards: newCards, avatarIdx },
		})
	);

	return {
		oldPlayerStateIdx,
		newPlayerStateIdx,
		newCards,
		newLife,
		wasInPrison: death.wasInPrison,
		death,
	};
};

/**
 * Kill a Life outright, with no new Life after it.
 *
 * @param {{gameState: object, events: object[]}} entry
 * @param {number} playerStateIdx
 * @returns {object} the death result of {@link PlayerEngine.endLife}
 */
PlayerEngine.killLife = (entry, playerStateIdx) => {
	const player = findLife(entry.gameState, playerStateIdx);
	if (player.status === PLAYER_STATUS.DEAD) throw new Error('ERROR.PLAYER_ALREADY_DEAD');
	return PlayerEngine.endLife(entry, player);
};

/** Drop an avatar from the scheduled death order, so it is not killed twice. */
PlayerEngine.removeFromDeathQueue = (entry, avatarIdx) => {
	const queue = entry.gameState.gameTimers?.deathState?.deathQueue;
	if (!Array.isArray(queue)) return false;
	const i = queue.indexOf(avatarIdx);
	if (i === -1) return false;
	queue.splice(i, 1);
	return true;
};

/**
 * The animator's manual kill: reincarnates an avatar that has not reincarnated yet, terminal after.
 *
 * Either way the avatar leaves the death queue, since its one scheduled death has now been spent,
 * and either way the returned `death` is the same record every death path hands back — so the
 * caller reads `wasInPrison` and `resolvedCredits` off one shape whichever branch was taken.
 *
 * @param {{gameState: object, rules: object, events: object[]}} entry
 * @param {number} playerStateIdx - the Life the animator clicked on
 * @returns {{reincarnated: boolean, avatarIdx: number, death: object,
 *            oldPlayerStateIdx?: number, newPlayerStateIdx?: number}}
 */
PlayerEngine.forceDeath = (entry, playerStateIdx) => {
	const target = findLife(entry.gameState, playerStateIdx);
	if (target.status === PLAYER_STATUS.DEAD) throw new Error('ERROR.PLAYER_ALREADY_DEAD');

	const avatarIdx = target.avatarIdx;
	const alreadyReincarnated =
		entry.gameState.playersStates.filter((p) => p.avatarIdx === avatarIdx).length > 1;

	if (alreadyReincarnated) {
		const death = PlayerEngine.endLife(entry, target);
		PlayerEngine.removeFromDeathQueue(entry, avatarIdx);
		return { reincarnated: false, avatarIdx, death };
	}

	const result = PlayerEngine.reincarnate(entry, avatarIdx);
	PlayerEngine.removeFromDeathQueue(entry, avatarIdx);
	return {
		reincarnated: true,
		avatarIdx,
		death: result.death,
		oldPlayerStateIdx: result.oldPlayerStateIdx,
		newPlayerStateIdx: result.newPlayerStateIdx,
	};
};

export default PlayerEngine;
