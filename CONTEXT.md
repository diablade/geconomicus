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

The player's character for the whole **session**, identified by `avatarIdx` and held on the Session (`session.avatars`), never on a gameState. One Avatar is one device and one person: it carries the styling, waits in the lobby between games, and is the only thing that means *the same player* in both games — which is what lets [[session-results]] compare them face to face.

Each game mints its own Lives from that one shared avatar list, so an Avatar owns 1..N Lives **per gameState** and four across a typical session: two games × two Lives, since the [[death-queue]] kills every avatar exactly once per game and the second Life exists precisely to show death's impact on the economy. Lives are never shared between games — only the Avatar is.

## Life (Incarnation)

One `PlayerState` element (identified by `idx`, the `playerStateIdx`). An Avatar owns one or more Lives; **exactly one Life per avatar is the [[current-life]] at any moment**. A Life carries its own coins, cards, and actionTokens. When a Life ends it is frozen as a `DEAD` snapshot and never mutated again — it *is* the historical record. Credits are keyed to the `playerStateIdx` of the Life that took them.

## Current Life

The one Life of an Avatar that is **not `DEAD`** — the Life a Seat attaches to, and the answer to "where do I send this player back". Its status is `ALIVE` **or `PRISON`**: prison is a state *of* the Current Life, not a separate Life, so testing `status === ALIVE` is too narrow. An Avatar has exactly one Current Life, except after a terminal death, when it has none. Resolved by `getCurrentPlayerStateIdx`, which returns `-1` when there is no Current Life — a value every caller must guard. The death path (`_reincarnate`) selects the life to end by the same "not `DEAD`" test, which is how a scheduled death can land on an imprisoned life. *Avoid*: alive life, active life.

## Reincarnate

Ending an Avatar's current Life and opening a new one within the same gameState. The dying Life is marked `DEAD` and left untouched (its coins + cards remain as a snapshot); a fresh `PlayerState` is appended to `playersStates[]` with a new `idx` drawn from `playerStateIndexSeq`, the same `avatarIdx`, and status `ALIVE`. The new Life starts with **coins = 0 (both game types)**, cards freshly dealt from the deck exactly like initial setup, and `actionTokens = startingTokens`. The player's device moves from the old Life to the new one.

Reincarnation happens on an Avatar's **first death only**, whether triggered automatically by the Death Queue timer or forced early by the animator's manual **Force Death** (the "kill" tool predates the auto-death timer and manually triggers the scheduled death). A subsequent death — only reachable by manually killing an already-reincarnated Avatar — is **terminal**: DEAD + seized + cards returned + snapshot, but no further Life. Every death (reincarnating or terminal) seizes credits (debt game) and returns cards to the deck. Death never routes through PRISON — prison is exclusively a credit-FAULT seizure outcome. If a scheduled death lands on a Life that is currently in `PRISON`, that Life still reincarnates (a new `ALIVE` Life is born) and its running prison timer is cancelled — death overrides imprisonment.

## Death Queue

The shuffled list of `avatarIdx` scheduled to die during the round, held at `gameTimers.deathState.deathQueue`. The death timer fires every `deathIntervalMs` and pops one avatar, reincarnating its currently-`ALIVE` Life. Each avatar appears exactly once; reincarnated (new) Lives are never enqueued, so every avatar dies exactly once — always its first Life. A **Force Death** (animator manual kill of a not-yet-reincarnated avatar) consumes that avatar's death early: it removes the avatar from the queue and **resets the death interval** (recomputed over the remaining round time and remaining queue) so the surviving scheduled deaths stay evenly spaced. `intervalDeathLeft` tracks ms remaining until the next death so a pause/resume preserves time-to-next-death rather than restarting the interval. The queue (planned death order) is surfaced to the animator in the table view as an avatar-list popover.

## Auto Death (`autoDeath` rule)

Whether avatars die on a schedule during the round. When `true` (the default), the Death Queue is active and every avatar is automatically reincarnated once, at its scheduled tick. When `false`, **there is no scheduled death**: no avatar dies unless the animator manually kills a Life via **Force Death** (which still reincarnates a first death and is terminal thereafter). A "pour de faux" / practice game turns this off. Note this differs from the legacy meaning, where `autoDeath` off still scheduled each death but required the animator to trigger it by hand ("death pass"); v2 drops the manual-pass concept entirely.

## DU Tick

One distribution of the DU to every living Life in the June game. Persisted as **one event per recipient**, never one event for the whole tick: the events log filters by `receiver`, so a per-player row is what lets an animator ask what a given player received and confirm nobody living was skipped. All rows of one tick share a single timestamp, which is what makes a tick identifiable — counting distinct timestamps is the DU count — and lands the money mass's step at one x instead of smeared across milliseconds.

