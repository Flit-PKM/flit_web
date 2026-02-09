# AGENTS.md

## Overview

**Flit Web** is a SvelteKit 2.x application with TypeScript 5.x and Tailwind CSS 4.x. It provides a client-side interface for a FastAPI backend, handling authentication, notes and category management, billing/subscription, profile, and connected apps.

## Tech Stack

- **Framework**: SvelteKit 2.x (SSR + SPA)
- **Language**: TypeScript 5.x (strict mode)
- **Styling**: Tailwind CSS 4.x (utility-first)
- **Code Quality**: ESLint 9.x + Prettier 3.x
- **Build**: Vite 6.x

## Architecture Pattern

Client-driven API architecture with centralized API client handling HTTP communication, retry logic, and error recovery.

## Key Patterns

- **Svelte 5 Runes**: `$state`, `$derived`, `$effect` for reactivity
- **API Client**: Robust HTTP client with auto token injection, retry logic (3 attempts), timeout handling
- **Stores**: Svelte writable stores with localStorage persistence
- **Type-First**: TypeScript interfaces in `types/` aligned with backend specs

## Naming Conventions

- **Files**: PascalCase (Components, Types) / camelCase (Utilities, Stores) / kebab-case (Routes)
- **Variables**: camelCase (private methods), UPPER_SNAKE_CASE (constants)
- **State**: `$state()` for values, `$derived()` for computed, `$effect()` for side effects

## Folder Structure

```
src/
├── lib/
│   ├── api/        # API client (ApiClient class)
│   ├── assets/     # Static assets (favicon, etc.)
│   ├── components/ # Reusable Svelte components (e.g. GeneralErrorAlert)
│   ├── stores/     # Global state (authStore, pendingColorScheme, etc.)
│   ├── types/      # TypeScript definitions
│   └── utils/      # Helper functions (auth, validation, error-handler)
└── routes/         # SvelteKit pages/layouts
    └── (protected)/ # Auth guard layout; profile, notes, billing live here
```

## Essential Workflows

1. **Development**: `npm run dev` → checks with `npm run check` → lint with `npm run lint` → format with `npm run format`
2. **Tests**: `npm run test` (watch) or `npm run test:run` (single run). New logic should be covered by unit tests (auth utils, error-handler, validation).
3. **API Usage**: Always use `apiClient` methods (no raw fetch)
4. **State**: Use `$state` for local, `authStore` for global auth state
5. **Error Handling**: Use `captureApiError(err, context)` in catch blocks for handle + log + user message; use `handleApiError` + `formatErrorForUser` when you need the error object
6. **Auth**: Protected routes live under `(protected)/`; layout redirects unauthenticated users to `/login`. Use `isAuthenticated` derived store for UI
7. **OpenAPI**: Always confirm Flit-Core API endpoints using `curl http://localhost:8000/openapi.json` in the terminal

## Critical Rules

- Never hardcode secrets; use `.env` for `VITE_API_BASE_URL`
- Implement debouncing for search/filter inputs
- Persist tokens in localStorage only (check `browser` env)
- Handle 401 errors by clearing token and redirecting
- Use `flit-*` Tailwind color conventions consistently
