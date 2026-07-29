# Geconomicus — Domain Glossary

## Card

A physical-game-style rectangular tile (aspect ratio 2:3) rendered by `card.component`. Represents a tradeable good with a family letter, icon, and price.

## Item

A square tile rendered by `item.component`. Wraps a Card for display in the player hand. Flippable to reveal the recipe on the back.

## Card Size Source of Truth

Card/item dimensions are always derived from viewport units (`vw` in portrait, `vh` in landscape), never hardcoded in `px`. All text and icon sizes inside a card are proportional fractions of that same viewport unit. There is no fixed per-row count — row count is emergent from card size and available width.

## Portrait / Landscape

Determined by `screenWidth < screenHeight`. Portrait uses `vw`-based card sizing; landscape uses `vh`-based sizing so cards remain the same physical size regardless of orientation.

## Screen Size Reactivity

`screenWidth` and `screenHeight` are updated on every `window resize` event (which fires on orientation change on mobile). Components must clear cached sizes on each resize so proportions recalculate correctly. Any flipped card is force-closed on orientation change.

## Row Layout

Cards are laid out with flexbox `flex-wrap`. The number of cards per row is emergent — whatever fits at the current card size. Target: ~3 per row on portrait phone, more on landscape or tablet. Tablet uses a `max-width` cap so cards don't grow oversized; text scales proportionally up to that cap.

## Player Board Layout — Portrait

Title bar fixed top, action buttons fixed bottom, card area scrolls between them. Overflow hidden under both fixed edges.

## Player Board Layout — Landscape

Left sidebar (avatar + coins) fixed to left edge, action buttons fixed to right edge as vertical column, card area scrolls in center. Same chrome elements, rotated 90° with text flipped to stay readable.

## Title Bar

`height: clamp(50px, 8vmin, 80px)`. Font-size set on container: `clamp(12px, 3vmin, 20px)`. Avatar and coins always visible in the same corner regardless of orientation.

## Title Bar Objects

Independent UI elements anchored to the corners of the title bar, separate from the main layout flow. Each object (avatar, player name, coin display) is individually positioned and sized in `em`: avatar `3em`, player name `1em`, coin amount `1.2em`, coin icon `2.5em`. Objects scale responsively with title bar font-size and remain fixed in their corner regardless of screen size or orientation changes.

## Action Buttons

Size: `clamp(44px, 10vmin, 60px)` (44px minimum touch target). Icons `1.5em`. Badge always top-left. Buy button always centered on its edge (bottom center in portrait, right-center in landscape). Buy button label hidden in landscape. Other buttons above/below buy.

## Dialog Cards (action dialog, seizure dialog)

Sized as `%` of their zone container, not `vw`. Action dialog: items at `~22%` of dialog width (4 per row). Seizure dialog: 2 cards per row per zone, each card `~45%` of zone width. Zones are scrollable. Seizure dialog has two equal zones (player hand / bank); layout is vertical on mobile, horizontal on desktop.

## Avatar

The persistent player identity within a game, identified by `avatarIdx`. Survives across deaths — an avatar has 1..N Lives over the course of a single gameState. Avatars (and their lives) are scoped to one gameState; the June game and the debt game are independent and do not share lives.

## Life (Incarnation)

One `PlayerState` element (identified by `idx`, the `playerStateIdx`). An Avatar owns one or more Lives; **exactly one Life per avatar is `ALIVE` at any moment**. A Life carries its own coins, cards, and actionTokens. When a Life ends it is frozen as a `DEAD` snapshot and never mutated again — it *is* the historical record. Credits are keyed to the `playerStateIdx` of the Life that took them.

## Reincarnate

Ending an Avatar's current Life and opening a new one within the same gameState. The dying Life is marked `DEAD` and left untouched (its coins + cards remain as a snapshot); a fresh `PlayerState` is appended to `playersStates[]` with a new `idx` drawn from `playerStateIndexSeq`, the same `avatarIdx`, and status `ALIVE`. The new Life starts with **coins = 0 (both game types)**, cards freshly dealt from the deck exactly like initial setup, and `actionTokens = startingTokens`. The player's device moves from the old Life to the new one.