Because the mass is incremented inside the same loop, a tick's rows carry rising partial sums of it. All of them are kept and all are plotted; every one is a true reading, and Σ coins over Lives equals the declared mass at each, since both advance in lockstep through the loop. So the [[data-health-block]] reconciles cleanly row by row rather than flagging the tick, and would still notice a living Life the DU skipped.

## Ghost Money

Coins that remain in a `DEAD` Life's frozen snapshot and are never reclaimed by anyone. Death never destroys these coins — they persist inside `currentMassMonetary` in **both** game types. In the June game there is no seizure, so *all* of a dead life's coins become ghost money. In the debt game, `seizureOnDead` claws back only up to the outstanding credit obligation (interest + principal, from coins then cards); any coins the dead player held **beyond** their debts are left on the snapshot and stay in the money mass — those excess coins are ghost money too. Ghost money is tracked per session so results can compare it across games; in the June game it is valued in **last-DU-equivalent** (ghost coins ÷ final DU) since June money is only meaningful relative to the DU.

A Life's ghost money is read off its death event — `player-died` or `player-died-with-seizure`, per [[seizure-on-death]] — which is emitted **after** the seizure and the return of cards to the decks and so carries the post-seizure remainder. That ordering is what makes a death event mean the same thing in both game types — the final, frozen holdings of that Life, and therefore the last point of its curve — rather than needing a debt-game special case. Since either form can carry it, a reader must match **both**; `isDeathEvent` is the shared test.

## Session Code

The 4-digit code identifying a session, stored as `shortId` and generated by `numbersId4()`. Shown on the master lobby QR label and in the Table. Typed **alone** it means "I am new here": it resolves only while the session is `OPEN`, and leads to avatar creation. Its 10 000-value space carries no uniqueness check, so it stays safe only because the pool of resolvable sessions is bounded — which depends on sessions eventually reaching `ENDED` via [[close-session]]. *Avoid*: shortId (the field name, not the concept), session id (that is the ObjectId).

## Close Session

The animator's explicit act of ending a session: it sets the session to `ENDED` and opens [[session-results]]. Offered only once **both games are done**, and deliberately manual rather than an automatic transition on the second game stopping — closing is irreversible in effect, since the [[code-dispatcher]] refuses every code form against an `ENDED` session, so no player can rejoin or reach their avatar afterwards. Closing is what bounds the pool of resolvable [[session-code]]s and keeps 4-digit codes collision-safe.

Closing is **not** a precondition for reading results: [[session-results]] is reachable at any time, so an animator can debrief the debt game during the break before the June game. Reaching it on an unfinished session warns first that the picture is partial.

## Avatar Code

`XXXX-YY` — a [[session-code]] plus an `avatarIdx` (which starts at 1, so 1–2 digits). The addressable identity of one Avatar inside one session, and the answer to "put me back where I was": typing it lands on that Avatar's player lobby, which then offers a [[rejoin-countdown]] into the running game. It is what the animator dictates to a player whose device died, and what lets a substitute take an Avatar over. Deliberately guessable — handing an Avatar to someone else is a feature here, not a leak. Surfaced to the animator in the [[player-action-menu]]. *Avoid*: seat code, join code, player code.

## Rejoin Countdown

How a player who arrived by [[avatar-code]] gets back into a running game: their player lobby shows the joinable game's entry button counting down and then pressing itself, with a cancel that leaves them on the lobby. Deliberately **not** a silent redirect — the player sees their own avatar and the game they are about to enter before it happens, and cancelling is what keeps avatar settings and the survey reachable while a game is running. Armed only when arriving by code (never on an ordinary lobby visit), only when the Avatar has a [[current-life]] in that game, and only when exactly one game is joinable — any ambiguity falls back to a plain manual choice.

## Code Dispatcher

The single reception point for a typed code: it decides the destination, rather than the lookup deciding it by refusing to answer. **The two code forms resolve over different session-status scopes** — a bare [[session-code]] only against `OPEN` sessions, an [[avatar-code]] against every session except `ENDED`:

| Form | Session status | Destination |
| --- | --- | --- |
| `XXXX` | `OPEN` | avatar creation |
| `XXXX` | anything else | refused |
| `XXXX-YY`, avatar `YY` exists | not `ENDED` | that Avatar's player lobby, forwarding into a running game |
| `XXXX-YY`, avatar `YY` absent | `OPEN` | avatar creation — note the new avatar gets `avatarIndexSeq + 1`, **not** `YY`, so the screen must say so |
| `XXXX-YY` | `ENDED` | refused |

The `OPEN` requirement therefore expresses a policy about *creating an avatar*, and lives in the creation branch — not in "which session is 1234?", which is why the lookup itself is no longer status-gated.

