# The Table is the omniscient observer; state travels as absolute Last-Known snapshots

The animator's **Table** view (`table-board`) is meant to show the whole game at a glance — every player's coins, cards, tokens, credits, plus the decks — but it only ever heard a subset of what changed. Peer transactions, the five player Actions (give/steal/silentSteal/war/ong), DU distribution, production, prison release, and death-seizure all mutate player state without ever reaching the Table, so its rows silently drifted from truth and a wall of manual `applyPlayerCoinsDelta` patches had grown up in `GameStateService` to paper over the bank-action cases. The decision: make the Table an **omniscient observer** fed by absolute **Last-Known (LK)** snapshots, keep the Master view deliberately minimal, and delete the manual patching.

## Room topology (layered, not a single firehose)

The old `bank` **room** is renamed to the `table` room (`gs:{id}:table`); `PLAYER_TYPE.TABLE` is added and the literal `'bank'` guards in `socket.js` flip to `'table'`. The `PLAYER_TYPE.BANK` **actor** tag is untouched — it still records that the Bank issued DU/credit. Only the room dies, not the economic actor.

The Table board joins **three** rooms — `gameState` (lifecycle/timer), `master` (connection + death/reincarnation), and `table` (everything economic) — and every event is emitted to **exactly one** of them (no dual-emit). The Master board joins only `gameState` + `master` and is never fed the economic detail. `GAME.DELETED` already reaches both boards via the `session` room (their `publicChannel`), so Master just needs the handler registered (it moves out of the bank-only listener); the redundant `gameStateBank` delete-emit is removed.

## The LK model: two sibling sync channels, absolute not delta

Every state-changing operation broadcasts the **affected entities' current absolute state** to the `table` room; the Table replaces, never computes:

- `PLAYER_STATE_SYNC` → `{ players: [{ idx, coinsLK, cardsLK, actionTokens }] }` — only the concerned players (2 for a transaction, the batch for DU).
- `DECKS_STATE_SYNC` → `{ decks: [{ level, cards }] }` — only the deck levels that changed, each as its full current array.

**Ownership split:** the sync events own player rows and deck contents; the aggregate indicators (`currentMassMonetary` and the bank indicators) ride the domain events that move them — credit events (which already carry `bankIndicators`), DU (`CURRENT_DU` gains `currentMassMonetary`), and death. Each datum has exactly one writer, so nothing double-counts even though several events can fire for one operation.

**Death** enriches its existing `PLAYER.DIED` payload with `coinsLK`/`cardsLK`/mass (the data is already assembled for the DB event) so a terminal death stays correct; a first death is then overwritten harmlessly by the reincarnation re-pull moments later. **Reincarnation keeps its full re-pull** — it appends a new life and shrinks the death queue, which is not a row-level delta.

**Reconnect:** observer-room events have no ack/redelivery, so the Table re-pulls once (`refreshMasterState`) on reconnect to reset its baseline — the only self-heal for a sub-10s blip that dropped a sync.

## Considered options

- **(B) A single self-sufficient `table` room** carrying literally everything, so the board joins only `gameState` + `table`. Rejected: it forces death/connection/reincarnation to be **dual-emitted** to both `master` and `table`, touching every one of those emit sites, for a marginally cleaner mental model. The layered design keeps each event in one room and matches "Master receives only connection + delete + death/rebirth."
- **Deltas instead of absolute LK** (`coinsDelta`, `cardsReturn`/`cardsDraw`). Rejected for both players and decks: observer-room events are unacked, so a single dropped or duplicated delta corrupts a balance or a deck **permanently**. Absolute snapshots self-heal on the next touch and on reconnect re-pull. The `LK` (last-known) naming already commits to this.
- **Per-operation enriched events** — dual-emit an enriched `TRANSACTION_DONE`/`ACTION_DONE`/etc. to the Table. Rejected: it smears player-row updates across a dozen handlers. One generic `PLAYER_STATE_SYNC` is a single write path; the dedicated credit events survive only where they drive distinct UI (the fault siren, credit-status transitions).
- **Re-pull on every death** instead of enriching `DIED`. Rejected: a full GET on a hot path that double-fetches on first death, and it contradicts the LK-no-refresh direction. Enriching `DIED` is nearly free.
- **Decks refresh-on-re-pull only** (no live deck sync). Considered and upgraded on request to live `DECKS_STATE_SYNC` — animators want to watch the supply evolve — but kept minimal by shipping only changed levels.
- **Live-syncing the full `gameState.decks` on every production.** Rejected: production is the highest-frequency event; shipping all decks each time is wasteful. Only the touched levels are sent (a level is ≤20 cards but for rare ~100-card decks it is still a few KB on an animator-only room).

## Consequences

- `applyPlayerCoinsDelta` and the RPC-response coin patching in `createCredit`/`giveFreeMoney`/`seizureOnCredit`/`creditForAll` are **deleted** — the Table updates purely from the socket echo (`emitTo` includes the initiating socket, so the animator's own board updates too).
- New emit sites for `PLAYER_STATE_SYNC`: transaction, all five actions, DU (batched, all alive), production, prison release, credit issue/free-money/seizure (the affected borrower/target). New `DECKS_STATE_SYNC` sites: production, death-seizure, prison release, reincarnation draw — wherever `gameState.decks` moves.
- Player-facing events are **unchanged** — `TRANSACTION_DONE`, `ACTION_DONE/ROBBED`, per-player `DISTRIB_DU`, production's RPC result still drive the player's own device and animations. The sync events are Table-only, emitted in addition.
- The `results` and `events` rooms are untouched.
- Avatar changes on the Table stop doing `window.location.reload()` — the `AVATAR.UPDATED` payload already carries the full `updatedAvatar`, so the row is patched in place like `SessionService` already does.
