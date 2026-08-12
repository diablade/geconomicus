# A Life's death carries its own seizure, and the event type splits by effect

Under ADR-0012, `EVENT_LK_CONTRACT` declares per event type which Last-Known pieces the builder pulls off the gameState. `_endLife` emitted two events back-to-back for one instant in one Life: `credit-seized-dead` (declaring the money mass and all four bank counters) and `player-died` (declaring the per-Life snapshot and the alive count).

The decision: **delete `credit-seized-dead`.** A Life's end emits exactly one event — `player-died` when nothing was seized, `player-died-with-seizure` when something was, the latter additionally declaring the mass and the four bank counters that only a real claw-back moves. The seizure's detail rides the payload for the events log. `BankStateService.seizureOnDead` stops emitting and returns its totals; `_endLife` becomes the single owner of the death event and of the choice between the two types.

Two events for one moment wrote two LK samples for the same Life at the same timestamp — a redundant curve vertex, and two rows that could disagree about one state.

## The split is keyed on effect, not game type

`player-died-with-seizure` is emitted iff `totalCoinSeized || totalSeizedCardsValue || totalNotPayed`, which covers all five aggregates: `bankInterestEarned` and `bankMoneyDestroyed` are components of the coins seized, `bankGoodsEarned` *is* the seized card value, `bankMoneyLost` *is* the unpaid remainder, and the mass moves by the coins seized.

Keying on the game type would have been wrong on its own terms. A debt Life that owes nothing when it dies moves no aggregate, so it must emit the plain event — exactly as a June Life does, and for the same reason rather than by a `typeMoney` branch. No reader anywhere has to know which game it is looking at.

## Considered options

- **One `player-died` declaring the union of pieces.** Rejected: every June death — and every debt death without credits — would persist four bank readings of `0`, indistinguishable from "the bank lost nothing" when the truth is "there is no bank", plus a money-mass vertex where the mass did not move. That contradicts the contract's own rule that an indicator is declared only on the events that actually move it.
- **Make the contract game-type aware** — entries become `{ [GAME_TYPE]: pieces }`, resolved from `gameState.typeMoney` in both `LkBuilder` and `LkGuard`. Rejected: machinery for a single event, and it keys on the wrong axis. What varies is whether a seizure happened, not which game it happened in.
- **Keep both events and accept the duplicate sample.** Rejected: `player-died` is the last point of a Life's curve, and a second sample at the same instant makes "the last point" ambiguous.

## Consequences

- `EVENT_GROUP` becomes **many-to-many**. `player-died-with-seizure` belongs to both `death` and `seizure`, because an animator filtering on either expects to find it, so filtering tests membership rather than equality. Groups are therefore a display taxonomy only: every tally, count and series keys on `typeEvent`, since reading the first of an event's groups would make the answer depend on declaration order.
- `seizures` becomes a pure type count — `credit-seizure` + `player-died-with-seizure` — with no payload inspection. This also forces a latent fix: `credit-seizure` was never in the front's `GROUP_BY_TYPE` at all, so live seizures fell through to `system` and the seizure filter showed nothing but dead-seizures.
- Anything meaning "a Life ended" must now match **both** types. A shared set is the only safe form; a bare `=== PLAYER_DIED` is the predictable regression.
- `seizureOnDead` loses its `events` parameter, and with it the last place where two rows could describe one moment.
- Both types are still emitted after the claw-back and after the cards return to the decks, so either one carries the Life's final frozen state — which is what lets `player-died*` mean the same thing in both game types and serve as the uniform terminator of a Life's curve.
