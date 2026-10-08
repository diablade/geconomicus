# Deck sizing is answered by a round-based offline simulator, calibrated against a real session

`DecksHelper.generateDecks` sizes every game from one unexplained constant — `lettersInGame = Math.round(1.25 * players)` — and nothing in the repo records why 1.25, or what a good deck is for a given table size. Measurement shows the constant is not merely unjustified but wrong at both ends: the quality curve it produces is non-monotonic, and above 41 players it silently corrupts the deck.

The decision: answer the question with an **offline simulator** that sweeps configurations and emits a per-player-count table, rather than replacing one guess with another. The formula change is deliberately downstream of the evidence, not bundled with it.

## What was measured first

Two probes, before any design:

- **The opening is not always winnable.** A player needs `amountCardsForProd` distinct copies of one letter, and deck cards are unreachable until someone produces — so at t=0 only cards in hands can be pooled. Assuming perfect cooperation and free money, the share of games where *any* letter is completable at all is **60.4% at 3 players**, **87.6% at 4**, 97.8% at 5, and **96.8% at 6** — non-monotonic, because `round(1.25 × p)` steps unevenly. The residual is a table that cannot produce at all. `autoDeath` is the only escape, since [[reincarnate]] is what recirculates deck cards into hands; a practice game with it off makes the deadlock permanent.
- **The alphabet runs out at 42 players.** The `letters` array holds 52 entries. `letterIndex` runs to `round(1.25 × p)`, so from 42 players `letters[i]` is `undefined` and `_generateOneCard` builds the literal key `"undefined01"`. Every overflow letter collapses onto the same keys — 305 duplicates per level at 90 players. `produce` filters the hand by key, so exchanging one such card discards every copy of it; `_areCardIdsUnique` then refuses production outright; `whoHaveCard` answers with whichever player it finds first. Sessions above 41 players are corrupting today, quietly.

## Two tiers, because fidelity and coverage conflict

The sweep is ~816,000 runs. Driving that through the real services against `mongodb-memory-server` is between hours and weeks, so:

- A **fast model** runs the sweep in-process, reusing the genuinely pure helpers (`DecksHelper`, `setup.helper`) and reimplementing only the coin arithmetic, credit lifecycle and death loop.
- A **full-stack oracle** — real services, real mongo, real timer managers — runs a sampled subset and asserts the fast model agrees.

This deliberately reintroduces the thing ADR-0012 condemns, a second implementation of rules that already exist, and is only defensible because the oracle is wired to it as a test. What made the retired results fold dangerous was not that it recomputed — it was that nothing ever checked it. Statistical comparison was rejected because the effects being measured (a 12% deadlock rate) sit near the noise floor, so the check must be exact: one seed, one byte-identical game.

Seeding that is not as simple as replacing `Math.random`. **Lodash captures `Math.random` into a private `nativeRandom` at module-load time**, so assigning to `Math.random` afterwards never reaches `_.shuffle` — which is where `DecksHelper` does all of its shuffling. The first build was silently non-deterministic in exactly the place that mattered, and its calibration numbers were noise. What works is a **swappable dispatcher**: `Math.random` is replaced once, before lodash is ever evaluated, with a function that delegates to the current generator; reseeding swaps the generator behind it. Because that depends on module evaluation order, which is invisible and easy to break by reordering an import, `assertLodashObeysSeed` shuffles a probe array twice under one seed and throws if the results differ. A silent failure becomes a loud one, in the same spirit as `LkGuard`.

## Time is rounds, not timers

The simulator has no clock. Each round every player takes one action, and **an action costs a round if and only if it needs another person's cooperation** — buying and searching for a holder do; producing, selling, settling, paying interest and dying do not. Creating a credit does, because it is a negotiation; settling does not, because it is unilateral.

Calibrated against a real session (14 players, June, 25 minutes, 62 productions, 284 transactions): **2 rounds per minute**, so 50 rounds is a session and credit at 10 rounds is exactly the `durationCredit: 5` default. That yields ~49% utilisation — players idle roughly half the time, searching — which is why idling is modelled explicitly rather than assumed away. A round-per-minute model would have implied 99% utilisation, which no room full of people achieves.

