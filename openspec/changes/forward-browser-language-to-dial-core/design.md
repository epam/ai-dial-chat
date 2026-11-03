# Design — forward-browser-language-to-dial-core

## Context

The browser timezone already flows app → `X-Timezone` BFF header → validated `assertValidOptionalTimezone` → request-local parameter through the streaming service → both generation adapters → DIAL Core. Language needs the identical pipeline with a fixed `X-Lang` header name (the header DIAL Core is configured to read for language-sensitive behavior; `PROXY_LANGUAGE_HEADER` is a DIAL Core setting, not a chat variable — the legacy chat's same-named variable named the outbound header, with default `accept-language` since #8377).

## Decisions

- **Fixed header name `X-Lang`** (not a configurable env in chat-api as legacy PR #6488 did): one less configuration surface, matches `X-Timezone`'s design. `PROXY_LANGUAGE_HEADER` is a DIAL Core setting naming the header Core reads, which deployments point at `X-Lang`; the legacy chat's same-named variable (default `accept-language` since #8377) is not carried over — recorded in `docs/legacy-chat-migration-guide.md`.
- **Source of the language is the app's current i18n locale** (the language the user chose for the UI), not `navigator.language`: the user's UI choice is the best predictor of the language they expect documents and names in. Resolution happens at the application edge; `libs/chat-hooks` receives only an injected `getLanguage` dependency, same host-capability pattern as `getTimezone`.
- **Validation mirrors timezone validation**: single value only, length cap (35), a BCP-47-like allowlist pattern (`/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/`) so the value can safely reach an upstream header unchanged, rejected with `400` before DIAL Core is called.
- **Request-local threading**: the value stays a function parameter through responder → streaming service → background service → adapters; it never lands on a singleton SDK client.
- **Both generation APIs forward it** (`chat-completions.adapter.ts` and `responses.adapter.ts`), so behavior does not depend on the internal generation-API selection.
- **OpenAPI regeneration** (`npm run openapi`) documents the header; the frontend raw SSE transport keeps its own `fetch` path and sends the header itself.

## Risks / Notes

- No logs, metrics, or persistence of the value.
- Missing header is fully backward compatible.