A refusal never closes the entry dialog: the reason appears under the field and the typed code is kept, so a mistyped digit costs one correction rather than a full re-entry. Each cause reads differently — session ended, unknown avatar, session already started (so a bare [[session-code]] is not enough).

## Seat

A player's live presence at the table — the link between one device and an Avatar's [[current-life]]. Normally held by the player's own device. The animator can attach an **Assist Session** to any Seat via *play the user*; a second cockpit device attaches to the master Seat the same way.

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

## Seizure on Death

The debt game's claw-back when a Life ends: its outstanding credits are settled from the dead Life's coins and then its cards, at **face value only** — blind to decote/fees, unlike the animator's [[seizure]]. Whatever coins survive it are that Life's [[ghost-money]].

Recorded on the death event itself rather than as a second row. A Life's end emits **`player-died`** when nothing was seized, or **`player-died-with-seizure`** when something was — the latter additionally declaring the money mass and the four bank counters that only a real claw-back moves. The split is keyed on **effect, not game type**: a debt player who owed nothing at death emits the plain event exactly as a June player does, so no reader anywhere branches on `typeMoney`. Both are emitted after the claw-back and after the cards return to the decks, so either one carries the Life's final frozen state and is the last point of its curve.

This replaced a separate `credit-seized-dead` event, which fired back-to-back with the death and so wrote a second [[last-known]] sample for the same Life at the same instant — a redundant curve vertex and two rows that could disagree about one moment.

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

The credit terms currently on offer: the Base Rate while Average Money is above every threshold, otherwise the deepest crossed tier. Recomputed whenever the money mass or alive count changes, and it moves **both ways** — terms improve as money drains and tighten again as borrowing re-injects it. Rate changes are **live-down, silent-up**: only an *improvement* notifies players (with amount, interest, and %); a tightening happens silently. An improvement raises a **dialog** urging the player to borrow before the window closes; the **0% tier** instead raises the [[zero-rate-window]] overlay. Because tightening is silent, the current Effective Rate is shown persistently as a small chip beside the credit button on the player board (amount / interest / %) so a borrower always sees the true rate before committing.

## Zero-Rate Window

The player-facing treatment of an Effective Rate that has reached the interest-free tier: a full-screen overlay with a spinning wheel behind a huge `0%` and one line urging the player to borrow before the rate climbs back. The loudest of the rate cues, because free credit is the moment the debt game most wants noticed — and it is a *window*, not a state: the next borrow re-injects money and tightens the rate again. *Avoid*: free credit, zero interest offer.

## Average Money

Total money mass ÷ living players — the scarcity metric that drives the Auto-Bank, already surfaced in the table view (`avgCurrency`). Includes Ghost Money, so it overstates money held in living hands. *Avoid*: avg per player, average currency.

## First Credit Question

The opening ceremony of a debt game: every player is asked once whether to take a starting credit at the Base Rate (single or Double). Asked in **both bank modes** — it is independent of `autoBank`, which governs only how credit is priced and issued *during* the round. An accept self-issues the credit on the spot (origin `first-question`), idle until the round starts.

Presented in the [[credit-contract-dialog]] in first-question mode: hard-blocking, with the three buttons as the only way out. The animator opens it from the console in a strict sequence — **Distribute Cards → Ask for Credits → Start Game**, each button replacing the previous one — so a debt round cannot start without the question having been asked, while a June game goes straight to Start. Asking is confirmed first, the confirm naming how many players are connected, since the point is a room answering together: the ask itself is irreversible (accepts book real credits) but a missing phone is not, because delivery is **not** a broadcast but per-life state. Asking stamps every [[current-life]] **pending**, and a board raises the question whenever its own life reads pending — so a phone that was offline, handed out late, or merely refreshed still gets asked, the same state-derived, un-skippable convention as [[fault-lockout]]. A reincarnated life is never asked.

Launch is **not** blocked on answers: the console shows a check on each avatar that answered, and Start Game raises a confirm when Average Money is under 2 **or** anyone is still pending. Starting the round sweeps every still-pending life to **no-answer** — recorded distinctly from an explicit **Decline**, so silence is never read as a refusal — which also closes the dialog on any phone still showing it. The answer is recorded as experimental data whatever the player does afterward. The animator then persuades the room toward roughly 2 Average Money before starting the round — there is no automatic floor.

## Credit Request

