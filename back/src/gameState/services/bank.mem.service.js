import { IO } from '#constantes';
import log from '#config/log';
import socket from '#config/socket';
import inMemoryGameStateManager from '../managers/InMemoryGameStateManager.js';
import bankTimerManager from '../managers/BankTimerManager.js';
import decksService from '../decks.service.js';
import Timer from '../../misc/Timer.js';
import { differenceInMilliseconds } from 'date-fns';

const minute = 60 * 1000;
const fiveSeconds = 5 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────

const _findPlayer = (state, playerLifeIdx) => {
    const player = state.playersLifes.find(p => p.idx === playerLifeIdx);
    if (!player) throw new Error(`Player idx ${playerLifeIdx} not found`);
    return player;
};

const _findCredit = (state, creditIdx) => {
    const credit = state.credits.find(c => idx === creditIdx);
    if (!credit) throw new Error(`Credit idx ${creditIdx} not found`);
    return credit;
};

// ─── Timer helpers ───────────────────────────────────────────────────────────

const _addDebtTimer = (creditId, startTickNow, duration, data) => {
    bankTimerManager.addTimer(new Timer(creditId, duration * minute, fiveSeconds, data, (timer) => {
        const remainingTime = differenceInMilliseconds(timer.endTime, new Date());
        const totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);
        const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
        socket.emitTo(timer.data.gameStateId + BANK, IO.CREDIT_PROGRESS, { id: creditId, progress });
        socket.emitTo(timer.data.playerLifeIdx.toString(), IO.CREDIT_PROGRESS, { id: creditId, progress });
    }, (timer) => {
        _timeoutCredit(timer);
    }), startTickNow);
};

const _addPrisonTimer = (playerId, duration, data) => {
    bankTimerManager.addTimer(new Timer(playerId, duration * minute, fiveSeconds, data, (timer) => {
        const remainingTime = differenceInMilliseconds(timer.endTime, new Date());
        const totalTime = differenceInMilliseconds(timer.endTime, timer.startTime);
        const progress = 100 - Math.floor((remainingTime / totalTime) * 100);
        socket.emitTo(timer.data.gameStateId + BANK, IO.PRISON_PROGRESS, { id: playerId, progress, remainingTime });
        socket.emitTo(timer.data.playerLifeIdx.toString(), IO.PRISON_PROGRESS, { id: playerId, progress, remainingTime });
    }, (timer) => {
        _timeoutPrison(timer);
    }), true);
};

const _timeoutCredit = async (timer) => {
    if (!timer) return;
    const { gameStateId, playerLifeIdx, creditIdx } = timer.data;
    await bankTimerManager.stopAndRemoveTimer(timer.id);

    try {
        await inMemoryGameStateManager.withLock(gameStateId, ({ state, rules }) => {
            const credit = _findCredit(state, creditIdx);
            const player = _findPlayer(state, playerLifeIdx);

            if (credit.status === CREDIT_DONE) return;

            if (credit.amount + credit.interest <= player.coins) {
                // Player can pay interest — request it
                credit.status = REQUEST_CREDIT;
                const event = _makeEvent(REQUEST_CREDIT, MASTER, playerLifeIdx, credit.amount, [credit]);
                state.events = state.events || [];
                state.events.push(event);
                socket.emitTo(gameStateId + EVENT, EVENT, event);
                socket.emitAckTo(playerLifeIdx.toString(), IO.CREDIT_TIMEOUT, { credit });
                socket.emitTo(gameStateId + BANK, IO.CREDIT_TIMEOUT, credit);
            } else {
                // Default
                credit.status = DEFAULT_CREDIT;
                const event = _makeEvent(DEFAULT_CREDIT, MASTER, playerLifeIdx, credit.amount, [credit]);
                state.events = state.events || [];
                state.events.push(event);
                socket.emitTo(gameStateId + EVENT, EVENT, event);
                socket.emitTo(gameStateId + BANK, IO.CREDIT_DEFAULT, credit);
                if (player.status !== DEAD) {
                    socket.emitAckTo(playerLifeIdx.toString(), IO.CREDIT_DEFAULT, { credit });
                }
            }
        });
    } catch (err) {
        log.error('[bankMemService] _timeoutCredit error:', err);
    }
};

const _timeoutPrison = async (timer) => {
    if (!timer) return;
    const { gameStateId, playerLifeIdx } = timer.data;
    await bankTimerManager.stopAndRemoveTimer(timer.id);
    await getOut(gameStateId, playerLifeIdx);
};

