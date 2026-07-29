# Project instructions

## No code comments — hard rule

Never add comments to code you write or modify. Not `//`, not `/* */`, not `/** */` / JSDoc, not a one-line "explainer" for a non-obvious bit. Zero. This overrides any default habit and any subagent or skill guidance that says to add JSDoc, "document" a function, or annotate code.

Convey intent through clear naming and structure instead. If something feels like it needs explaining, make the name or the shape carry the meaning — or ask.

Applies everywhere, including work done via `/grill-with-docs`, `/implement`, and the `mean-v2-engineer` subagent. "Docs" produced by `/grill-with-docs` means ADRs and glossary/markdown files — never inline code comments.

Existing pre-existing comments (e.g. the repo's own `// ── Section ──` banners) are the user's convention: don't add to them, and don't purge them on sight. Only remove a comment that a previous assistant turn added. See memory `feedback_avoid_code_comments`.