Reincarnation happens on an Avatar's **first death only**, whether triggered automatically by the Death Queue timer or forced early by the animator's manual **Force Death** (the "kill" tool predates the auto-death timer and manually triggers the scheduled death). A subsequent death — only reachable by manually killing an already-reincarnated Avatar — is **terminal**: DEAD + seized + cards returned + snapshot, but no further Life. Every death (reincarnating or terminal) seizes credits (debt game) and returns cards to the deck. Death never routes through PRISON — prison is exclusively a credit-FAULT seizure outcome. If a scheduled death lands on a Life that is currently in `PRISON`, that Life still reincarnates (a new `ALIVE` Life is born) and its running prison timer is cancelled — death overrides imprisonment.

## Death Queue

The shuffled list of `avatarIdx` scheduled to die during the round, held at `gameTimers.deathState.deathQueue`. The death timer fires every `deathIntervalMs` and pops one avatar, reincarnating its currently-`ALIVE` Life. Each avatar appears exactly once; reincarnated (new) Lives are never enqueued, so every avatar dies exactly once — always its first Life. A **Force Death** (animator manual kill of a not-yet-reincarnated avatar) consumes that avatar's death early: it removes the avatar from the queue and **resets the death interval** (recomputed over the remaining round time and remaining queue) so the surviving scheduled deaths stay evenly spaced. `intervalDeathLeft` tracks ms remaining until the next death so a pause/resume preserves time-to-next-death rather than restarting the interval. The queue (planned death order) is surfaced to the animator in the table view as an avatar-list popover.

## Auto Death (`autoDeath` rule)

Whether avatars die on a schedule during the round. When `true` (the default), the Death Queue is active and every avatar is automatically reincarnated once, at its scheduled tick. When `false`, **there is no scheduled death**: no avatar dies unless the animator manually kills a Life via **Force Death** (which still reincarnates a first death and is terminal thereafter). A "pour de faux" / practice game turns this off. Note this differs from the legacy meaning, where `autoDeath` off still scheduled each death but required the animator to trigger it by hand ("death pass"); v2 drops the manual-pass concept entirely.

## Ghost Money

Coins that remain in a `DEAD` Life's frozen snapshot and are never reclaimed by anyone. Death never destroys these coins — they persist inside `currentMassMonetary` in **both** game types. In the June game there is no seizure, so *all* of a dead life's coins become ghost money. In the debt game, `seizureOnDead` claws back only up to the outstanding credit obligation (interest + principal, from coins then cards); any coins the dead player held **beyond** their debts are left on the snapshot and stay in the money mass — those excess coins are ghost money too. Ghost money is tracked per session so results can compare it across games; in the June game it is valued in **last-DU-equivalent** (ghost coins ÷ final DU) since June money is only meaningful relative to the DU.

## Seat

A player's live presence at the table — the link between one device and an Avatar's currently-`ALIVE` Life. Normally held by the player's own device. The animator can attach an **Assist Session** to any Seat via *play the user*; a second cockpit device attaches to the master Seat the same way.

## Assist Session

A secondary connection the animator opens onto a Seat — a player's (via *play the user*) or the master cockpit's — from another device or tab. Unlike a spectator it is **fully able to act**: the game grants it the same powers as the primary device (dual control). Its presence is invisible to the player-connection indicator, since it belongs to the animator, not the player. When *play the user* is opened on a Seat whose player is currently live, a dialog offers three relationships — **Co-exist**, **Take-over**, or **Kick**; when the player is not live, the session simply opens. A second master cockpit always attaches as **Co-exist**, silently (no dialog).

## Co-exist

An Assist Session relationship in which the player's own device stays fully active: animator and player both act at once. Safe despite "two hands on one Seat" because game mutations are serialised per game and re-validated on apply, so simultaneous actions cannot corrupt state — the loser of a race is simply rejected. The default (and only) relationship for a second master cockpit.

## Take-over

