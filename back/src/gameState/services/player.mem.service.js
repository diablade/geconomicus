import { BANK, DEAD, DEBT, EVENT, MASTER, TRANSACTION, TRANSFORM_DISCARDS, TRANSFORM_NEWCARDS } from '#constantes';
import log from '#config/log';
import socket from '#config/socket';
import inMemoryGameStateManager from '../managers/InMemoryGameStateManager.js';
import bankMemService from '../bank/bank.mem.service.js';
import decksService from '../decks.service.js';
import bankTimerManager from '../bank/BankTimerManager.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const _findPlayer = (state, playerLifeIdx) => {
    const player = state.playersLifes.find(p => p.idx === playerLifeIdx);
    if (!player) throw new Error(`Player idx ${playerLifeIdx} not found`);
    return player;
};

const _makeEvent = (type, from, to, amount, items) => ({
    type,
    from: from?.toString?.() ?? from,
    to: to?.toString?.() ?? to,
    amount,
    items,
    date: Date.now(),
});

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get a player's current life state from memory (read-only, no lock needed).
 * @param {string} gameStateId
 * @param {number} playerLifeIdx
 * @returns {object} player life POJO
 */
const getPlayerLife = (gameStateId, playerLifeIdx) => {
    const state = inMemoryGameStateManager.getState(gameStateId);
    if (!state) throw new Error(`Game ${gameStateId} not found in memory`);
    return _findPlayer(state, playerLifeIdx);
};

/**
 * Kill a player:
 * - If DEBT game: auto-seize all active credits (bankMemService.seizureOnDead)
 * - Stop bank timers for this player
 * - Put remaining cards back in decks
 * - Set player status to DEAD
 * @param {string} gameStateId
 * @param {number} playerLifeIdx
 */
const killPlayer = async (gameStateId, playerLifeIdx) => {
    // 1. Handle debt seizure FIRST (holds its own lock internally)
    const entry = inMemoryGameStateManager.getGame(gameStateId);
    if (!entry) throw new Error(`Game ${gameStateId} not found in memory`);

    if (entry.state.typeMoney === DEBT) {
        await bankTimerManager.stopAllPlayerDebtsTimer(gameStateId, playerLifeIdx.toString());
        await bankMemService.seizureOnDead(gameStateId, playerLifeIdx);
    }

    // 2. Kill the player and push remaining cards to decks (single lock)
    return inMemoryGameStateManager.withLock(gameStateId, ({ state }) => {
        const player = _findPlayer(state, playerLifeIdx);

        // Push remaining cards back to decks
        decksService.pushCardsInDecksInMemory(state, player.cards);

        const event = _makeEvent(DEAD, 'master', playerLifeIdx, player.coins, player.cards);
        player.status = DEAD;
        player.cards = [];

        state.events = state.events || [];
        state.events.push(event);

        socket.emitTo(playerLifeIdx.toString(), DEAD);
        socket.emitTo(gameStateId + EVENT, EVENT, event);
        socket.emitTo(gameStateId + BANK, DEAD, event);
        socket.emitTo(gameStateId + MASTER, DEAD, event);

        return event;
    });
};

/**
 * Execute a trade transaction between two players.
 * Moves coinsAmount from buyer to seller and transfers the card from seller to buyer.
 * @param {string} gameStateId
 * @param {number} buyerLifeIdx
 * @param {number} sellerLifeIdx
 * @param {string} cardKey  — card.key identifier
 * @param {number} coinsAmount
 */
const transaction = async (gameStateId, buyerLifeIdx, sellerLifeIdx, cardKey, coinsAmount) => {
    return inMemoryGameStateManager.withLock(gameStateId, ({ state }) => {
        const buyer = _findPlayer(state, buyerLifeIdx);
        const seller = _findPlayer(state, sellerLifeIdx);

        if (buyer.coins < coinsAmount) throw new Error('ERROR.NOT_ENOUGH_COINS');

        const cardIndex = seller.cards.findIndex(c => key === cardKey);
        if (cardIndex === -1) throw new Error('ERROR.CARD_NOT_FOUND');

        const card = seller.cards[cardIndex];

        // Move coins
        buyer.coins -= coinsAmount;
        seller.coins += coinsAmount;

        // Move card
        seller.cards.splice(cardIndex, 1);
        buyer.cards.push(card);

        const event = _makeEvent(TRANSACTION, sellerLifeIdx, buyerLifeIdx, coinsAmount, [card]);
        state.events = state.events || [];
        state.events.push(event);

        socket.emitTo(gameStateId + EVENT, EVENT, event);
        socket.emitAckTo(buyerLifeIdx.toString(), TRANSACTION, { card, coins: buyer.coins });
        socket.emitAckTo(sellerLifeIdx.toString(), TRANSACTION, { card, coins: seller.coins });

        return event;
    });
};

/**
 * Produce / level-up cards for a player.
 * Delegates pure logic to DeckService.produceCardLevelUp.
 * @param {string} gameStateId
 * @param {number} playerLifeIdx
 * @param {Array}  cards — cards to exchange
 */
const produceCardLevelUp = async (gameStateId, playerLifeIdx, cards) => {
    return inMemoryGameStateManager.withLock(gameStateId, ({ state, rules }) => {
        const result = decksService.produceCardLevelUp(state, rules, playerLifeIdx, cards);

        const discardEvent = _makeEvent(TRANSFORM_DISCARDS, playerLifeIdx, MASTER, 0, result.cardsExchanged);
        const newCardsEvent = _makeEvent(TRANSFORM_NEWCARDS, MASTER, playerLifeIdx, 0, result.newCards);

        state.events = state.events || [];
        state.events.push(discardEvent, newCardsEvent);

        socket.emitTo(gameStateId + EVENT, EVENT, discardEvent);
        socket.emitTo(gameStateId + EVENT, EVENT, newCardsEvent);

        return result;
    });
};

export default {
    getPlayerLife,
    killPlayer,
    transaction,
    produceCardLevelUp,
};
