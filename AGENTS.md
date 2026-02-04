# AGENT.md

## Overview

**Flit Web** is a SvelteKit 2.x application with TypeScript 5.x and Tailwind CSS 4.x. It provides a client-side interface for a FastAPI backend, handling authentication, notes management, and category organization.

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
│   ├── api/      # API client (ApiClient class)
│   ├── components/  # Reusable Svelte components
│   ├── stores/   # Global state (authStore, etc.)
│   ├── types/    # TypeScript definitions
│   └── utils/    # Helper functions
└── routes/       # SvelteKit pages/layouts
```

## Essential Workflows

1. **Development**: `npm run dev` → checks with `npm run check` → lint with `npm run lint` → format with `npm run format`
2. **API Usage**: Always use `apiClient` methods (no raw fetch)
3. **State**: Use `$state` for local, `authStore` for global auth state
4. **Error Handling**: Wrap in `try-catch` with `handleApiError()` utility
5. **Auth**: Check `isAuthenticated` before protected routes, redirect with `$effect`
6. **OpenAPI** Always confirm the Flit-Core api endpoints using 'curl http://localhost:8000/openapi.json' in the terminal

## Critical Rules

- Never hardcode secrets; use `.env` for `VITE_API_BASE_URL`
- Implement debouncing for search/filter inputs
- Persist tokens in localStorage only (check `browser` env)
- Handle 401 errors by clearing token and redirecting
- Use `flit-*` Tailwind color conventions consistently