An Assist Session relationship in which the player's device is covered by a blocking overlay ("someone else is playing") while the animator drives. The player still sees the game update live but cannot act until they **Retake**. Used to help a player, or to demonstrate on a shared screen without the player interfering.

## Retake

The player reclaiming their Seat from a Take-over, via a button on the overlay. Reclaiming is **hard**: it ends the animator's Assist Session outright (the animator's tab drops back to the table) and clears the player's overlay.

## Kick

An Assist Session relationship (and the mechanism behind an ordinary reconnection) that **hard-disconnects** the displaced device, which must re-join to return. Distinguished from Take-over by being irreversible from the displaced side — no overlay, no Retake. Distinct from **kill**, which ends a Life, not a session.

## Action Token

A spendable resource on `PlayerState`. Resets to `startingTokens` (from Rules) on each new life (death-and-respawn only, not round boundary). Gains +1 per production.

## Action

A player-initiated interaction (give, steal, silentSteal, war, ong, whoHaveCard) with a token cost. Configured per-game in `rules.actions[]`. Executed via `ActionStateService` on the backend.

## Player Action Menu

A `mat-menu` anchored to a player's avatar (in both the table and boards layouts of the table view), holding every per-*player* action: play (open player view), copy link, QR re-join, refresh, give credit, free money, release from prison, kill. Mirrors the avatar menu pattern on `master-board`. Menu items are enabled per player status (e.g. give credit only when `ALIVE`, release only when `PRISON`). Distinct from the Credit Chip menu, which carries per-*credit* actions (seize/cancel/details) since a player may hold several credits.

## Locked Row

A player who is out of play (`PRISON` or `DEAD`) has their row content (coins, credits, cards) covered by a disabled overlay layer. The avatar remains clickable to open the Player Action Menu; status-invalid items in that menu are disabled.

## Credit Chip

A compact inline element (`app-credit-chip`) rendering one Credit in the table view's per-player credits column. Has two modes:

- **Active** (running/requesting/paused/idle/fault): a pill showing amount + interest, a status label, and a thin time-remaining progress bar coloured green→amber→red by elapsed fraction. Clicking opens a menu of the actions valid for that status (Cancel while active, Seize when `FAULT`).
- **Closed** (`DONE`/`CANCELED`): greyed, icon-only. Clicking reveals the credit's detail.

Detail (for closed chips, and via a "Details" menu entry on active chips) is shown in an anchored popover that renders the existing `app-credit` card read-only — not a modal dialog.

The per-player credits cell shows *all* of a player's credits (active first, closed after) and scrolls when they overflow. The chip owns the credit status→colour/label mapping and progress math (previously duplicated in `table-board` and `app-credit`). Distinct from `app-credit`, the tall vertical credit card formerly used by the bank view.

## Auto-Bank

The debt game's automated credit facility. Instead of the animator issuing every loan by hand, the bank sets the *price of credit* from the money supply and lets players borrow on demand. Configured per game by a Bank Profile. Debt game only — the June game has no bank.

## Seizure

Recovering a defaulted (`FAULT`) credit's amount + interest from a player's coins and cards. Coins are taken first, up to what's owed and never more (money is divisible). Any remainder is covered by cards, valued per whichever mode the game is configured with: **Decote** (each seized card counts at a discounted percentage of its face price toward the debt) or **Fees** (cards count at full face price, but a flat fee is added to the amount owed). Cards can't be split, so the last card taken to close the gap may overshoot what's owed — no change is returned. When more than one card could still be taken, the biggest card that fits *without* overshooting is always taken first; only once no remaining card fits without overshooting is the smallest overshooting card taken, to close the gap with as little waste as possible. Today driven entirely by the animator via the seizure dialog. *Avoid*: conflating with `seizureOnDead`, a separate, decote/fees-blind path that seizes at face value only.

## Auto Seizure

