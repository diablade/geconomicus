# Project instructions

## Comments — JSDoc on functions, nothing else

Every function gets a `/** */` JSDoc block on top of it. Keep it **as simple as possible**: one plain sentence saying what the function does. Add `@param` / `@returns` only where the shape is not obvious from the signature. This applies everywhere — all of `back/`, all of `front/`, game code included — and supersedes the previous zero-comments rule (reversed 2026-08-11).

Nothing else is a comment. No `//` inline notes, no `/* */` blocks, no explainers beside a tricky line, no commented-out code. If a line needs explaining, either rename something so it explains itself, or let the function's JSDoc carry it.

Convey intent through clear naming and structure first; the JSDoc states the purpose, it does not narrate the body.

Existing pre-existing comments (e.g. the repo's own `// ── Section ──` banners) are the user's convention: don't add to them, and don't purge them on sight. Only remove a comment that a previous assistant turn added.

`back/tools/sim/` and `back/src/tools/` already follow this and carry richer JSDoc — offline research code whose reasoning (calibration choices, why a helper is reused or deliberately bypassed, what a threshold is a guess about) cannot be carried by naming alone. Do not strip it, and keep it current.

See memory `feedback_avoid_code_comments`.

## i18n — no user-visible string literals

Any text a user can read is a translation key, never a literal. This applies to `front/` templates and TypeScript, and to `back/` responses.

```html
<!-- no -->
<mat-checkbox [(ngModel)]="session.devMode">Dev Mode</mat-checkbox>
<!-- yes -->
<mat-checkbox [(ngModel)]="session.devMode">{{ 'MASTER.DEV_MODE' | translate }}</mat-checkbox>
```

In TypeScript use `i18nService.instant('KEY')` — toasts, snackbars, dialog text and chart labels all count. Exempt: `console.*`, log messages, test fixtures, and `aria-label` values that are already keys.

**Where the key goes.** `front/src/assets/i18n/<feature>/fr.json` holds keys for one feature. `front/src/assets/i18n/fr.json` (no folder) holds words shared across features — `ERROR.*`, `SOCKET.*`, `DIALOG.*`, `CARD.*`, `GAME.*`, and bare words like `CANCEL` / `CLOSE` / `SAVE`. Anything reached from a global service (`ErrorService`, `WebSocketService`) or from more than one feature goes in the root file.

**A namespaced key only resolves if the component loaded it.** Adding `MASTER.DEV_MODE` requires the component to call `i18nService.loadNamespace('master')` in `ngOnInit`. Without it the raw key renders on screen.

**Never give a root key and a namespace key the same top-level name.** ngx-translate v14 `mergeDeep` recurses whenever the key already exists, so merging namespace `{"TUTORIAL": {...}}` onto root `"TUTORIAL": "Comment jouer ?"` destroys the whole namespace subtree and renders `[object Object]`. It fails silently — no console error.

**Write `fr.json` only.** French is the source language; the other seven (`en`, `it`, `de`, `es`, `ja`, `ro`, `sr`) are a separate pass the user runs. Adding a key to all eight files unasked is churn.

**Backend emits keys too.** `res.json({ message: 'ERROR.X' })` flows through `ErrorService.handleError` → `i18nService.instant()`. Returning raw English prose from `back/` reaches the user untranslated, because `SnackbarService` does not translate. Some legacy responses still do this — don't add more.
