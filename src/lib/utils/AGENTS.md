# Utils (`src/lib/utils`)

## Role

Pure helpers and shared trust-boundary logic: auth validation, errors, billing selection, navigation allowlists, markdown sanitization, debounce.

## File map (high traffic)

| Area          | Files                                                                   |
| ------------- | ----------------------------------------------------------------------- |
| Auth / forms  | `auth.ts`, `auth-forms.ts`, `validation.ts`                             |
| Errors        | `error-handler.ts` (`captureApiError`, `handleApiError`, `errorLogger`) |
| Billing / nav | `billing-selection.ts`, `billing.ts`, `navigation.ts`                   |
| Notes         | `markdown.ts`, `note-*.ts`, `debounce.ts`                               |
| SEO           | `seo.ts`                                                                |

## Invariants

- Log once via `handleApiError` / `captureApiError` — do not re-log already-handled `AppError`
- JWT decode via `decodeJwtPayload` (base64url), never raw `atob` alone
- `{@html}` only after `markdownToSafeHtml` or `escapeJsonLd`
- `loginRateLimiter` is UX-only (in-memory)

## Prefer / avoid

- Fix bugs in the shared helper, not per caller
- Avoid new form frameworks; keep `validate*Form` + optional live `FormValidator` rules aligned

## See also

- [AGENTS.md](../../../AGENTS.md)