A player-initiated ask for a credit — the "pull" path, distinct from the animator's manual contract. `autoBank` only, since pull-on-demand is exactly what that toggle grants; the [[first-credit-question]] is the one credit path open in both modes. Reached from a single button inside the opened credit panel, which opens the [[credit-contract-dialog]] in request mode where the player picks single or Double (never a free-form amount). It is **contract-based**: the borrow request carries the exact amount + interest the player was shown, and the bank honours those terms — **what the dialog showed when it opened is what you get**, even if the live rate has since moved. Auto-approved when the player is Solvent, otherwise refused with a prompt to **negotiate with the animator** (who can still grant it via the manual contract). Do **not** confuse with the existing `IO.CREDIT.REQUEST` / `DB_EVENTS.CREDIT_REQUEST`, which is the opposite thing — the bank calling a player to settle at maturity (the **Settlement Call**). *Avoid*: loan application.

## Credit Contract Dialog

The single dialog that issues credit, in three modes: `contract` (the animator's manual contract, opened from a player's avatar menu), `request` (a player's mid-round [[credit-request]]), and `first-question` (the [[first-credit-question]]). The body is the same everywhere — the terms on offer as single or **Double**, the interest rate %, and the total to repay — so a player meets the identical layout at the opening ceremony and every borrow afterward. Mode drives only the differences: the player picker, free-form amount entry and the [[solvency]] panel are animator-only; the **Decline** button, the un-dismissable backdrop and the opening sound are first-question-only; and the confirm reads **Signer** for the animator (booked exactly as shown) but **Demander** for a player, because the server re-checks and may refuse.

Its figures always come from the server's rate for that player, fetched when the dialog opens — the [[base-rate]] before the round, the deepest crossed [[effective-rate]] tier during it — never from hardcoded or client-side numbers. That single source is what makes the contract guarantee literal in all three modes, and it means the animator's quick credit follows the rate board instead of contradicting it; free-form entry stays as the animator's override. *Avoid*: contract dialog (ambiguous — the animator's mode, or the shared dialog?).

## Settlement Call

The bank asking a player to repay (settle) or pay interest when a credit's timer expires — the maturity event carried today by `IO.CREDIT.REQUEST`. Named here only to keep it distinct from a player's Credit Request.

Maturity has **three** outcomes, not two, and they are tested in order: a borrower who can cover amount + interest gets the Settlement Call and the credit waits at `REQUESTING`; one who can cover only the interest has it taken and the credit runs again; one who can cover neither goes to `FAULT`. Only the first involves the player at all — the other two are the bank acting unilaterally, which is why a debt player can be extended or defaulted without ever being asked. *Avoid*: credit request (ambiguous).

## Credit Origin

A tag on every created credit recording how it came to be: `animator` (manual contract), `first-question` (the opening First Credit Question), or `player-request` (a self-service Credit Request). Lets the per-game results panel break credit behaviour down by source.

## Solvency

A player's total outstanding obligation — amount + interest summed across their active credits — measured against their wealth (coins + total card value). Determines auto-approval of a Credit Request; also shown in the animator's mode of the [[credit-contract-dialog]] to inform a risk / higher-rate decision (informational there, never an auto-refusal). Deliberately **never shown to a player** in the other two modes: the server is the only authority on a refusal, and being refused by the bank teaches more than a greyed-out button.

## Maturity Pressure

The escalating, player-facing cues that warn a borrower a running credit is nearing settlement — a Halfway Nudge at 50% elapsed and a Final-Minute Alarm in the last 60s. Computed entirely on the client from the existing credit progress heartbeat; debt game only, and shown only in the player's own view (never the animator's). The runway to the Settlement Call.

## Halfway Nudge

A dismissable full-screen overlay shown **once** when a running credit passes 50% of its duration — ⏰ on amber, `nudge` sound, and one plain line ("Mi-temps pour rembourser ton crédit") with **no figure**: the credit panel already carries the exact time, and the cue only has to say *you are past half*. Suppressed when `durationCredit ≤ 2 min` so it can't collide with the Final-Minute Alarm. Re-armed if the credit is extended.
*Avoid*: half-time warning, snackbar nudge.

## Final-Minute Alarm

The last-60-seconds treatment of a running credit: a brief full-screen red flash (⚠️, `high_alarm` sound) that then force-opens the credit panel and replaces that credit's "en cours" label with a per-second countdown (`59s`…`0s`, pulsing each tick; the progress bar underneath is unchanged). Fires once per credit cycle, re-arms on extend, and on reconnect the countdown state is restored but the flash is not replayed.
*Avoid*: countdown, final warning, last call.

## Fault Lockout

The player-view treatment once a credit reaches FAULT (the borrower failed to settle at maturity): a full-screen blue↔red police-strobe overlay (🚨, siren) that blocks the whole board. **Both the text and the siren depend on Auto Seizure**: "go see the animator" over `police.mp3` when off, "seizure ongoing" over `police2.mp3` while the backend's Auto Seizure timer is running when on — the two situations sound different because they ask different things of the player (walk to the animator vs. sit and wait). Unlike the Final-Minute Alarm it is **un-skippable and state-derived** — it is rendered from the presence of any FAULT credit, so it re-raises on refresh and clears the instant a Seizure (manual or auto) moves every FAULT credit out of that status. Highest-priority overlay (z-index above reincarnate/alarm/take-over).
*Avoid*: default screen, blocked overlay, GO_TO_BANK.

