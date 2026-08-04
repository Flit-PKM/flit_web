# CSS (`src/css`)

## Role

Vanilla CSS design system. Entry: `style.css`. Layers: reset, base, colors, layout, components, primitives.

## Invariants

- No `<style>` in Svelte files
- No Svelte-only selectors (`:global(...)`) in these files
- Add classes to shared CSS before using them in markup

## Ceiling

`components.css` is a god stylesheet (~2k+ LOC). Split by domain only when actively editing a large slice; primitives already live in `components-primitives.css`.

## See also

- [AGENTS.md](../../AGENTS.md)
