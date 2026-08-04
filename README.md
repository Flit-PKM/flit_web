# Flit Web

SvelteKit client for the Flit Core FastAPI backend: notes, categories, billing, profile, and connected apps.

Stack: SvelteKit 2 + TypeScript 5 + vanilla CSS (`src/css/`). Production build uses `@sveltejs/adapter-static` (SPA fallback `200.html`).

## Setup

```sh
npm install
cp .env.example .env
```

Configure as needed (see `.env.example`):

| Variable                  | Purpose                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL`       | Dev API origin (default `http://localhost:8000`). Production uses same origin as the page. |
| `VITE_LOG_PROFILE`        | `debug` / `test` / `deploy` log verbosity                                                  |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (register / forgot-password)                                 |
| `VITE_GOOGLE_CLIENT_ID`   | Google Sign-In web client ID                                                               |
| `VITE_SITE_ORIGIN`        | Canonical origin for SEO / sitemap                                                         |

## Develop

```sh
npm run dev
```

Backend OpenAPI (source of truth for API shapes): `curl -s http://localhost:8000/openapi.json`

## Check / test / build

```sh
npm run check
npm run lint
npm run test:run          # unit tests
npm run ci:check          # check + lint + coverage
npm run build             # sitemap + Vite build
npm run preview
```

Agent-oriented conventions live in [AGENTS.md](AGENTS.md) and child `AGENTS.md` files under `src/`.
