# Results renders one fiche per game rather than pairing debt with libre

The v2 results page (`results/:sessionId`) was built for exactly two games, one of each money. A session is moving to as many as four games of any mix — two debt runs at different bank profiles, three libre runs, four of whatever the animator configures — and the page could not show the third.

The obstruction was not a loop bound. `GameKey = 'dette' | 'libre'` was the spine of the component: `SynthesisRow` and `ActionRow` were two-field records, `chartRows` paired blocks by index, `scoreBars` was a two-key map, `partial` meant "one of the two is missing", and `.cp-two-cols` was a literal `1fr 1fr`.

Underneath it sat a defect that fired before any of that. Games were resolved by money type:

```ts
this.detteGsId = rules.find((r) => r.typeMoney === GAME_TYPE.DEBT)?.gameStateId ?? '';
```

`GAME_TYPE` holds only `june` and `debt`, so the moment a session ran two debt games the `find` returned the first and the second became unreachable — no error, no empty column, simply absent. `Rules` is already an ordered array carrying `idx` and `gameStateId`; the money type was never an identity and cannot be one.

## Decision

**A game is a fiche.** Every game of the session gets one card, rendered side by side in `rules` order, carrying everything about that game: its headline figures, its money-type block, its wealth curve, its ranking, its feelings cloud, and — folded away — its details and its data health. There is no reduced density and no second template; the fiche is the only unit the page knows.

Identity comes from the rules index and the money type together — "Dette 1", "Dette 2", "Libre 1" — which retires the `typeMoney` lookup for a plain map over `rules` and fixes the defect above as a side effect.

A chip strip above the fiches carries one chip per game with its two comparable figures, and toggles a game off the page; the last one cannot be removed. Selection is view state, never stored.

### The fiche is the scroll unit, not the page

The page is a screen-height shell: header, chips, then a region that takes the rest. Nothing in it scrolls except two things.

- Each fiche keeps a **fixed head** — colour mark, name, configuration, duration — over a body that scrolls on its own. The reader always knows which game they are looking at, however far down that column they have gone.
- The **rail** of fiches scrolls horizontally. Columns are `minmax(340px, 1fr)`, so up to about four fiches share the width and the fifth pushes the rail into overflow rather than crushing the others.

The events drawer keeps the full remaining height beside them, still holding every game of the page with its own in-drawer selector.

### Money-type rows stop being a problem

The previous draft of this decision proposed emitting a synthesis row only where a selected game had a value, to kill the ten-of-twenty-one `'-'` cells the two-column layout padded with.

The fiche layout dissolves that question instead of answering it. There are no shared cells, so there is nothing to pad: a libre fiche renders a DU block, a debt fiche renders a bank block, and neither is aware of the other. The dash disappears because the layout has no place to put one.

### What the fiche shows

Four headline figures every game has, whatever its money: **transactions**, **productions**, **ressources en jeu** and **masse monétaire**, the last two as `début → fin`. Then the money-type block — DU, its count and ghost money in DU for libre; total debt, credits, interest, seizures, money lost and destroyed, goods seized for debt.

Start-to-end figures carry a **growth percentage**. It is rendered in neutral grey, never green or red: a monetary mass that doubles in a debt game is the lesson, not good news, and colouring it would argue the opposite of what the game teaches. Where the start is zero — total debt, always — no percentage is shown.

Everything that does not separate one run from another is demoted into the folded details: players, lives, deaths, rebirths, exchanged value, average money, ghost money and goods, the action tallies, and the first-credit decisions. These are session configuration or footnotes, not results.

### Borrowing a game from another session

A game of any other session can be dropped beside the current ones, picked through a dialog: `session/all` for the list, then `session/:id` for that session's games, since the list endpoint projects `gamesRulesCount` and not `gamesRules`.

A borrowed game is computed against **its own** session's events and avatars, never this one's, and is marked as borrowed on its chip and its fiche. Nothing about it is persisted — not in the URL, not in storage — so a reload returns the page to the session's own games. That is the whole of its lifecycle, and it is deliberate: a borrowed comparison is something an animator does while talking, not a saved configuration.

## Considered options

