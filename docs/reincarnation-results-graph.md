# Reincarnation in the v2 results graph — spec for a later session

> **Status: superseded by [ADR-0012](./adr/0012-results-data-contract.md) and [ADR-0014](./adr/0014-avatar-score-counts-every-life.md).** Kept for the reasoning behind one-series-per-life and per-avatar colouring, which both survive unchanged. The data-source assumptions below have now been verified against the code and several were wrong: the LK fields were a wish list, not a fact, and reconstruction from the event stream has been dropped in favour of reading gameState for end-state numbers. Read the ADRs first.

## Non-negotiables

- **Do not touch** `front/src/app/results/results.component.ts` — that is the **legacy** results view. Its `mergedReincarnatePlayers` / `reincarnateFromId` logic belongs to the old data model and stays as-is.
- The v2 path is `front/src/app/services/session-results.service.ts` (currently has **no** reincarnation handling).

## Representation

- **Each life is its own series** (same as v1), one series per `playerStateIdx`.
- **All lives of one avatar share the same color**, keyed by `avatarIdx`. So the graph reads as "this player, across their lives" while still showing each life separately with the death as a visible break between series.

## Data source

- The money curve is built from **DB events**, using each event's **`coinsLK`** (last-known coins) value plotted over time, per life.
- `PLAYER_DIED` now carries **`coinsLK`** = the dead life's post-seizure leftover coins (which is that life's **ghost money**). This is the final point of the dying life's series.
- `PLAYER_BIRTH` marks the start of the new life (coins = 0).

⚠️ **To verify next session:** confirm *which* DB event payloads actually persist a `coinsLK` field (several socket payloads carry `coinsLK`, but the stored event payload shape may differ — e.g. `DISTRIB_DU` stores the DU number, `TRANSACTION` stores cost/card). Map out the full set of events that move a player's coins and ensure each persists enough to reconstruct `coinsLK`, or reconstruct it cumulatively while walking the event stream.

## Ghost money

- Ghost money is **derived**: `Σ coins of all DEAD lives`. No stored accumulator field.
- Per-death amount is available directly from `PLAYER_DIED.coinsLK`, so a **cumulative ghost-money line** can be plotted from the event stream.
- **Tracked per session for comparison across games.** In the **June** game, value ghost money in **last-DU-equivalent** (`ghostCoins ÷ final DU`) since June money is only meaningful relative to the DU. In the **debt** game, compare in raw coins (ghost money = coins a dead player held beyond their credit obligations).

## Related

- Domain terms: [CONTEXT.md](../CONTEXT.md) → *Life (Incarnation)*, *Reincarnate*, *Ghost Money*, *Death Queue*.
- Decision record: [docs/adr/0002-reincarnation-as-appended-lives.md](./adr/0002-reincarnation-as-appended-lives.md).
