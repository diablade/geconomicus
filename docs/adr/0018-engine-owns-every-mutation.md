# Every state mutation is an engine function taking the queue entry

ADR-0017 established a pure engine layer and claimed the duplication was gone. It was not. The extraction deleted the **simulator's** parallel implementations and left the **services'** untouched, so the two copies still faced each other — and the game and the simulator each ran a different one.

Measurement, not suspicion:

- `EngineHelper.reincarnate`, `createCredit`, `extendCredit`, `faultCredit` and `resolveCreditMaturity` had **zero callers in `back/src`**. Only the simulator used them. The game ran `_reincarnate`, `_createCreditInEntry`, and the maturity decision inlined in `_creditTimeoutCallback`.
- `BankStateService.extendCredit` pushed **two** `CREDIT_EXTENDED` events for one action — one via `_payInterest`, one inline with the opposite emitter/receiver. Two Last-Known samples for one instant, the exact defect ADR-0016 exists to prevent. The timer path pushed one, so the two extend routes disagreed about what an extend records.
- `resolveCreditMaturity` was dead in *both* the game and the simulator, and was missing the [[settlement-call]] branch entirely: it resolved a matured credit as extend-or-fault, with no `canSettle` → `REQUESTING` case. ADR-0017's own statement that `_creditTimeoutCallback` "delegates the decision to `EngineHelper.resolveCreditMaturity`" was never true.

A half-adopted rule is worse than no rule. It reads as adopted.

## Decision

The rule becomes total. **Every body inside `GameStateManager.withQueue` that changes state becomes an engine function taking the queue entry as its first argument.**

The engine owns validation, mutation, and the events it records:

```text
withQueue → Engine.x(entry, …) → stop/start timers → emit sockets
                   ↑
   simulator and unit tests call this directly
```

The engine functions live in `back/src/gameState/engine/`, split to mirror the services that call them — `player.engine.js`, `bank.engine.js`, `action.engine.js`, `decks.engine.js`. A service imports its twin and nothing else. A single 1500-line file was rejected: it would mix credit maturity with card theft, and the pairing with each service is the thing that makes the seam obvious.

`entry` is the whole input. Engine functions read `gameState._id` where they need the id rather than receiving it separately, which keeps every signature the same shape. The simulator already fabricates a synthetic `_id`, and both forms interpolate identically into a credit id.

No pass-through wrappers. `_payInterest`, `_whatCanDoCredit` and `BankStateService.seizureOnDead` were functions whose entire body was a call to the engine; call sites now call the engine.

## What stays out, and why

**Game lifecycle** — `start`, `pause`, `resume`, `stop`, the periodic save. A timer decides *when* something happens and the simulator replaces "when" with rounds, so lifecycle has nothing to offer a headless run. But the **contents** of a tick are rules, not scheduling: the death-queue pop and the DU distribution become engine functions even though their timers do not. `MoneyHelper.distributeNewDU` is split accordingly — it already took `entry`, but emitted sockets from inside a helper, which is the right signature at the wrong layer.

**Pure reads** — `getRate`, `getTargetCards`, `getAvailablePlayers`, `getCurrentPlayerStateIdx` stay in the services. They record no event and mutate nothing, so an engine twin would only ever return a filtered array.

Two sites were misfiled and move despite looking like reads: `whoHaveCard` spends an action token, so it is an action; and `getPlayerState` writes `actionTokens = rules.startingTokens` on a `CREATED` game — a real mutation hidden in a read path.

## Timers run after the engine, and stale callbacks are the engine's problem

The service does its timer work **after** the engine returns, driven by what the engine reports: `endLife` names the credits it resolved, `reincarnate` reports `wasInPrison`, `createCredit` reports `startNow`, auto-seizure reports `prisonMinutes`. Where a timer genuinely must be stopped before the mutation, it is — but that is a local exception, not the shape of the contract.

The ordering was never the real protection. A credit timer that fires just before its credit is settled or cancelled has *already* enqueued its callback; stopping the timer afterwards cannot recall it. The callback then runs against a `DONE` credit and `whatCanDoCredit` throws `ERROR.CREDIT_ALREADY_DONE_OR_CANCELED` — and `_creditTimeoutCallback` is the one timer callback with no `try`/`catch`, so it surfaces as an unhandled rejection.

The fix belongs in the engine, not in a `try`/`catch`: **resolving the maturity of a credit that is no longer running is a no-op, not an error.** A stale callback becomes harmless by construction, in every ordering, and the guard is inherited by the simulator and the tests rather than living in one callback.

## Considered options

- **Preserve service behaviour exactly and rewrite the engine to match.** Rejected: the simulator would inherit the double `CREDIT_EXTENDED`, and the two-branch maturity would have been frozen as correct.
- **Engine returns a declarative effects descriptor** (emits, timer ops) executed by a generic runner. Rejected: socket payloads are irregular — `emitTo` versus `emitAckTo`, four rooms, LK shapes that differ per event — so the descriptor would encode the whole socket API, and "who emits `IO.CREDIT.NEW`" would stop being greppable.
- **Derive socket emits from the pushed events.** Rejected: IO payloads are not DB event payloads. They carry `coinsLK`, bank indicators and ack semantics that the persisted event deliberately does not.
- **One `engine.state.service.js`.** Rejected on size; see above.

## Consequences