## Prison Release

The end of a prison sentence, given the opposite theatre to its start. Prison **opens** on a `buzzer` → `prison` sound sequence (the buzzer lands first, so the sentence is announced before the door music); it **closes** on `IO.PLAYER.PRISON_ENDED` with a 🕊️ overlay, `outPrison`, and confetti. Release already deals 4 fresh cards, so the celebration is the player's cue that they can play again — without it the board simply unblocks and a distracted player can sit out their own release. *Avoid*: out of jail, prison end.

## Table (Console)

The animator's omniscient observer view (`table-board`) — the spreadsheet of the whole game: every player's coins, cards, action tokens, credits, and the decks, live. It absorbs what used to be the "bank view" (the credit console) into one screen. Joins three socket rooms — `gameState` (lifecycle/timer), `master` (connection + death/rebirth), and `table` (everything economic) — so it hears every mutation. Fed by absolute [[last-known]] snapshots; it *replaces* state, never computes deltas. Distinct from the **Master (Console)** and from the **Bank** economic actor. *Avoid*: bank view, admin view.

## Master (Console)

The lightweight animator overhead view (`master-board`) — avatars grid, connection dots, the round timer, birth/death. Deliberately minimal: it is fed only connection on/off, death/reincarnation, game lifecycle + timer, and game-deleted (to bounce back to the session lobby). It is **not** fed the per-player economic detail (coins/cards/credits/decks) — that is the Table's job.

The one economic thing it does carry is the **money-mass aggregate**, because the pre-round [[first-credit-question]] step needs a live [[average-money]] reading to decide when to start. It rides its causing event exactly as it does everywhere else: every mutation that moves the mass (credit created, cancelled, free money, a first-credit answer, a death) carries the bank indicators to the `master` room, and the console replaces its copy. No per-player amounts, no credit list. *Avoid*: master board (when the concept, not the component, is meant).

## Bank — room vs actor

Two unrelated meanings of "bank" that only share a word. The Bank **actor** (`PLAYER_TYPE.BANK`) is the in-game money issuer — it emits DU and credit and performs seizures, and tags those events as its own. The Bank **room** was the animator's credit feed; it is gone, renamed to the `table` room and folded into the Table Console. Removing the room does **not** touch the actor. *Avoid*: using "bank" unqualified when the room (now Table) is meant.

## Engine

Where a game rule's *behaviour* lives: the validation, the state change, and the events it records, as a function of the [[queue-entry]] alone. Everything about *when* a rule fires and *who gets told* stays outside it — the per-game serialisation queue, the timers, and every socket emit belong to the services.

The split exists so that a rule can run without a room full of people: the deck simulator and the unit tests call the very same functions a live session calls. A behaviour with two implementations is the failure it prevents, and that failure has already happened twice — one copy seized at face value while the other applied a decote, and a credit extension recorded two events on one path and one on the other.

Timers are deliberately *not* part of it. A timer decides *when*; the simulator replaces when with rounds. What a timer callback **does** is Engine. Because a timer can fire against a credit that has since been settled or cancelled, the Engine treats resolving a credit that is no longer running as a **no-op rather than an error** — the guard sits with the rule, so it holds in every ordering and for every caller rather than depending on someone remembering a `try`/`catch`. *Avoid*: engine helper (the retired name), game logic, business logic.

## Queue Entry

The `{ gameState, rules, events }` triple that one mutation runs against, handed to it by the per-game serialisation queue. It is the entire input to an [[engine]] function — the game's id included, read off `gameState._id` — so no rule depends on ambient state and every engine signature has the same shape.

`events` is a plain array the Engine appends to, never a database write. That is what lets the simulator collect a real event stream in memory and hand it straight to the front, and what makes the [[lk-contract]] testable without persistence.

Awaits inside a mutation do **not** release the queue, so nothing can interleave mid-mutation. A stale timer callback is therefore never a partial-state hazard — it is simply a mutation that arrives late, which is why the Engine guards it by returning a no-op rather than the queue guarding it by ordering.

## Last-Known (LK)

The absolute-snapshot convention behind the Table's live state. A state-changing broadcast carries the affected entity's authoritative **post-value** — `coinsLK`, `cardsLK`, action tokens, a deck level's full card array — and the receiver *replaces* that field. Never a delta. Chosen because observer-room broadcasts are unacked: an absolute snapshot is idempotent and self-healing (a dropped or duplicated message can't corrupt a balance), whereas a delta corrupts permanently. See [[player-state-sync]] and ADR-0008.

