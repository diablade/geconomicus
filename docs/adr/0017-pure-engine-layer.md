# The game engine is a pure layer; services own the queue, sockets and timers

The simulator of ADR-0015 reused the game's pure helpers — deck generation, `produce`, `generateDU`, `computeAutoSeizureForCredit` — and reimplemented everything else: buying, death and reincarnation, the credit lifecycle, seizure, prison. Not by choice. Those behaviours lived inside `player.state.service.js` and `bank.state.service.js`, wrapped in `GameStateManager.withQueue`, interleaved with `socket.emitTo` calls and timer-manager bookkeeping. Importing either module offline pulls in the socket singleton and four timer managers.

The duplication behaved exactly as duplication does. The simulator seized at face value while the game applied a 33% decote. The simulator cleared a dead player's hand while the game deliberately keeps it as a frozen snapshot. Each divergence was found by accident, late, and only because someone went to read the real code.

> **Correction (ADR-0019).** The cleared hand is now the simulator's one *deliberate* divergence, restored on purpose. The game keeps the snapshot because the final score is read off it, and clones the cards into the decks; the simulator scores nothing, so leaving the snapshot in place would make every death double the cards it touched. It calls `PlayerEngine.reincarnate` and then empties the hand itself — the engine's behaviour is untouched, and the conservation audit counts every hand rather than only living ones.

## Decision

Behaviours that mutate game state move into `helpers/engine.helper.js` as pure functions of the shape `(gameState, rules, events, …)`. They mutate the state they are given, push events onto the array they are given, and return what the caller needs. They import only other pure helpers.

Services keep everything else, and become thin:

```text
withQueue → EngineHelper.x(gameState, rules, events, …) → emit sockets → start/stop timers
                        ↑
        simulator and unit tests call this directly
```

Timers are deliberately *not* extracted. A timer decides **when** something happens; the simulator replaces "when" with rounds. What needed extracting was what the timer callbacks **do** — so `_creditTimeoutCallback` keeps its timer plumbing and delegates the decision to `EngineHelper.resolveCreditMaturity`.

> **Correction (ADR-0018).** That last clause was never true. `_creditTimeoutCallback` kept the maturity decision inlined and `resolveCreditMaturity` had zero callers in the game *or* the simulator — it was also missing the [[settlement-call]] branch entirely. ADR-0018 makes the sentence true.

Extracted: `applyTransaction`, `endLife`, `reincarnate`, `seizureOnDead`, `createCredit`, `settleCredit`, `payInterest`, `extendCredit`, `faultCredit`, `resolveCreditMaturity`, `applyAutoSeizure`, `releaseFromPrison`, `whatCanDoCredit`, `openingCardUnits`, `priceOfCard`.

The simulator's parallel implementations are deleted. It now runs the shipped code path and keeps only what is genuinely its own: the round model, the agent's decisions, the metrics, and the action log.

> **Correction (ADR-0018).** Only half of this held. The simulator's copies went, but the *services* were never switched over — `reincarnate`, `createCredit`, `extendCredit` and `faultCredit` stayed sim-only while the game kept running `_reincarnate`, `_createCreditInEntry` and its own inlined credit logic. The two implementations still faced each other; they had merely swapped which side was the stranger.

Two constraints follow from `EventHelper`. Events are built through `LkBuilder` and validated by `LkGuard`, which throws without a `sessionId` and a `gameStateId` — so the simulator's `gameState` carries synthetic ones. And because the engine appends to a plain array, the simulator gets the real event stream for free, in memory, and returns it to the front.

## The bug this exposed

`DecksHelper.produce` removed the cards from the hand, returned them to the deck, spliced out the replacements, and only then checked whether the draw had succeeded. On failure the spliced cards were in no hand and no deck. A conservation audit over decks plus living hands measured the cost: **zero cards lost when nothing throws, and exactly `amountCardsForProd` lost per throw** — 176 cards, 46% of the deck, in a single 200-round run.

The check now runs before any mutation. The same ordering bug existed in the simulator's `produceAboveCeiling` and is fixed there too. `tools/sim/conservation.mjs` is the regression test: minted equals decks plus living hands, in every scenario, including both tech-shift ratios.

## Consequences

Every future behaviour change lands in one place and is inherited by the game, the simulator and the unit tests together. A divergence now requires someone to deliberately write a second implementation.

`ADR-0016` remains unimplemented: `endLife` still emits `credit-seized-dead` alongside `player-died`. The extraction preserved existing behaviour rather than smuggling in that decision, and it is now a single-function change when the time comes.
