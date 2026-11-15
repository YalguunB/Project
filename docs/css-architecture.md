# CSS architecture

Exactly four CSS files live in `src/styles/`. `build.sh` concatenates them in this order into the page:

| # | File | Contains |
|---|------|----------|
| 1 | `tokens-primitive.css` | `@layer` order, `@property` role registrations, raw values: color ramps, spacing, radius, borders, blur, easing, durations, z-index |
| 2 | `tokens-brand.css` | One block per mood (`default`, `tide`, `dusk`, `ember`, `forest`) picking primitives for `--brand-*` and `--scheme` |
| 3 | `tokens-semantic.css` | Roles used by components (`--page`, `--surface`, `--text`, `--muted`, `--accent`, `--accent-text`, `--glow`, `--border-color`, `--positive`, `--danger`), alpha tokens (`--accent-a14` ...), `--border`, `--focus-ring`, mood transition |
| 4 | `component.css` | Base reset, every component and feature style, keyframes, and flat `@media` blocks at the end |

## Rules

- Token flow: primitive -> brand -> semantic -> component. Components use only semantic tokens and spacing/radius/duration/z primitives. Never write a raw hex in `component.css`.
- Token files are layered (`primitives`, `brand`, `semantic`). `component.css` is deliberately unlayered so it always wins over platform and bootstrap styles.
- Native CSS nesting, at most 3 levels deep.
- `@media` blocks are not nested; they sit at the end of `component.css`.
- Reuse classes. A similar design must share the existing class instead of getting new CSS.
- `component.css` is shared by all four developers: keep the section comments (`/* === feature: name === */`) and only edit your own feature's section to avoid merge conflicts.

## Moods

`<html data-mood="tide|dusk|ember|forest">` swaps the `--brand-*` values only. Registered `@property` roles transition over 0.9s. `dusk` sets `--scheme: dark`.

## Adding a mood

Add one block in `tokens-brand.css`, plus its primitives in `tokens-primitive.css` if new colors are needed. `component.css` does not change.

## Not done yet

- px values are not tokenized and components have no local tokens.
- Breakpoints are not consolidated.
- `src/visuals/gl.js` repeats the mood palette hex values.
- No Stylelint rule yet for nesting depth or raw colors.

## JS structure (for reference)

`src/core/` shared code, `src/features/<name>/` one folder per feature with an `index.js` that registers `VIEWS`, `ACT` and `AFTER` entries, `src/visuals/`, `src/data/places/`. File order is listed in `build.sh`.
