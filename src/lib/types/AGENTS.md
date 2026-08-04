# Types (`src/lib/types`)

## Role

TypeScript shapes aligned with Flit Core OpenAPI. Prefer updating types when the OpenAPI spec changes (`curl -s http://localhost:8000/openapi.json`).

## Prefer / avoid

- Prefer normalizers in types (e.g. MCP / connect id-field drift) over forking in every caller
- Avoid unused exported interfaces

## See also

- [AGENTS.md](../../../AGENTS.md)
- [../api/AGENTS.md](../api/AGENTS.md)
