# The technological shift is triggered by the first good at the top level

The shift is a proposal, simulated in `back/tools/sim/techshift.mjs` and not implemented in the game. It answers what happens when play reaches level 3, where the shipped game throws `Technological change not yet implemented`.

The first attempt read the trigger as "someone produces *at* the top level" — a complete recipe of level-3 cards, exchanged for a level-4 card that does not exist yet. That reading is wrong twice over. It asks a player to assemble `amountCardsForProd` distinct copies of one letter at the most expensive level in the game, which at 14 players and a square recipe never happened in 100 rounds across 12 seeds. And it puts the shift *after* the wall rather than *instead of* it: the production that fires the shift is the one that cannot complete.

## Decision

**A production whose output lands on the current top level triggers the shift**, for the whole table, the moment it completes. Level 2 → level 3 fires the first shift; once level 4 is open, level 3 → level 4 fires the second.

One good at the frontier proves the technology. It does not take a warehouse of them.

The production completes first, then the shift fires. Everything the moment does — mint the new level, slide the ladder, retire what just became free — is one event, `tech-shift`, carrying the deck sizes before and after so a front can animate the cards moving.

The trigger is self-limiting: firing raises the top level, so the same production no longer qualifies. Six card colours cap it at two shifts, after which reaching for a level above the top is the wall again.

## What it costs

`nextPriceLadder` is the whole economics: `[0, ...ladder]`. `1/2/4/8` becomes `0/1/2/4/8`, then `0/0/1/2/4/8`. Every card in every deck and every hand is re-stamped, because price is carried on the card.

The level whose price *just* fell to zero is retired: those cards leave the hand and go back to their own deck, and the player draws replacements one level up at 1:1 or 2:1. Only the newly-free level — a later shift must not confiscate the same cards twice. Where the deck above is short, the player gets fewer replacements and the exchange log says so.

Measured at 14 players, 2:1, seed 1: deck 0 goes 26 → 95 as eleven players hand back 69 cards, and deck 1 goes 25 → 0 covering 25 of the 34 replacements owed. The conversion drains the level above before it satisfies everyone, which is the mechanic working, not failing — but it means the 1:1 / 2:1 choice only bites while deck 1 still has stock.

## When it arrives

Rounds to the first shift, median of 5 seeds, 200-round runs:

| players | triangle (3) | square (4) | quinte (5) |
|---|---|---|---|
| 6 | 16 | 41 | never |
| 14 | 31 | 73 | never |
| 24 | 37 | 108 | never |

The recipe shape decides whether the shift is an endgame or the whole game. A triangle brings it inside a normal session at every table size. A square puts it past a 50-round game at 14 players and beyond reach at 24. A quinte never gets production past level 1 — the shift is not late there, it is unreachable.

`techShiftFloorRound` defaults to 25, and a run that never shifts now reports the highest level any production reached, so "never happened" separates a table that ran out of rounds climbing from one that stalled at the bottom.

## Consequences

The mechanic stays in `tools/sim`. `tech-shift` is declared there rather than in shared `DB_EVENTS`, because a type earns its place in the shipped vocabulary when it ships; `LkGuard` has no contract for an unknown type, so the event rides the real stream unvalidated but intact.

If the shift is built, the trigger belongs in the engine beside `DecksEngine.produce`, and `produceAboveCeiling` — the simulator's copy of `produce` minus its level-3 guard — disappears into it.