Two horizons are run because death scheduling cannot serve both: a **session run** of 50 rounds with deaths spread across it, which produces the table rows, and an **endurance run** of 200 rounds, which finds deck exhaustion and whether the technological shift is reachable at all.

## The gates

Nothing from the sweep is trusted until the model reproduces the real session. Because the round model fixes tempo, **no parameter is fitted** — both observed figures are free outputs:

1. **4.58 transactions per production**, ±25%. Normalised away from player count and tempo, so it isolates the agent model alone.
2. **Debt slower than June**, emergent. Debt tempo is never calibrated; if money scarcity does not produce it unaided, the money model is wrong.
3. **Fast model equals oracle**, exactly, per seed.

## What calibration actually required

Two frictions had to be modelled that the design did not anticipate, and both are physical rather than cosmetic.

**Encounter-limited purchasing.** With agents surveying every hand, utilisation ran at 90% against an observed 40.6% and the ratio collapsed to 2.94. Perfect information is the wrong model of a room: you approach someone, and either they hold what you need or they do not. Restricting each round to a sample of other players — the "looking for a holder" idle — reproduces both. At one encounter per round the model overshoots the other way (13.5% utilisation, ratio 6.49), which brackets the answer; the fitted value is **3.25 encounters per round**.

**The animator is a bottleneck.** Money is genuinely scarce in the simulated debt game (6.35 coins per player against June's 54.21), yet transaction counts matched June anyway, because June prices scale with the DU while debt prices stay absolute — purchasing power converges. What actually slows the real debt game is that `autoBank` defaults to **false**, so every credit is a walk to the animator and a queue. Modelling one negotiation per round table-wide brings debt to 81% of June's volume against an observed 71%. This carries a design consequence worth stating plainly: **turning `autoBank` on removes the bottleneck**, and the debt game would run at roughly June's tempo.

The result is two fitted parameters against the two observed transaction counts, leaving four free outputs as the gate:

| | Observed | Simulated | Error |
| --- | --- | --- | --- |
| June productions | 62 | 67 | 8.1% |
| June transactions per production | 4.58 | 4.28 | 6.5% |
| Debt productions | 44 | 41 | 7.9% |
| Debt transactions per production | 4.59 | 4.80 | 4.5% |

**Re-fit after the empty-hand defect.** An agent whose purchase targets are derived from its own hand cannot act once that hand is empty: `rankedRecipesOf` returns nothing, so the round falls through to a search forever. Players who sold down to zero cards became permanently inert — 80 dead slots per June run, 62 per debt run. Agents now fall back to buying the cheapest lowest-weight card they can reach when no recipe is left to chase, which is what a real player does to re-enter the economy. Re-fitting moved the encounter parameter from 3.75 to 3.25 and brought every gate under 9%; the earlier fit was compensating for the defect. Selling is also logged from the seller's side (free, per the round model), because a hand shrinking with no row of its own is exactly what hid this.

All four pass at ±25%. The residual is **systematic, not random**: the model always produces slightly more productions and a slightly lower ratio, meaning its agents remain a little too efficient at converting purchases into squares. Debt volume also cannot be throttled below 81% even at the tightest possible animator cap. Both are left standing rather than tuned away, because two observed games cannot support more fitted parameters without becoming curve-fitting.

## What it optimises

Constraints are pass/fail, because they describe sessions an animator would call ruined: no hard throw (`ERROR.NOT_ENOUGH_CARDS_IN_DECK`, or `weight >= 3`), no deadlock, every player produces at least once, a floor on [[latent-square]]s, a ceiling on [[stranded-card]]s. Among configurations that pass, the winning row **maximises the worst player's production count**. Total productions was rejected as the tie-break: the agent model's richer-player-wins contest is a concentration engine, and maximising the total rewards exactly the runaway it creates. Gini is reported, not optimised — a table where nobody produces scores perfectly on it.

Agents hoard (never selling a card in their own best Recipe), climb 2→3→4 copies, and resolve contested letters in favour of the richer player, who buys out the poorer. On a matured credit they extend by paying interest, settle only when comfortably able, and fault otherwise — the debt treadmill, which is what makes gate 2 meaningful.

## Considered options

- **A new formula replacing `1.25 ×`.** Rejected: the measured quality curve is non-monotonic between adjacent player counts, which no constant fixes. A committed lookup table keyed on *(player count × chosen [[recipe-shape]])* handles it exactly, and 21 rows costs nothing.
- **Full-stack only.** Rejected on arithmetic, not principle — it remains the oracle.
- **A standalone model sharing nothing.** Rejected: its conclusions would be about a game nobody wrote.
- **Compressed real timers** (the initial choice) — superseded by the round model, which removes the clock entirely and calibrates directly against observed action rates.
- **Fitting tempo to the observed transactions.** Superseded: under the round model tempo is structural, so both observed figures stay free and the model becomes falsifiable rather than merely calibrated.
- **An in-app simulator behind `devMode`.** Deferred, not rejected. The dev tool emits a self-contained HTML report; porting it once its value is proven is straightforward, whereas building it first costs routing, components and eight locales.

## Consequences

- **The formula fails at both ends, for opposite reasons.** First simulated scan (June, default rules, 12 seeds): below 6 players production runs away — 22-24 productions per player against 5 at 14 — because hands hold half the deck, squares assemble trivially and cascade, draining the upper levels. At 4 players that reaches the unimplemented technological shift in 67% of games (around round 26, i.e. 13 minutes) and throws `ERROR.NOT_ENOUGH_CARDS_IN_DECK` in 58%. Above 10 players the opposite failure appears: *everyone produced at least once* holds in only 50% of games at 14 players and 33% at 20. The clean band is **6-10 players**. This also answers the technological-shift question directly — it is unreachable at a large table and routine at a small one.
- **Stranded share is endemic, not exceptional**: 71% of cards in living hands at 20 players, rising to 99% at 4, belong to recipes that cannot be completed from living hands. The animator conversation is the default state of the game under current rules, which makes it the most promising thing for a new configuration to attack.
- The latent-floor and stranded-ceiling thresholds are **guesses, not calibrated**, so no configuration passes all six checks yet. Constraints 1-3 carry the meaningful signal until those two are set from what is actually achievable.
- **Above 41 players there is no valid configuration to recommend** until the alphabet is generated rather than enumerated. The simulator extends it internally so the 50/75/90 cells can be answered, but production code must be fixed before any such session is run for real.
- The **auto-profile applies only when `devMode` is off**, where `lobby-master` already refuses to start below 6 avatars. The 3-5 player deadlock is therefore reachable only in dev mode today — and whether that floor should drop is a decision the table will inform.
- Two defects found while modelling setup, both unfixed and neither caused by this work. `setupGameJune` deals the opening hand from `rules.amountCardsForProd` while `setupGameDebt` deals from `rules.distribInitCards`; both default to 4, so setting `amountCardsForProd: 3` silently gives the two games different opening hands. And `whoHaveCard` filters `status === ALIVE`, so a card held by a **PRISON** player reports as not present in deck or hands — a false answer, worse than the `deck` one.

  > **Correction (ADR-0018).** The first defect was worse than recorded here, and is now fixed. Both games dealt from a **hardcoded index list** — `rules.X === 3 ? [0,1,2] : [0,1,2,3]` — so the opening hand could only ever be 3 or 4 cards whatever the configuration said. The UI offers 1–12 and the sanitizer accepts 1–12; every value other than 3 produced 4, and in the June game `distribInitCards` was never read at all. Both games now deal `distribInitCards` cards, and setup refuses to start when the level-0 deck cannot supply `players × handSize`, which previously put `undefined` in the last hands. The default of 4 reproduces every figure in this ADR exactly.
- `generateDecks` mints `lettersInGame + 1` letters, since its loop bound is inclusive. Manual configuration via `generateLettersInDeck` is off by the same one.
- Measured cost is **13ms per run at 4 players rising to 88ms at 41**, so the full grid is 3 hours at small tables and ~20 at large ones. Feasible, but it makes pruning the large-player cells worthwhile rather than optional.
- The technological shift needs **≈21 productions funnelled into a single hand** at its floor, against 4.43 productions per player observed. Making production free of round cost is what could bring it into reach, by letting a full hand cascade; the endurance run measures whether it ever does. Reaching it throws today.
