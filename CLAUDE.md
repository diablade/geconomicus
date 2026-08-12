# Project instructions

## Comments — JSDoc on functions, nothing else

Every function gets a `/** */` JSDoc block on top of it. Keep it **as simple as possible**: one plain sentence saying what the function does. Add `@param` / `@returns` only where the shape is not obvious from the signature. This applies everywhere — all of `back/`, all of `front/`, game code included — and supersedes the previous zero-comments rule (reversed 2026-08-11).

Nothing else is a comment. No `//` inline notes, no `/* */` blocks, no explainers beside a tricky line, no commented-out code. If a line needs explaining, either rename something so it explains itself, or let the function's JSDoc carry it.

Convey intent through clear naming and structure first; the JSDoc states the purpose, it does not narrate the body.

Existing pre-existing comments (e.g. the repo's own `// ── Section ──` banners) are the user's convention: don't add to them, and don't purge them on sight. Only remove a comment that a previous assistant turn added.

`back/tools/sim/` and `back/src/tools/` already follow this and carry richer JSDoc — offline research code whose reasoning (calibration choices, why a helper is reused or deliberately bypassed, what a threshold is a guess about) cannot be carried by naming alone. Do not strip it, and keep it current.

See memory `feedback_avoid_code_comments`.
