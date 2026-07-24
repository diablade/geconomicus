# Reincarnation in the v2 results graph — spec for a later session

> **Status: deferred.** The reincarnation *mechanic* (kill → new life → snapshot → redirect → death queue → ghost money) is built in the current pass. This document captures how the v2 results graph should later *read* that data. Nothing here is built yet — it exists so the next session can pick it up without re-deriving the design. **Verify the data-source assumptions below against the code before implementing.**

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
