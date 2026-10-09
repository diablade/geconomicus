# Production Reveal: in-place held-state celebration, replacing the broken Congrats dialog

When a square is built, the player now sees a **Production Reveal**: the same square-zone box the player was already looking at holds its position and swaps its ingredients-and-button content for the new leveled-up card, a rotating sunburst (scaled to the box, not the screen), confetti (via the new `canvas-confetti` dependency), and "built"/"cards redrawn" text, for a fixed ~2.5s auto-dismiss, then resolves to the new hand. This replaces `CongratsDialogComponent`, which was dead/broken: it read `data.card`/`data.typeTheme` while every caller passed `data.producedCard`/`data.theme`, sized its wheel at a literal `230vh`, and imported `Card` from the legacy `models/game.ts`. Debugging also surfaced a second, unrelated bug in the same code path: `PlayerStateService.produce()`'s response handler read `result.producedCard`/`result.cardsLK` off the top-level REST response, but the backend actually nests everything under `result.result` — so `cardsSubject.next(undefined)` ran on every production, which is why nothing updated until a refresh. Both are fixed together here.

## Considered options

- **Patch `CongratsDialogComponent` in place** (fix the prop names, shrink the wheel). Rejected: it's a full-screen MatDialog, which doesn't match the target design (title bar and action buttons stay visible/interactive in the target screenshot), and it's still pinned to the legacy `models/game.ts` Card shape other live code has moved off of.
- **Snapshot the pre-production group locally and apply the real `cardsLK` immediately.** Rejected in favor of simply delaying `cardsSubject.next(cardsLK)` until the ~2.5s reveal completes: producing a square has no side effects on any other part of the board, so there's nothing lost by holding the state, and it avoids keeping a second, parallel copy of "what the grid looked like before" in sync.
- **Full-screen overlay**, matching the existing Reincarnate/Fault Lockout pattern. Rejected: the target design keeps the title bar and action buttons visible and clickable — Production Reveal is a new, third overlay category (card-area-scoped) alongside those two full-screen ones and the tap-to-dismiss Seizure Confirmation.
- **CSS-only confetti** (a fixed set of animated divs, matching how every other effect in this component is built). Rejected in favor of adding `canvas-confetti` (~5KB, no dependencies) for a better burst than hand-rolled CSS pieces would give.
- **Input-blocking overlay** over the rest of the card-area while celebrating. Rejected: this is a purely celebratory, non-critical moment — other complete-but-unbuilt squares and cards stay fully clickable underneath a visual dim, nothing is actually disabled.
- **Special-case text/flow for the top-tier (Technology) production**, mirroring the old dialog's `weight > 2` branch and its "end of game" copy. Rejected: the "technology shift" endgame isn't a real, designed feature yet — production is treated as endless/circular for now. Every square build gets the identical reveal; no `producedCard.weight` branching, no game-over hook.

## Consequences

- New dependency: `canvas-confetti`.
- `CongratsDialogComponent` and its call site are deleted; `models/game.ts` stays (still used by `deprecated-back.service.ts`, `results.component.ts`, `master-admin.component.ts`, `events.component.ts`) but Production Reveal never touches it.
- `PlayerStateService.produce()` no longer opens UI directly — it exposes an observable (following the `firstCreditQuestion$`/`rate$` pattern) that `player-board` subscribes to, so the service stays UI-agnostic.
- If a player has more than one square complete at once, only the one they clicked "build" on celebrates; the others are unaffected.
- Reuses the existing `gotitem.mp3` sound.