The same convention governs the **persisted event stream**, which is what [[session-results]] reads. There, LK is always **keyed by `playerStateIdx`**, never by side: a life's post-values live under its own index, so a value is attributed to the [[life-incarnation]] it belongs to whatever role that life played. `emitter` / `receiver` survive purely as **role pointers** — who acted upon whom, used for the events log and for activity counts — and carry no values of their own. The two slots stay **semantic**: `emitter` is whoever acted, `receiver` whoever was acted upon, whichever of them happens to be a Life. A structural rule ("the Life always sits in `receiver`") was rejected: since LK is keyed by `playerStateIdx`, nothing that reads a *value* consults a role pointer at all, so flattening them would discard the only thing they still say. Side-keying was the earlier form and is ambiguous by construction: an event whose counterparty is the Bank or the animator has no meaningful "receiver's coins". *Avoid*: emitterCoinsLK, receiverCardsValueLK (the retired side-keyed form).

Crucially the stream's LK is **taken, not supplied**: the [[lk-contract]] declares what each event carries and the event builder extracts it from the gameState itself. A call site states only who was involved, never what to record.

## LK Contract

The declaration of which Last-Known pieces each event type carries — the single place that answers "what does this event record". It is a **producer**: the event builder reads it and pulls the declared pieces off the live gameState, so adding a piece is a one-line change that every subsequent emission of that event honours, with no call-site work. This is what makes an [[indicator-series]] cheap to introduce despite being sparsely sampled.

Two things it cannot know, which the call site therefore supplies: the domain payload (the card, the credit, the answer), and **which lives were touched** when the role pointers don't name them — true only for the three actions whose targets are neither emitter nor receiver. Everything else, including the event's `sessionId` and `gameStateId`, is derived.

A guard backs it up, refusing to build an event whose declared piece is absent or not a finite number. It earns its place catching what the producer cannot: an aggregate that has gone `NaN` from arithmetic on an uninitialised field is neither missing nor valid, and would otherwise be recorded as a real reading. *Avoid*: LK schema, event schema (that is the Mongoose document).

## Player State Sync / Decks State Sync

The two sibling [[last-known]] channels to the `table` room, each single-responsibility. `PLAYER_STATE_SYNC` carries `{ players: [{ idx, coinsLK, cardsLK, actionTokens }] }` for only the *concerned* players (both sides of a transaction, the giver + targets of an action, the whole alive set on DU). `DECKS_STATE_SYNC` carries `{ decks: [{ level, cards }] }` for only the deck *levels that changed*. Aggregates (`currentMassMonetary`, bank indicators) are **not** here — they ride their causing domain events (credit, DU, death). Emitted *in addition* to the unchanged player-facing events. *Avoid*: state broadcast, table update.

## Recipe

One letter at one weight, together with the distinct copies that completing it requires. Copies are individually keyed (`A01`…`A05`), so a player needs `amountCardsForProd` **different** copies of the same letter and weight — never several of the same one. Producing exchanges them for a card one weight up. *Avoid*: combination, set.

## Recipe Shape

