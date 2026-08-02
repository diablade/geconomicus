# Results reads two sources by role, and events take their Last-Known data from a declarative contract

The v2 results page (`results/:sessionId`) computed everything by folding the raw event stream, using stored Last-Known values "when present and falling back to reconstruction when absent". In practice nothing was present: the `LkSnapshot` interface was a wish list guarded by a `TODO(back)`, the few places the backend did write LK used different names (`coinsLK` / `currentMassMonetary` against the front's `emitterCoinsLK` / `massMonetaryLK`), and the fallback silently produced confident wrong numbers — second lives were dropped entirely, production and seizure pushed zero deltas, and `CREDIT_SEIZURE` / `PLAYER_BIRTH` attributed a player's values to the Bank or the animator because their `emitter`/`receiver` orientation is inverted relative to `PLAYER_DIED`.

The decision: give the two data sources **distinct roles**, and make the LK contract a **producer rather than a validator** — a declarative table saying what each event must *take* from the gameState, which `EventHelper.createEvent` then extracts on its behalf. The fold goes away.

## Source roles

- **gameState** (both games fetched alongside the session) is authoritative for every end-state number: each Life's final coins and cards, its status, and therefore the podium, the Gini and Ghost Money. It is also the registry of Lives — `playersStates[]` carries `{ idx, avatarIdx, status }`, which is the only reliable way to know that a reincarnated life exists, since `playerStateIndexSeq` starts above `avatarIndexSeq` and reincarnated lives have an `idx` no avatar shares.
- **The persisted event stream** supplies only what varies over time: the curves.
- **The survey answers** supply the feelings radar, and arrive late — a player may still be filling their survey after the session is closed, so the radar rebuilds on `IO.SESSION.NEW_FEEDBACK` rather than snapshotting at load.

A gap in the event stream can therefore distort a curve but can never corrupt a headline figure. Because the two sources can disagree, the page carries a permanent **Data Health Block** comparing each indicator's last sample and each Life's last curve point against the authoritative values, by exact integer equality.

## The contract produces, it does not merely check

`EVENT_LK_CONTRACT` (in `shared/constants.ts`) maps each event type to the list of LK **pieces** it carries. `LkBuilder` holds one extractor per piece, and `EventHelper.createEvent(typeEvent, gameState, { emitter, receiver, touched, payload })` runs the declared extractors against the live gameState and merges the result under the domain payload.

The consequence that motivated this shape: **adding an indicator later is a one-line declaration**. Under the earlier design — call sites hand-building payloads, a guard rejecting whatever was missing — a new indicator meant re-auditing and editing every concerned call site, and there are 34 of them. Now the call sites say only *who* was involved; the contract says *what* to capture.

Per-life LK is keyed by `playerStateIdx` (`playersLK: { "3": { coins, cardsValue, debt } }`), mirroring the shape `PLAYER_STATE_SYNC` already uses on the `table` room per ADR-0008, so the stored stream and the live stream finally agree. `emitter` and `receiver` survive as **role pointers only** and carry no values. `sessionId` and `gameStateId` are derived from the gameState and can no longer be passed at all.

Which lives an event touched defaults to `emitter` + `receiver` whenever those name real lives — true for 18 of 21 events. Only `action-war`, `action-ong` and `action-association` pass `touched` explicitly, because all three set both role pointers to the actor and their targets are genuinely extra information.

Aggregate indicators are declared only on their **concerned events** — the ones that actually move them. A transaction moves coins between players without changing the money mass, so sampling the mass there would add a vertex carrying no information. Every indicator is a step function and is rendered stepped, never interpolated.

## Considered options

- **Stamp every event with a full indicators block.** Rejected: it writes redundant numbers on every row, and the sparse form yields exactly the step function's true vertices. The usual objection — that sparse sampling makes a later indicator expensive — does not apply here, because the contract is a producer: adding a piece to an event's list makes every subsequent emission carry it with no call-site work.
- **A validating guard with call sites supplying the payload.** Built first, then replaced. It correctly found every gap, but it puts the work in the wrong place: 34 call sites each had to know which LK belonged to them, and any future indicator meant touching all of them again. The guard is kept, demoted to a safety net.
- **Deriving the touched set by diffing gameState around each mutation.** Rejected: it needs a wrapper on every `withQueue` mutation, costs a copy per mutation, and captures incidental changes (a status flip, a token decrement) as though they were the event's subject.
- **Keep the fold as a documented fallback**, or **backfill LK by replaying stored streams**. Both rejected: nothing is in production yet, so there is no historical data to protect, and a fallback that renders plausible wrong numbers is what hid every defect listed above.
- **Elapsed-time x-axis** so the two games align. Rejected: the page compares them as two columns rather than overlaid, and wall-clock keeps every point traceable to a row in the events log.

## Consequences

- **The backend half of this decision is implemented; the front half is not.** `SessionResultsService` still folds, still reads the retired side-keyed names (`emitterCoinsLK`, `receiverCardsValueLK`), and `geco-event.ts` still declares the `LkSnapshot` interface with its `TODO(back)` describing the design this ADR replaces. Both must go: `FoldState`, the `startAmountCoins` / `firstDU` seed parameters, and `LkSnapshot` are superseded by `playersLK` and the pieces the contract now produces. Until that lands the results page reads nothing the backend writes.
- `EventHelper.createEvent` changed signature; all 34 call sites are migrated. `EventService.postNow` keeps the old positional form for the exempt lifecycle events; `PLAYER_INIT` and `FIRST_DU` build through `createEvent` and save via `postMany`.
- The guard (`LkGuard`) still throws when a built event lacks a declared piece or its identity. It now catches a class of bug the producer cannot fix on its own: `gameState.bankInterestEarned += interest` on an uninitialised field yields `NaN`, which is neither missing nor valid. Two existing test fixtures were silently doing this.
- Enforcement is immediate rather than phased. `back/__test__/event-lk-contract.test.js` keeps the table exhaustive against `DB_EVENTS`; `back/__test__/event-lk-emission.test.js` invokes every emitting service for real, so an event cannot pass by never being exercised — a blind spot `bank.state.service.test.js` still has, since it mocks `event.helper.js` outright.
- Deriving identity from the gameState fixed a separate defect the guard uncovered: `CREDIT_NEW`, `FREE_MONEY`, `CREDIT_CANCELED`, `CREDIT_SETTLED` and `CREDIT_EXTENDED` were built from `entry.sessionId` / `entry.gameStateId`, fields the `GameStateManager` entry (`{ gameState, rules, events }`) has never carried, and `CREDIT_EXTENDED` additionally read `gameState.id` instead of `_id`. All were persisted with `undefined` identifiers, making the entire debt-game credit history unreachable by `getBySessionId` and invisible to the results filter.
- Activity counts and `mostActive` aggregate per **Avatar**, not per `playerStateIdx`, or a reincarnated player's activity splits in two. See ADR-0014.
