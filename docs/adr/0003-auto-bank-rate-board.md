# Auto-Bank: a pull rate-board, not a credit pusher

In the debt game, when the `autoBank` toggle is on the bank sets the *price* of credit from the money supply and lets players borrow on demand — rather than the animator hand-issuing every loan, or the bank force-creating credit onto players. The Effective Rate is the deepest Average-Money tier the current avg has crossed, per the selected Bank Profile (`normal` / `aggressive` / `custom`); it moves **bidirectionally** and is **live-down / silent-up** — improvements notify players (amount, interest, %), tightenings are silent. Players **pull** credit via a self-service Credit Request auto-approved on Solvency (coins + card value ≥ total outstanding obligation) or refused with a prompt to negotiate with the animator. The game opens with a **blocking first-credit question** (Take / Take-double / Decline at the base rate, no solvency gate) whose answer is stored purely as data; the animator then persuades the room toward ~2€ average before starting the round.

## Considered options

- **Force-create credit when avg drops (QE-style)** — rejected: players would owe money they never chose to borrow, which is pedagogically wrong for a debt-money game and a poorer data signal. Kept only conceptually for the (removed) idea of an auto-seed.
- **Push targeted accept/decline offers to specific players** — rejected: more moving parts than pull, and the rate-board unifies "the bank proposes a rate" and "the player asks for credit" into a single mechanism.
- **Ratchet-down rate** (only ever improves within a round) — rejected in favour of a bidirectional live rate so re-injected money tightens terms and the system self-regulates. Notifications are live-down/silent-up so players get the good news but must read the persistent rate chip before borrowing.
- **Auto-topup floor at start** (guarantee ~2€ avg) — rejected: it would pollute the first-credit-decision data. The animator is the human floor; the manual give-credit / credit-for-all tools remain as a visible safety valve.

## Consequences

- **Average Money includes ghost money** (dead lives' coins persist in the mass, see [CONTEXT.md](../../CONTEXT.md) → Ghost Money and ADR-0002). So the scarcity signal is understated late-game and tiers may fire later than "money in living hands" would. Intentional and consistent with the reincarnation model.
- `autoBank` (bool) + `bankProfile` (enum) **supersede the `manualBank` boolean**; a **variable-length tier schedule** (threshold / amount / interest, strictly descending) lives in the rules and is edited in the game-options dialog under Custom.
- The base rate and **Double** reuse the existing `defaultCreditAmount` / `defaultInterestAmount`. The self-service request quotes the Effective Rate at dialog-open and holds it while the player decides.
- **Telemetry is event-only** (stored in `dbEvents`, feeding a per-game results panel now; cross-game analysis later): a first-credit-question response event, a `CREDIT_REFUSED` event, and a `creditOrigin` (`animator` / `first-question` / `player-request`) stamped into the `CREDIT_NEW` event payload — **not** onto the persisted `Credit`, which stays lean. The first-question decision is fully captured by its own event, so the credit needs no origin field; origin only distinguishes player-pulled from animator-issued borrows in the event log.
- **Naming:** the player pull is a **Credit Request**; the pre-existing `IO.CREDIT.REQUEST` / `DB_EVENTS.CREDIT_REQUEST` is the bank's **Settlement Call** (maturity) — the two must not be conflated.
- Reincarnated lives are **not** re-prompted; they borrow via the normal request button, so recurrence is inferred from actual borrows.