- The engine's `resolveCreditMaturity` gains the [[settlement-call]] branch it never had, so the game's maturity decision is finally the engine's rather than a timer callback's.

  **The June calibration is untouched and the debt calibration improved.** Re-running the gate (30 seeds, 14 players) reproduces ADR-0015's June figures exactly — 286 transactions, 67 productions, ratio 4.28, errors 8.1% and 6.5%. Debt now lands at 43 productions and a 4.58 ratio, i.e. **2.7%** and **0.3%** error against 7.9% and 4.5% recorded there, with the fitted animator cap still 1. All four gates pass comfortably.

  The simulator never calls `resolveCreditMaturity` — its agent decides settle / extend / fault itself in `maturityChoice` and calls those three engine functions directly — so the Settlement Call is a branch only the *game's* timer takes and cannot explain the debt movement. The opening-hand fix is provably neutral at the default of 4 (the pre-fix `setup.helper` reproduces the post-fix run byte for byte). **The debt improvement is therefore unattributed**, and should be pinned down before anyone treats the tighter figures as evidence of anything.

  Re-running the gate also exposed an inconsistency inside ADR-0015 itself: its prose claims one animator negotiation per round brings debt to "81% of June's volume", while its own gate table implies 195/286 ≈ 68%, which is what the sweep measures. The prose figure appears to pre-date that ADR's own empty-hand re-fit.
- `EngineHelper.bankIndicators` returned a **flat** object while the services' `_getBankIndicators` returns `{ bankIndicators: {…} }`. The nested form wins — it is the socket contract the front already reads. The flat version had no callers.
- Engine validation throws i18n keys (`ERROR.PLAYER_NOT_FOUND`). Several service copies threw raw English strings (`'Player not found'`, `'Player is not alive or in prison'`), which reached the client untranslated.
- **The opening hand size becomes configurable, having never been.** Both `setupGameJune` and `setupGameDebt` dealt from a hardcoded index list, so `distribInitCards` was a 3-or-4 toggle in the debt game and dead in the June game, which read the recipe size instead. Measured at 14 players over 50 rounds, the setting now moves June from 48 transactions at a hand of 2 to 547 at a hand of 6 — previously every value produced the same 281. Both games now read `distribInitCards`; a hand the level-0 deck cannot supply throws `ERROR.NOT_ENOUGH_CARDS_IN_DECK` at setup rather than dealing `undefined`. `openingCardUnits` loses the same clamp, so a reincarnated Life opens on the terms the table opened on. See the correction in ADR-0015.
- **A seizure-on-death arithmetic bug is fixed.** `credit.interest -= cardsValue` ran *after* `cardsValue = 0`, so it always subtracted zero. When a dying Life's coins **and** cards both fell short of the interest, the cards were taken but never credited against the interest owed, and the full interest was then counted into `totalNotPayed` — inflating `bankMoneyLost` by exactly the value of the cards seized. Present in the shipped game since before the engine existed, and only reachable in that one branch. A regression test pins the corrected total.
- `_findPlayer` and `_seizeCards` existed verbatim in both files with different error strings, and the service copy of `_seizeCards` carried a stray dead `0;` statement.
- ADR-0016 is implemented in the same pass, because `endLife` is being moved regardless and [[seizure-on-death]] in the glossary already described the post-0016 behaviour as fact. The code, not the glossary, was wrong.
- Landing is staged one service at a time — player → decks → action → bank → game ticks — each green before the next, so a regression is bisectable to one service.
- **A caller that reaches past the engine to the helper underneath it gets the mutation without the event.** The simulator did exactly that in two places — `DecksHelper.produce` instead of `DecksEngine.produce`, and `generateDU` with a hand-rolled distribution loop instead of `GameEngine.distributeDU`. State came out right, so nothing failed; the event stream simply had no `production` and no `distrib-du` in it, which is invisible until someone reads the stream. Both now call the engine. The symptom generalises: a missing event type in a run is the signature of a bypassed engine function, and is worth checking before it is explained.
- **A path that skips the lock entirely loses events that were already recorded.** `GameStateService.stop` was the one mutation left outside `withQueue`: it read the entry with a bare `GameStateManager.get`, mutated it, flushed `entry.events`, then dropped the entry from memory with `remove`. Because the periodic flush is a callback on the round timer — killed on `stop`'s first line — the whole tail of the round since the last `timerSaveInterval` (default 20s) rested on that one unlocked flush, and any action completing on a queued `withQueue` after the flush pushed into an array that `remove` then discarded. The symptom was transactions missing from the persisted stream, always the ones nearest the end of a round, with the game state itself perfectly correct — so nothing looked broken until the results page counted them. Now the whole body runs inside `withQueue`, clears `entry.events` after flushing, and only removes the entry once the lock is released. The generalisation: an event is only as durable as the lock held between recording it and flushing it.
- **Re-deriving a shared *value* fails the same way, and quieter.** Three cases, all in the simulator's agent, all invisible because each produced a plausible number:
  - A credit filter written as `status !== 'done'` never matched, because `CREDIT_STATUS.DONE` is `'credit-done'`. Settled credits stayed on the books, so borrowers looked permanently over-indebted and stopped borrowing. Fixing it moved the debt gate from 6.6% to **2.7%** production error and 4.3% to **0.3%** on the transactions-per-production ratio, and flipped the best-fit animator throughput from uncapped to **one credit per round** — which is what was observed in the real session all along.
  - The auto-seizure prison sentence was re-derived from `unpaid / objective` while `applyAutoSeizure` already returned `prisonMinutes` from `computeAutoSeizurePrisonMinutes`.
  - `CREDIT_ORIGIN.PLAYER ?? 'player'` — the constant is `PLAYER_REQUEST`, so every self-service credit carried an origin the game never emits. The `??` fallback is what hid it; a bare `CREDIT_ORIGIN.PLAYER` would have been `undefined` and noticed.

  Wealth, outstanding obligation and solvency now come from `bank.helper`, and what a borrower *can* do at maturity from `BankEngine.whatCanDoCredit`. The agent keeps only the preference between the options it is offered — which is the part a real player supplies.