// Simple event builder (mirrors legacy constructor.event shape)
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
 * Create a credit for a player.
 * Adds coins (amount) to player, pushes credit into state.credits,
 * updates currentMassMonetary, starts a debt timer.
 */
const createCredit = async (gameStateId, playerLifeIdx, amount, interest, startNow) => {
    return inMemoryGameStateManager.withLock(gameStateId, ({ state, rules }) => {
        const player = _findPlayer(state, playerLifeIdx);

        const creditIdx = state.creditIndexSeq++;
        const credit = {
            idx: creditIdx,
            amount,
            interest,
            playerLifeIdx,
            status: startNow ? RUNNING_CREDIT : PAUSED_CREDIT,
            extended: 0,
            createDate: new Date(),
            startDate: startNow ? new Date() : null,
            endDate: null,
        };

        state.credits = state.credits || [];
        state.credits.push(credit);
        player.coins += amount;
        state.currentMassMonetary += amount;

        const event = _makeEvent(NEW_CREDIT, MASTER, playerLifeIdx, amount, [credit]);
        state.events = state.events || [];
        state.events.push(event);

        const timerId = `${gameStateId}:credit:${creditIdx}`;
        _addDebtTimer(timerId, startNow, rules.timerCredit, {
            gameStateId,
            playerLifeIdx,
            creditIdx,
        });

        socket.emitTo(gameStateId + EVENT, EVENT, event);
        socket.emitAckTo(playerLifeIdx.toString(), NEW_CREDIT, { credit });

        return credit;
    });
};

/**
 * Settle a credit in full (principal + interest).
 */
const settleCredit = async (gameStateId, playerLifeIdx, creditIdx) => {
    return inMemoryGameStateManager.withLock(gameStateId, ({ state }) => {
        const credit = _findCredit(state, creditIdx);
        const player = _findPlayer(state, playerLifeIdx);

        if (credit.playerLifeIdx !== playerLifeIdx) throw new Error('Player is not the owner of this credit');
        if (credit.status === CREDIT_DONE) throw new Error('Credit is already done');

        const totalDue = credit.amount + credit.interest;
        if (player.coins < totalDue) return undefined; // cannot pay

        player.coins -= totalDue;
        state.bankInterestEarned = (state.bankInterestEarned || 0) + credit.interest;
        state.currentMassMonetary -= totalDue;
        credit.status = CREDIT_DONE;
        credit.endDate = new Date();

        const timerId = `${gameStateId}:credit:${creditIdx}`;
        bankTimerManager.stopAndRemoveTimer(timerId).catch(err => log.error(err));

        const event = _makeEvent(SETTLE_CREDIT, playerLifeIdx, BANK, totalDue, [credit]);
        state.events = state.events || [];
        state.events.push(event);

        socket.emitTo(gameStateId + EVENT, EVENT, event);
        socket.emitAckTo(playerLifeIdx.toString(), CREDIT_DONE, { credit });
        socket.emitTo(gameStateId + BANK, CREDIT_DONE, { credit });

        return credit;
    });
};

/**
 * Pay only the interest on a credit, reset/extend the timer.
 */
const payInterest = async (gameStateId, playerLifeIdx, creditIdx) => {
    return inMemoryGameStateManager.withLock(gameStateId, ({ state, rules }) => {
        const credit = _findCredit(state, creditIdx);
        const player = _findPlayer(state, playerLifeIdx);

        if (credit.playerLifeIdx !== playerLifeIdx) throw new Error('Not your credit');
        if (player.coins < credit.interest) throw new Error('Not enough coins to pay interest');

        player.coins -= credit.interest;
        state.currentMassMonetary -= credit.interest;
        state.bankInterestEarned = (state.bankInterestEarned || 0) + credit.interest;
        credit.status = RUNNING_CREDIT;
        credit.extended = (credit.extended || 0) + 1;

        const timerId = `${gameStateId}:credit:${creditIdx}`;
        // Restart the debt timer
        _addDebtTimer(timerId, true, rules.timerCredit, {
            gameStateId,
            playerLifeIdx,
            creditIdx,
        });

        const event = _makeEvent(PAYED_INTEREST, playerLifeIdx, BANK, credit.interest, [credit]);
        state.events = state.events || [];
        state.events.push(event);

        socket.emitTo(gameStateId + EVENT, EVENT, event);
        socket.emitTo(gameStateId + BANK, PAYED_INTEREST, credit);

        return credit;
    });
};

/**
 * Seize coins/cards from a player who is in default.
 * @param {object} seizurePayload - { coins, cards, interest, prisonTime? }
 */