A rule/toggle **independent of `autoBank`** that automates the debt game's collections side: when on, a `FAULT` credit is resolved automatically via the same Seizure math the animator's manual dialog uses, instead of waiting on the animator. Deliberately a separate switch from Auto-Bank (which only automates lending terms) so an animator can mix, e.g., manual lending with auto collections, or the reverse. *Avoid*: conflating with Auto-Bank.

Driven by a real **backend timer** (same family as `CreditTimerManager`/`PrisonTimerManager`), started the moment a player's fault-count goes from 0 to 1: a 10s one-shot delay dressed as the police overlay's "seizure ongoing" text, after which the backend independently computes the Seizure and the prison outcome — no client ever supplies amounts. The deadline is **not reset** if a second credit faults while the timer is already running — the first 0→1 transition is the only thing that starts the clock; later faults are just swept into the same batch when it fires. Scoped **per player, not per credit**: the police overlay is already a single boolean across all of a player's credits, so one 10s timer covers every currently-`FAULT` credit for that player at once, settled in **FIFO order** (oldest fault first) against one shared, draining pool of coins/cards. The police overlay needs no new dismissal logic — it already clears reactively the instant the backend flips the credit(s) off `FAULT`, exactly as it does for a manual seizure today. The animator's manual **Seize** action stays available throughout as a fallback, mirroring how Auto-Bank's manual contract dialog stays available in every mode.

**Prison is triggered whenever the player's hand ends up empty (zero cards) once every FAULT credit has been processed — regardless of whether the debt ended up fully covered.** This differs from the manual dialog, where an empty hand only *permits* the animator to choose a prison term at their discretion; Auto Seizure makes it mandatory and deterministic. Reasoning: prison release unconditionally deals 4 fresh cards, so it's the only path back to a non-empty hand — leaving a player with an empty hand and no prison would strand them with nothing to play.

Duration scales with the **aggregate shortfall ratio** (unpaid remainder ÷ total owed, summed across the FIFO batch): `round(1 + (timerPrisonMax − 1) × shortfallRatio)`, clamped to `[1, timerPrisonMax]` — 1 minute when the hand merely ran dry but the debt was fully paid, up to `rules.timerPrison` (the same per-game cap the manual dialog uses, default 5) when almost nothing was recovered.

## Seizure Confirmation

A tap-to-dismiss dialog shown to the player the instant any Seizure resolves — **manual or Auto Seizure alike**, unifying both onto one result experience. New behavior for both paths: today the player's client silently reconciles coins/cards on `IO.CREDIT.SEIZURE` with no acknowledgment shown at all. States the aggregate outcome (coins + cards seized, prison or not) — not a per-credit breakdown, even when a FIFO batch settled several credits at once. Player-side only, like every other credit-status cue (Maturity Pressure, the police overlay). If prison was decided, it begins immediately once the player dismisses this dialog. The **only** remaining difference between the manual and Auto Seizure paths is the police overlay's wait-text ("go see the animator" vs. "seizure ongoing").

## Bank Profile

The Auto-Bank's behaviour preset for a game: **Normal**, **Aggressive**, or **Custom**, chosen when the `autoBank` toggle is on (off = manual, today's hand-issued behaviour, superseding the old `manualBank` flag). Selects the Rate Schedule; Aggressive holds players at the Base Rate until money is much scarcer before relenting; Custom lets the animator edit the tiers directly. The manual contract dialog stays available whatever the mode. *Avoid*: bank mode, bank type.

## Base Rate

The starting credit terms (default 3 for 1). Offered at the First Credit Question and whenever Average Money sits above the profile's highest threshold. Can be taken single or Double. Reuses the existing `defaultCreditAmount` / `defaultInterestAmount`.

## Double

The option to take any credit at twice the current terms (e.g. 6 for 2 against a 3-for-1 base). Always offered alongside the single amount, at the start and during the round.

## Rate Schedule / Tier

The ordered list of tiers a Bank Profile defines — each an Average-Money threshold paired with credit terms (amount + interest). As money grows scarce the Auto-Bank descends the schedule; the **deepest crossed threshold wins**, so credit becomes larger and cheaper the scarcer money gets. *Avoid*: rate table, ladder.

## Effective Rate

