# AGENTS.md

## Overview

**Flit Web** is a SvelteKit 2.x application with TypeScript 5.x and vanilla CSS. It provides a client-side interface for a FastAPI backend, handling authentication, notes and category management, billing/subscription, profile, and connected apps.

## Tech Stack

- **Framework**: SvelteKit 2.x (SSR + SPA)
- **Language**: TypeScript 5.x (strict mode)
- **Styling**: Vanilla CSS with layers (reset, base, layout, components) and design tokens in `src/css/colors.css`. Entry: `src/css/style.css`. Reusable patterns must live in shared class-based CSS (`layout.css` and `components.css`). Do **not** use `<style>` blocks in Svelte files. Inline `style` is allowed only for truly dynamic runtime values (for example width percentages driven by state). Canonical class conventions: button variants use `btn-*` modifiers (`btn-primary`, `btn-secondary`, `btn-danger`), and card element classes use `card__*` naming.
- **Code Quality**: ESLint 9.x + Prettier 3.x
- **Build**: Vite 6.x
- **Note editor**: The note detail route (`(protected)/notes/[id]`) uses Tiptap 3 (`@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/markdown`) in [NoteMarkdownEditor.svelte](src/lib/components/NoteMarkdownEditor.svelte) for visual editing with GFM-oriented markdown (tables, task lists) and a **Markdown source** mode (plain textarea) toggled in the UI; persistence is always a markdown string via `getMarkdown()` / `setContent(..., { contentType: 'markdown' })`. **`+page.svelte` must dynamically `import()` that component only when `browser` is true** so ProseMirror/Tiptap are never loaded during SSR (a static import causes a 500). [vite.config.ts](vite.config.ts) lists those packages under `optimizeDeps.include` so Vite pre-bundles them at dev start (avoids broken `.vite/deps` responses when the editor chunk loads lazily). If the browser still reports corrupted / empty MIME for `.vite/deps`, delete `node_modules/.vite` and run `npm run dev:force`. Title and body autosave to the API with a 30 second trailing debounce (`debounceTrailing` in `src/lib/utils/debounce.ts`).

## Architecture Pattern

Client-driven API architecture with centralized API client handling HTTP communication, retry logic, and error recovery.

## Key Patterns

- **Svelte 5 Runes**: `$state`, `$derived`, `$effect` for reactivity
- **API Client**: Robust HTTP client with auto token injection, retry logic for safe methods (`GET`/`HEAD`/`OPTIONS`), timeout handling
- **Stores**: Svelte writable stores with localStorage persistence
- **Type-First**: TypeScript interfaces in `types/` aligned with backend specs

## Naming Conventions

- **Files**: PascalCase (Components, Types) / camelCase (Utilities, Stores) / kebab-case (Routes)
- **Variables**: camelCase (private methods), UPPER_SNAKE_CASE (constants)
- **State**: `$state()` for values, `$derived()` for computed, `$effect()` for side effects

## Folder Structure

```
src/
├── css/            # Vanilla CSS: _reset.css, base.css, colors.css, layout.css, components.css, style.css
├── lib/
│   ├── api/        # API client (ApiClient class)
│   ├── assets/     # Static assets (favicon, etc.)
│   ├── components/ # Reusable Svelte components (e.g. GeneralErrorAlert, NoteMarkdownEditor)
│   ├── stores/     # Global state (authStore, pendingColorScheme, etc.)
│   ├── types/      # TypeScript definitions
│   └── utils/      # Helper functions (auth, validation, error-handler, debounce)
└── routes/         # SvelteKit pages/layouts
    └── (protected)/ # Auth guard layout; profile and notes live here
```

## Essential Workflows

