# Components (`src/lib/components`)

## Role

Reusable UI. Domain folders: `billing/`, `notes/`, `profile/`. No `<style>` blocks — shared CSS only.

## Invariants

- TipTap editor (`NoteMarkdownEditor.svelte`) must be dynamically imported from the browser only
- Note list preview HTML goes through `markdownToSafeHtml` (`NoteListCard.svelte`)
- Prefer `GeneralErrorAlert` over copy-pasted alert SVG markup when touching error UI

## Prefer / avoid

- Prefer panels over growing page scripts further without need
- Avoid inventing a notes store

## Ceiling

Large sections (`ConnectedAppsSection`, `BillingSection`) are acceptable until the next feature forces a split.

## See also

- [AGENTS.md](../../../AGENTS.md)
- [../../css/AGENTS.md](../../css/AGENTS.md)