The credit terms currently on offer: the Base Rate while Average Money is above every threshold, otherwise the deepest crossed tier. Recomputed whenever the money mass or alive count changes, and it moves **both ways** — terms improve as money drains and tighten again as borrowing re-injects it. Rate changes are **live-down, silent-up**: only an *improvement* notifies players (with amount, interest, and %); a tightening happens silently. Because tightening is silent, the current Effective Rate is shown persistently as a small chip beside the credit button on the player board (amount / interest / %) so a borrower always sees the true rate before committing.

## Average Money

Total money mass ÷ living players — the scarcity metric that drives the Auto-Bank, already surfaced in the table view (`avgCurrency`). Includes Ghost Money, so it overstates money held in living hands. *Avoid*: avg per player, average currency.

## First Credit Question

The opening ceremony of a debt game: every player is asked once whether to take a starting credit (Base Rate, single or Double). The answer is recorded as experimental data whatever the player does afterward. The animator then persuades the room toward roughly 2 Average Money before starting the round — there is no automatic floor.

## Credit Request

A player-initiated ask for a credit — the "pull" path, distinct from the animator's manual contract. Reached from a button inside the opened credit panel; the player picks single or Double. It is **contract-based**: the borrow request carries the exact amount + interest the player was shown, and the bank honours those terms — **what you saw when you opened the panel is what you get**, even if the live rate has since moved. Auto-approved when the player is Solvent, otherwise refused with a prompt to **negotiate with the animator** (who can still grant it via the manual contract). Do **not** confuse with the existing `IO.CREDIT.REQUEST` / `DB_EVENTS.CREDIT_REQUEST`, which is the opposite thing — the bank calling a player to settle at maturity (the **Settlement Call**). *Avoid*: loan application.

## Settlement Call

The bank asking a player to repay (settle) or pay interest when a credit's timer expires — the maturity event carried today by `IO.CREDIT.REQUEST`. Named here only to keep it distinct from a player's Credit Request. *Avoid*: credit request (ambiguous).

## Credit Origin

A tag on every created credit recording how it came to be: `animator` (manual contract), `first-question` (the opening First Credit Question), or `player-request` (a self-service Credit Request). Lets the per-game results panel break credit behaviour down by source.

## Solvency

A player's total outstanding obligation — amount + interest summed across their active credits — measured against their wealth (coins + total card value). Determines auto-approval of a Credit Request; also shown on the animator's manual contract dialog to inform a risk / higher-rate decision (informational there, never an auto-refusal).

## Maturity Pressure

The escalating, player-facing cues that warn a borrower a running credit is nearing settlement — a Halfway Nudge at 50% elapsed and a Final-Minute Alarm in the last 60s. Computed entirely on the client from the existing credit progress heartbeat; debt game only, and shown only in the player's own view (never the animator's). The runway to the Settlement Call.

## Halfway Nudge

A transient snackbar shown **once** when a running credit passes 50% of its duration, naming the time left (e.g. "Crédit à mi-parcours - 2mn30s restant"). Suppressed when `durationCredit ≤ 2 min` so it can't collide with the Final-Minute Alarm. Re-armed if the credit is extended.
*Avoid*: half-time warning, mi-temps.

## Final-Minute Alarm

The last-60-seconds treatment of a running credit: a brief full-screen flash (reincarnate-overlay style, ⏰, ~2s) that then force-opens the credit panel and replaces that credit's "en cours" label with a per-second countdown (`59s`…`0s`, pulsing each tick; the progress bar underneath is unchanged). Fires once per credit cycle, re-arms on extend, and on reconnect the countdown state is restored but the flash is not replayed.
*Avoid*: countdown, final warning, last call.

## Fault Lockout