- **Keep the two-game face-to-face and add a third column.** The literal request. Rejected: it is the `GameKey` spine again with one more key, and the padding problem grows with every game added.
- **A metric-major grid — games as columns, indicators as rows.** Genuinely good at "which number differs", and it was drawn and compared against the fiches. Rejected after seeing both: it reads as a table, it is weak from the back of a room, and `début → fin` degenerates into two numbers in a cell. The cost of rejecting it is real and worth stating — cross-game comparison is the thing fiches serve *least* well, because the eye must travel a column's width to find the same indicator twice.
- **An overview / detail / compare state machine keyed on how many games are selected.** The previous draft of this ADR. Rejected: two densities to build and keep honest, when the fiche already degrades gracefully by scrolling, and "I want fewer games" and "I want less detail" are not the same wish.
- **Bar rows on a scale shared across games, as the overview's punchline.** Rejected with the state machine that carried it. The comparison it offered now lives in the chips' two figures and in the fiches sitting next to each other.
- **A radar over the four games.** Rejected: it tops out at two or three series before the fills occlude each other, and these values want precise reading rather than silhouette.
- **Persisting a borrowed game in the URL.** Rejected: it makes a shareable link that depends on another session's lifetime, and it turns a conversational gesture into state somebody has to clean up.
- **Add a `name` field to `Rules` so the animator titles each game.** Deferred. The derived label answers identity for the mix we can build today; a stored name is a model change, a migration and a lobby control for a need nobody has stated.

## Consequences

- `GameKey`, `dette`, `libre`, `detteGsId`, `libreGsId`, `partial`, `detteCharts`, `libreCharts`, `chartRows`, `chartDetteFeel`, `chartLibreFeel`, `synthesisRows`, `goodActions`, `badActions`, `podiumCards` and `cardsIncluded` are deleted. They are replaced by a `GameCard[]` in `rules` order, a `selected: Set<string>` and a `shown` getter. `scoreBars` becomes a `Set<string>`; the two section booleans become per-fiche `Set<string>`s, so folding details open on one game does not open them on all.
- `SessionResultsService` keeps its per-game signature and needed no restructuring — it already took one `gameState` and returned one `GameResults`, which is why the page could go generic without touching the data layer. It gains four fields on `GameSynthesis`: `productions` (a counter plus a `DB_EVENTS.PRODUCTION` branch — the event was always emitted and never counted, despite production being the game's core economic act), `massFirst` and `goodsFirst` (the first point of series it already built, exactly as `debtFirst` and `duFirst` are derived), and `durationMin` from `gameTimers.startedAt` to the game's end.
- The wealth section moves inside the fiche as a four-way switch — Richesse, Monnaie, Ressources, and then `Relatif (DU)` for libre or `Richesse nette` for debt. This is the same `combined` / `coins` / `cardsValue` / `third` series the service already returned; only the framing changed. The page-level "Comptes" section is gone.
- Chart options are built once per block instead of from the template. A method call in an `[options]` binding returns a fresh object on every change-detection cycle, which re-renders the chart; with one chart per fiche and N fiches that multiplies.
- Feelings datasets take a fixed colour per survey dimension instead of `getRandomColor()`. Comparing the bubble clouds between games is the reason the section exists, and it is impossible when the same question is a different colour in each fiche and reshuffles on every incoming `IO.SESSION.NEW_FEEDBACK`.
- Two ZWJ emoji used as icons are removed — `ACTION_ASSOCIATION` becomes a single codepoint, and the `VS16` variation selectors are dropped. Per the Twemoji finding these are the sequences that take a phantom advance on iPhone.
- `<app-events-v2>` is unchanged and stays beside the fiches in every state. It already accepted `games` as an array; the results page was the outlier.
- ADR-0012's source roles are untouched. What changes is only how many fiches read them, and its aside that "the page compares them as two columns" is superseded by this.

### Still open

- **The component's French string literals have not moved to a feature-folder `fr.json`.** `<app-language-btn>` is still sitting in the header with nothing to switch.
- **The mobile player view is designed but not built.** Fiches stack below 1100px, which is legible, but the player-facing lens — one player's position and figures across the games, with a switch between one player and everyone — does not exist. Mobile is the players' surface; the fiches are the animator's.
- **`session/all` has no pagination or filter.** The borrow dialog searches client-side over whatever the endpoint returns, which is fine now and will not be.