1. **Development**: `npm run dev` → checks with `npm run check` → lint with `npm run lint` → format with `npm run format`
2. **Tests**: `npm run test` (watch), `npm run test:run` (single run), or `npm run test:coverage` for thresholds/reporting. Use `npm run ci:check` before merging.
3. **API Usage**: Always use `apiClient` methods (no raw fetch)
4. **State**: Use `$state` for local, `authStore` for global auth state
5. **Error Handling**: Use `captureApiError(err, context)` in catch blocks for handle + log + user message; use `handleApiError` + `formatErrorForUser` when you need the error object
6. **Auth**: Protected routes live under `(protected)/`; layout redirects unauthenticated users to `/login`. Use `isAuthenticated` derived store for UI.
7. **Billing**: Public route [`src/routes/billing/+page.svelte`](src/routes/billing/+page.svelte) — guests see About/Terms/Billing in the top bar and pick Free or paid plans (selection stored in `sessionStorage` via [`billing-selection.ts`](src/lib/utils/billing-selection.ts), then `/register` → `/login` → `/notes` or checkout). Logged-in users open billing only from the Profile page button; checkout `return_url` is `/billing`. Components: [`src/lib/components/billing/`](src/lib/components/billing/).
8. **Index redirect**: `/?redirect=login` or `/?redirect=register` redirects unauthenticated users for deep-linking from outside the SPA (e.g. `core.flit-pkm.com/?redirect=login`). Login post-auth redirects use [`navigation.ts`](src/lib/utils/navigation.ts) (`resolvePostLoginDestination`) for safe internal paths and billing callback query params. Legacy checkout returns to `/` forward to `/billing`.
9. **OpenAPI**: Always confirm Flit-Core API endpoints using `curl http://localhost:8000/openapi.json` in the terminal

## HTML rendering and XSS

- **Never** use `{@html}` with raw user input or API strings.
- The only allowed `{@html}` sink is note list previews via `markdownToSafeHtml()` in [`src/lib/utils/markdown.ts`](src/lib/utils/markdown.ts) (Marked + DOMPurify). ESLint allows `@html` only on [`notes/+page.svelte`](<src/routes/(protected)/notes/+page.svelte>).
- All other dynamic text uses `{expression}` bindings (Svelte auto-escapes).
- `sanitizeInput()` in auth utils does **not** strip HTML; it preserves credentials for forms.

## Third-party scripts

Google Sign-In and Cloudflare Turnstile are loaded without SRI (vendors do not ship stable integrity hashes). Prefer CSP `script-src` allowlists for `accounts.google.com` and `challenges.cloudflare.com` when deploying CSP.

## Client-side login rate limit

`loginRateLimiter` in [`src/lib/utils/auth.ts`](src/lib/utils/auth.ts) is a **UX deterrent only** (localStorage/session timing). Server-side rate limits are authoritative.

## Critical Rules

- Never hardcode secrets; use `.env` for `VITE_API_BASE_URL`
- Configure frontend log verbosity with `VITE_LOG_PROFILE` (`debug`, `test`, `deploy`) and keep route/component logs on `errorLogger` instead of raw `console.*`
- Implement debouncing for search/filter inputs
- Persist tokens in localStorage only (check `browser` env)
- Handle 401 errors by clearing token and redirecting
- Use `flit-*` color classes and design tokens from `src/css/colors.css` and shared layout/component classes consistently; use inline styles only for dynamic runtime values
- Keep global CSS valid vanilla CSS syntax only (no Svelte-only selectors like `:global(...)` in `src/css/*.css`)
- New classes must be added intentionally to shared CSS before use; avoid placeholder/undefined class hooks in markup

## CSS Class Audit Guardrails

- Treat these as allowlisted when auditing for undefined classes:
  - `cf-turnstile` (Cloudflare Turnstile-required class in auth forms)
  - Dynamic interpolated class prefixes such as `strength-bar__fill--{level}` and `strength-bar__label--{level}` (verify concrete numeric variants exist in shared CSS)
- Class-audit workflow:
  1. Detect used-but-undefined classes across `src/**/*.svelte`
  2. Detect defined-but-unused selectors in `src/css/*.css`
  3. Exclude allowlisted third-party/dynamic patterns
  4. Remove only high-confidence orphans in atomic changes
