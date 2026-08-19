# Stores (`src/lib/stores`)

## Role

App-wide Svelte stores.

| Store                                             | Persistence                             |
| ------------------------------------------------- | --------------------------------------- |
| `auth.ts`                                         | localStorage `auth_token` / `auth_user` |
| `theme.ts`, `confirmDialog.ts`, `noteListSync.ts` | ephemeral                               |

## Invariants

- Auth requires **token and user**; orphan tokens are cleared
- `auth:expired` listener is bound at module load (browser)
- Sliding login refresh runs ~5 minutes before JWT `exp` (timer + `visibilitychange`); logout revokes the server JWT then clears local auth
- `(protected)` layout is UX only — API Bearer is authoritative

## See also

- [AGENTS.md](../../../AGENTS.md)
- [../utils/AGENTS.md](../utils/AGENTS.md)
