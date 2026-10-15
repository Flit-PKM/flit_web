# Routes (`src/routes`)

## Role

SvelteKit pages. Public marketing/auth/billing vs `(protected)/` (notes, profile).

## Invariants

- Auth gate is client-side in `(protected)/+layout.svelte` — not a security boundary
- Note detail: dynamic TipTap import; autosave + `beforeunload` / visibility flush
- Billing: consume pending paid plan only when starting auto-checkout
- Google / password success must not call `resolvePostLoginDestination` from `AuthCredentialsForm` (login and landing `$effect` own redirect)
- `/register` redirects to `/login?mode=register`; unified credentials form lives on `/login` and the landing guest card

## Prefer / avoid

- Prefer page orchestration + extracted panels over new global stores
- Ceiling: note detail / profile / notes list page scripts are large — shrink only when touching that area

## See also

- [AGENTS.md](../../AGENTS.md)