The player-view treatment once a credit reaches FAULT (the borrower failed to settle at maturity): a full-screen blue↔red police-strobe overlay (🚨, looping `police.mp3` siren) that blocks the whole board. Text depends on Auto Seizure: "go see the animator" when off, "seizure ongoing" while the backend's Auto Seizure timer is running when on. Unlike the Final-Minute Alarm it is **un-skippable and state-derived** — it is rendered from the presence of any FAULT credit, so it re-raises on refresh and clears the instant a Seizure (manual or auto) moves every FAULT credit out of that status. Highest-priority overlay (z-index above reincarnate/alarm/take-over).
*Avoid*: default screen, blocked overlay, GO_TO_BANK.

## Table (Console)

The animator's omniscient observer view (`table-board`) — the spreadsheet of the whole game: every player's coins, cards, action tokens, credits, and the decks, live. It absorbs what used to be the "bank view" (the credit console) into one screen. Joins three socket rooms — `gameState` (lifecycle/timer), `master` (connection + death/rebirth), and `table` (everything economic) — so it hears every mutation. Fed by absolute [[last-known]] snapshots; it *replaces* state, never computes deltas. Distinct from the **Master (Console)** and from the **Bank** economic actor. *Avoid*: bank view, admin view.

## Master (Console)

The lightweight animator overhead view (`master-board`) — avatars grid, connection dots, the round timer, birth/death. Deliberately minimal: it is fed only connection on/off, death/reincarnation, game lifecycle + timer, and game-deleted (to bounce back to the session lobby). It is **not** fed the economic detail (coins/cards/credits/decks) — that is the Table's job. *Avoid*: master board (when the concept, not the component, is meant).

## Bank — room vs actor

Two unrelated meanings of "bank" that only share a word. The Bank **actor** (`PLAYER_TYPE.BANK`) is the in-game money issuer — it emits DU and credit and performs seizures, and tags those events as its own. The Bank **room** was the animator's credit feed; it is gone, renamed to the `table` room and folded into the Table Console. Removing the room does **not** touch the actor. *Avoid*: using "bank" unqualified when the room (now Table) is meant.

## Last-Known (LK)

The absolute-snapshot convention behind the Table's live state. A state-changing broadcast carries the affected entity's authoritative **post-value** — `coinsLK`, `cardsLK`, action tokens, a deck level's full card array — and the receiver *replaces* that field. Never a delta. Chosen because observer-room broadcasts are unacked: an absolute snapshot is idempotent and self-healing (a dropped or duplicated message can't corrupt a balance), whereas a delta corrupts permanently. See [[player-state-sync]] and ADR-0008.

## Player State Sync / Decks State Sync

The two sibling [[last-known]] channels to the `table` room, each single-responsibility. `PLAYER_STATE_SYNC` carries `{ players: [{ idx, coinsLK, cardsLK, actionTokens }] }` for only the *concerned* players (both sides of a transaction, the giver + targets of an action, the whole alive set on DU). `DECKS_STATE_SYNC` carries `{ decks: [{ level, cards }] }` for only the deck *levels that changed*. Aggregates (`currentMassMonetary`, bank indicators) are **not** here — they ride their causing domain events (credit, DU, death). Emitted *in addition* to the unchanged player-facing events. *Avoid*: state broadcast, table update.

## Production Reveal

The player-facing celebration when a completed square (`amountCardsForProd` matching cards) is built. The existing square-zone box holds its position and swaps its ingredients-and-button content for the new leveled-up card, a rotating sunburst scaled to the box (not the screen), confetti, and "built"/"cards redrawn" text, for a fixed ~2.5s auto-dismiss (no tap needed) before the hand resolves to its new state. Scoped to the card-area only: unlike Reincarnate/Fault Lockout, the title bar and action buttons stay visible and interactive throughout, and other complete-but-unbuilt squares stay fully clickable underneath a visual dim — nothing is input-blocked. The new hand state (produced card + redrawn replacement cards) is deliberately **held** and only applied once the reveal completes, so the box isn't pulled out from under itself mid-animation. Every production gets the identical reveal regardless of `producedCard.weight` — there is no end-of-game/top-tier special case; the eventual "technology shift" endgame is unbuilt, unscoped future work, and production is deliberately treated as endless/circular until that's designed.
*Avoid*: production animation, build celebration, congrats dialog (retired).