The pair *(copies needed, copies minted)* that decides what a [[recipe]] costs: **triangle** 3-of-*n*, **square** 4-of-*n* (today's default, 4-of-5), **quinte** 5-of-*n*. Needed is `amountCardsForProd`, minted is `generatedIdenticalLetters`. The **ratio between them governs whether a table can produce at all**, far more than deck size does — 4-of-5 demands almost every copy of a letter, 3-of-5 demands a bare majority. "Square" stays the everyday word for a completed Recipe whatever the shape; it names the default, not the concept. *Avoid*: carré (when the general concept is meant).

## Ready Square

A [[recipe]] whose copies are all in **one hand** — the player can build now. Measures how fast the game resolves, so it is the tempo dial: many Ready Squares at once means production fires without negotiation, which is scarcity gone.

## Latent Square

A [[recipe]] whose copies exist across **all living hands** taken together — chaseable, because every copy still missing is held by someone who could sell it. This is the honest measure of whether a table can still produce, and the one a deck configuration is judged on. The tension the game wants lives in the gap between Latent (chaseable) and [[ready-square]] (done).

## Theoretical Square

A [[recipe]] whose copies exist **anywhere**, decks included. Never a promise to a player: a Recipe that is Theoretical but not [[latent-square]] is a chase that cannot succeed, since deck cards are unreachable until a production or a death recirculates them.

## Stranded Card

A copy sitting in a deck rather than a living hand, making a [[recipe]] look completable when it is not. The source of the animator conversation *"I asked everyone and my card isn't in the game"* — `whoHaveCard` answers `deck`, so the player learns their chase is doomed only after paying a token for the news. Decks are reachable only through production and [[reincarnate]], so a Stranded Card is inert until one of those fires. *Avoid*: dead card, missing card.

## Production Reveal

The player-facing celebration when a completed square (`amountCardsForProd` matching cards) is built. The existing square-zone box holds its position and swaps its ingredients-and-button content for the new leveled-up card, a rotating sunburst scaled to the box (not the screen), confetti, and "built"/"cards redrawn" text, for a fixed ~2.5s auto-dismiss (no tap needed) before the hand resolves to its new state. Scoped to the card-area only: unlike Reincarnate/Fault Lockout, the title bar and action buttons stay visible and interactive throughout, and other complete-but-unbuilt squares stay fully clickable underneath a visual dim — nothing is input-blocked. The new hand state (produced card + redrawn replacement cards) is deliberately **held** and only applied once the reveal completes, so the box isn't pulled out from under itself mid-animation. Every production gets the identical reveal regardless of `producedCard.weight` — there is no end-of-game/top-tier special case; the eventual "technology shift" endgame is unbuilt, unscoped future work, and production is deliberately treated as endless/circular until that's designed.
*Avoid*: production animation, build celebration, congrats dialog (retired).

## Session Results

The post-session debrief screen comparing the two games of one session face to face. Reads three sources with distinct roles: each **gameState** is authoritative for every end-state number (final coins, cards, statuses — and so for the podium, the Gini and [[ghost-money]]); the **persisted event stream** supplies only what varies over time, i.e. the curves; the **survey** answers supply the feelings radar. Splitting the roles this way means a gap in the event stream can distort a curve but can never corrupt a headline figure.

The survey is the one source that keeps arriving after the games are over, so the radar rebuilds on the `NEW_FEEDBACK` socket rather than snapshotting at load — on a revision as well as a first submission, since someone filling a survey late is exactly who reconsiders. That notification is deliberately **not** a game event: survey answers are their own collection, so nothing about it belongs in `DB_EVENTS` or the [[lk-contract]]. It carries no answers either, only who answered, so the page refetches. *Avoid*: results page (ambiguous — the legacy per-game view still lives at `ogame/:idGame/results`).

## Cards Included

The toggle governing how [[session-results]] draws player wealth, applying to both game columns at once. **On**: one chart per game, each [[life-incarnation]] a single line of coins + card value. **Off**: three charts stacked in the column — coins, card value, and a game-specific third (coins ÷ DU for the June game, net wealth `coins + cards − debt` for the debt game) — again one line per Life throughout. Purely a view concern: it never changes the [[avatar-score]], which sums coins and cards across all Lives whatever the toggle shows. *Avoid*: resources toggle, combined view.

**On** carries no [[indicator-series]] at all — its lines aggregate coins and card value *per player*, and no aggregate indicator is the sum of that. The money mass is coin-denominated, so it belongs only on the coins chart; drawing it here would put a line below the pack that reads as their envelope while understating it by the whole of goods in play. Aggregates therefore appear only in **Off**, where each chart has one unit and the summation identity that justifies co-location actually holds.

## Relative View

The June game's coins-÷-DU lines — what makes devaluation legible, since a holding that never moves still loses value as the DU grows. Derived from the finished absolute coins series rather than read from the event stream: each [[life-incarnation]]'s relative line is sampled at **its own coin vertices plus every DU vertex**, reading coins as the step function it is and dividing by the DU in force. Uniform across Lives — a `DEAD` Life is only the degenerate case where nothing but DU vertices remain, so its line becomes a pure downward staircase of [[ghost-money]] devaluing.

Deliberately *not* v1's mechanism, which persisted a synthetic `remind-dead` event per dead player per DU tick purely to produce graph vertices: that wrote a row per dead player per tick carrying no information, and still missed the alive holdings that devalue exactly the same way. Composing two declared series client-side needs no event and no [[lk-contract]] entry. *Avoid*: remind-dead, relative graph, devaluation curve.

## Avatar Score

What the podium ranks: the sum of an [[avatar]]'s wealth across **all** of its Lives — every Life's final coins plus its final card value, dead lives included. A Life's frozen `DEAD` snapshot *is* what that life accumulated, so it counts; that its cards were also cloned back into the decks is a supply mechanic, not an economic fact about the life.

Two consequences to respect. The coin half reconciles exactly — every coin sits in some Life and every Life belongs to an Avatar, so **Σ coins over Avatar Scores = the money mass**, and a dead Life's coins appear both here and in [[ghost-money]] as two lenses on the same coins ("what did this person accumulate" vs "which coins are stranded"). The card half deliberately does **not** reconcile: a recycled card is counted in the dead Life *and* in the hand that redrew it, so the Score's card component is a measure of accumulation, never of stock. It must never be presented alongside goods-in-play as if the two were addable.

Deliberately *not* the same as the coins curve either, which shows holdings at a moment and so never equals the Score for an Avatar that has died. *Avoid*: player score, final wealth.

## Data Health Block

A permanent panel on [[session-results]] listing every checked quantity with its agreement status: each [[indicator-series]]' last sample against the gameState's authoritative value, and each Life's last **LK sample** against its stored coins and card value. Values are integers, so agreement is exact equality — there is no tolerance.

The check must anchor on the last LK sample and never on the last plotted point, because every curve is deliberately closed at game-end time with the gameState's authoritative value so the lines span the round. Comparing the curve's final point would therefore compare that value with itself — a check that can only pass, on the one instrument built to notice a gap in the event stream. Beyond those end-state checks it reconciles the aggregates **at every vertex**, not only at the last one. An [[indicator-series]] that the [[lk-contract]] declares is also obtainable by summing the per-[[life-incarnation]] step functions — the money mass is Σ coins over Lives, goods in play is Σ card value over current Lives — and those are two genuinely independent readings of one quantity. The declared series stays the source of truth; the summed one is computed alongside purely to be compared against it. Any vertex where they part company gets a **red row naming the moment and the Life**, which is what turns "a number looks wrong" into "this event failed to carry its `playersLK`". A Life whose coins moved without an event declaring `P` is invisible to every other instrument and shows up here as the exact step where the two lines diverge.

It exists because the two data sources are deliberately different ([[session-results]]), so a silent disagreement between them would otherwise be indistinguishable from a true result. Animator-facing only, which holds by construction: results are reached from the animator's history screen, never from a player's device.

## Event Group

The filter taxonomy of the events log — transaction, credit, DU, death, seizure, action, system. **Many-to-many**: one event type may belong to several groups, because `player-died-with-seizure` is genuinely both a death and a seizure, and an animator filtering on either expects to find it. Filtering therefore tests membership rather than equality.

Because a type has no single group, groups are a **display concern only**. Every tally, count and series keys on `typeEvent` directly — reading the first of an event's groups would make the answer depend on declaration order. *Avoid*: event category, event kind.

## Ghost Cards

The cumulative card value held by `DEAD` Lives at the moment they died. Named as the counterpart to [[ghost-money]] but **not** the same kind of quantity, and the distinction matters: ghost money is *stranded* (those coins can never be spent again, yet stay inside `currentMassMonetary`), whereas ghost cards are *recycled* (the hand is cloned back into the weight decks and will be redrawn by someone else). Ghost cards therefore measures value that passed through dead hands over the session — churn — not value removed from play. Reading it as a stock, or adding it to goods-in-play, double-counts. *Avoid*: lost cards, destroyed goods.

## Indicator Series

An aggregate quantity of one game drawn against time — money mass, DU, total debt, the bank counters, [[ghost-money]], goods in play, average money per player. Every Indicator Series is a **step function**: it holds its value between the events that move it. So an indicator is declared only on its **concerned events** (the ones that actually move it), never on every event — sampling a transaction for the money mass would add a vertex carrying no information. Introducing a new indicator means naming which events must carry it in the [[lk-contract]]; that is a declaration rather than a migration, but games played before the change still hold no samples for it. Indicators are rendered stepped, never interpolated — a straight line between two samples would assert a gradual drift that never happened.

A **derived indicator** — [[average-money]] is the only one today — is composed from two declared series rather than by carrying game state forward: mass ÷ alive count, each read as the step function it is at the moment wanted. This is deliberately **not** the retired fold, which replayed the game's own rules (add the credit amount, subtract the transaction cost) and so could drift from the backend; reading a declared series at a point in time replicates no rule and cannot drift. A derived indicator's inputs therefore need not be co-sampled on the same event — `aliveCountLK` moves only on a [[life-incarnation]]'s birth and death and holds between them, so it is always known at any mass sample.

Indicators are **not given their own chart**: each is drawn alongside the [[life-incarnation]] lines it aggregates, in whichever chart shares its unit — the money indicators with coins, the goods indicators with card value. That co-location is the point: the mass genuinely *is* the sum of the coin lines and goods-in-play *is* the sum of the card lines, so separating them, or moving them to a second axis, would render a true relationship as a visual lie. Every coin-denominated series therefore shares **one linear axis**; only quantities that were never coin amounts (DU, average money per player) take the secondary axis. Crowding is handled by visibility instead of by splitting: legend toggling per series, plus select-all / unselect-all so a single series can be isolated. *Avoid*: metric, aggregate, stat.
