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
