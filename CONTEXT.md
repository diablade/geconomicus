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