const seizure = async (gameStateId, playerLifeIdx, creditIdx, seizurePayload) => {
    return inMemoryGameStateManager.withLock(gameStateId, ({ state, rules }) => {
        const credit = _findCredit(state, creditIdx);
        const player = _findPlayer(state, playerLifeIdx);

        if (credit.playerLifeIdx !== playerLifeIdx) throw new Error('Not your credit');
        if (credit.status !== DEFAULT_CREDIT) throw new Error('Credit is not in default');

        const { coins: seizedCoins, cards: seizedCards } = seizurePayload;
        const cardsValue = seizedCards.reduce((acc, c) => acc + price, 0);
        const interestSeized = (seizurePayload.interest >= seizedCoins) ? seizurePayload.interest : 0;

        // Remove coins from player
        player.coins -= seizedCoins;
        // Remove seized cards from player
        const seizedCardKeys = new Set(seizedCards.map(c => key));
        player.cards = player.cards.filter(c => !seizedCardKeys.has(key));

        // Put cards back in decks
        decksService.pushCardsInDecksInMemory(state, seizedCards);

        // Update bank stats and monetary mass
        state.currentMassMonetary -= seizedCoins;
        state.bankInterestEarned = (state.bankInterestEarned || 0) + interestSeized;
        state.bankGoodsEarned = (state.bankGoodsEarned || 0) + cardsValue;

        credit.status = CREDIT_DONE;
        credit.endDate = new Date();

        const event = _makeEvent(SEIZURE, playerLifeIdx, BANK, seizedCoins, seizedCards);
        state.events = state.events || [];
        state.events.push(event);

        socket.emitTo(gameStateId + EVENT, EVENT, event);

        let prisoner;
        if (seizurePayload.prisonTime && seizurePayload.prisonTime > 0) {
            player.status = PRISON;
            _addPrisonTimer(playerLifeIdx.toString(), seizurePayload.prisonTime, {
                gameStateId,
                playerLifeIdx,
            });
            prisoner = player;
        }

        socket.emitAckTo(playerLifeIdx.toString(), SEIZURE, { credit, seizure: seizurePayload, prisoner });

        return { credit, seizure: seizurePayload, prisoner };
    });
};

/**
 * Auto-settle all active credits when a player dies.
 * Uses whatever coins/cards the player has left.
 */
const seizureOnDead = async (gameStateId, playerLifeIdx) => {
    return inMemoryGameStateManager.withLock(gameStateId, ({ state }) => {
        const player = _findPlayer(state, playerLifeIdx);
        const activeCredits = (state.credits || []).filter(
            c => playerLifeIdx === playerLifeIdx && status !== CREDIT_DONE
        );
        if (activeCredits.length === 0) return null;

        let remainingCoins = player.coins;
        let cardsValue = player.cards.reduce((acc, c) => acc + price, 0);
        let totalPayedInterest = 0;
        let totalPayedAmount = 0;
        let totalSeizedCardsValue = 0;
        let totalNotPayed = 0;
        let allSeizedCards = [];

        for (const credit of activeCredits) {
            // Pay interest first
            if (remainingCoins >= credit.interest) {
                totalPayedInterest += credit.interest;
                remainingCoins -= credit.interest;
            } else {
                const fromCards = Math.min(cardsValue, credit.interest - remainingCoins);
                totalSeizedCardsValue += fromCards;
                cardsValue -= fromCards;
                totalPayedInterest += remainingCoins + fromCards;
                remainingCoins = 0;
                const remaining = credit.interest - totalPayedInterest;
                totalNotPayed += Math.max(0, remaining);
            }

            // Pay principal
            if (remainingCoins >= credit.amount) {
                totalPayedAmount += credit.amount;
                remainingCoins -= credit.amount;
            } else {
                const fromCards = Math.min(cardsValue, credit.amount - remainingCoins);
                totalSeizedCardsValue += fromCards;
                cardsValue -= fromCards;
                totalPayedAmount += remainingCoins + fromCards;
                remainingCoins = 0;
                const remaining = credit.amount - totalPayedAmount;
                totalNotPayed += Math.max(0, remaining);
            }

            credit.status = CREDIT_DONE;
            credit.endDate = new Date();

            const timerId = `${gameStateId}:credit:${credit.idx}`;
            bankTimerManager.stopAndRemoveTimer(timerId).catch(err => log.error(err));
        }

        // Seize actual cards proportional to value seized
        const sortedCards = [...player.cards].sort((a, b) => b.price - a.price);
        let remaining = totalSeizedCardsValue;
        for (const card of sortedCards) {
            if (remaining <= 0) break;
            allSeizedCards.push(card);
            remaining -= card.price;
        }

        const totalPayedInCoins = totalPayedInterest + totalPayedAmount;
        player.coins -= totalPayedInCoins;
        player.cards = player.cards.filter(c => !allSeizedCards.some(sc => skey === key));

        decksService.pushCardsInDecksInMemory(state, allSeizedCards);

        state.bankInterestEarned = (state.bankInterestEarned || 0) + totalPayedInterest;
        state.bankGoodsEarned = (state.bankGoodsEarned || 0) + allSeizedCards.reduce((a, c) => a + price, 0);
        state.bankMoneyLost = (state.bankMoneyLost || 0) + totalNotPayed;
        state.currentMassMonetary -= totalPayedInCoins;

        const event = _makeEvent(SEIZED_DEAD, playerLifeIdx, BANK, totalPayedInCoins, [{
            interest: totalPayedInterest,
            amount: totalPayedAmount,
            cards: allSeizedCards,
            bankMoneyLost: totalNotPayed,
            bankGoodsEarned: allSeizedCards.reduce((a, c) => a + price, 0),
        }]);
        state.events = state.events || [];
        state.events.push(event);

        socket.emitTo(gameStateId + EVENT, EVENT, event);
        socket.emitTo(gameStateId + BANK, SEIZED_DEAD, event);

        return event;
    });
};

