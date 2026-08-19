# API (`src/lib/api`)

## Role

Single HTTP client for Flit Core. All browser → backend traffic goes through `apiClient`.

## File map

| File        | Notes                                                          |
| ----------- | -------------------------------------------------------------- |
| `client.ts` | `ApiClient`, `HttpError`, `formatApiDetail`, `getMcpServerUrl` |

## Invariants

- Use `apiClient` methods — no raw `fetch` in routes/components (vault blob export is the intentional exception inside the client)
- Retry only GET/HEAD/OPTIONS
- 401 clears token and dispatches `auth:expired` (`skipAuthExpired` on logout revoke)
- Login sliding renewal is `POST /auth/refresh`; logout revoke is `POST /auth/logout`
- Confirm paths/schemas against `curl -s http://localhost:8000/openapi.json`

## Prefer / avoid

- Prefer extending `ApiClient` methods in this file
- Avoid splitting until a large domain forces it — **ceiling:** ~800+ LOC god module; extend carefully

## See also

- [AGENTS.md](../../../AGENTS.md)
- [../utils/AGENTS.md](../utils/AGENTS.md)