/**
 * Lock down a player in prison.
 */
const lockDownPlayer = async (gameStateId, playerLifeIdx, prisonTime) => {
    return inMemoryGameStateManager.withLock(gameStateId, ({ state }) => {
        const player = _findPlayer(state, playerLifeIdx);
        player.status = PRISON;

        const event = _makeEvent(PRISON, BANK, playerLifeIdx, prisonTime, []);
        state.events = state.events || [];
        state.events.push(event);

        _addPrisonTimer(playerLifeIdx.toString(), prisonTime, {
            gameStateId,
            playerLifeIdx,
        });

        socket.emitTo(gameStateId + EVENT, EVENT, event);

        return { prisoner: player, event };
    });
};

/**
 * Release a player from prison and deal new cards from deck.
 */
const getOut = async (gameStateId, playerLifeIdx) => {
    try {
        await inMemoryGameStateManager.withLock(gameStateId, ({ state }) => {
            const player = _findPlayer(state, playerLifeIdx);
            const shuffledDeck = [...state.decks[0]].sort(() => Math.random() - 0.5);
            const newCards = shuffledDeck.slice(0, 4);
            const newCardKeys = new Set(newCards.map(c => key));

            // Remove drawn cards from deck
            state.decks[0] = state.decks[0].filter(c => !newCardKeys.has(key));

            player.status = ALIVE;
            player.cards = [...player.cards, ...newCards];

            const event = _makeEvent(PRISON_ENDED, MASTER, playerLifeIdx, 0, newCards);
            state.events = state.events || [];
            state.events.push(event);

            socket.emitTo(gameStateId + EVENT, EVENT, event);
            socket.emitAckTo(playerLifeIdx.toString(), PRISON_ENDED, { cards: newCards });
            socket.emitTo(gameStateId + BANK, PRISON_ENDED, { playerLifeIdx, cards: newCards });
        });
    } catch (err) {
        log.error('[bankMemService] getOut error:', err);
    }
};

/**
 * Start all paused credits for a game (called when game starts).
 */
const startCreditsByIdGame = async (gameStateId) => {
    return inMemoryGameStateManager.withLock(gameStateId, ({ state, rules }) => {
        (state.credits || []).forEach(credit => {
            if (credit.status === PAUSED_CREDIT) {
                credit.status = RUNNING_CREDIT;
                credit.startDate = new Date();
                const timerId = `${gameStateId}:credit:${credit.idx}`;
                _addDebtTimer(timerId, true, rules.timerCredit, {
                    gameStateId,
                    playerLifeIdx: credit.playerLifeIdx,
                    creditIdx: credit.idx,
                });
            }
        });
        bankTimerManager.startAllIdGameDebtTimer(gameStateId);
        socket.emitTo(gameStateId + BANK, IO.CREDITS_STARTED);
    });
};

export default {
    createCredit,
    settleCredit,
    payInterest,
    seizure,
    seizureOnDead,
    lockDownPlayer,
    getOut,
    startCreditsByIdGame,
};
