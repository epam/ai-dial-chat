## Context

`apps/chat-api` proxies every DIAL Core call itself; there is no single request-scoped interceptor that injects arbitrary headers — each service builds its own `headers` object per call (see `dial-core-client` for the one exception, the globally-applied `User-Agent`). The existing `X-CONVERSATION-ID` header (`common/utils/header-value.ts`) is the closest precedent: a small `buildXHeaders(value)` helper, spread manually into each call site's `headers`, with percent-encoding to keep the value a legal HTTP field value.

Session state is a flat, allowlisted claims bag: `AuthController.callback()` copies a fixed set of OIDC ID-token claims into `SessionPayload.claims` (encrypted session cookie) at login; `SessionUser.claims` is the same shape once a request is authenticated. Nothing outside that allowlist survives into the session for cookie-authenticated callers. Header-token (JWT bearer) callers bypass the allowlist entirely — `HeaderTokenStrategy` puts the full verified JWT payload on `SessionUser.claims`.

## Goals / Non-Goals

**Goals:**

- Restore the `X-JOB-TITLE` header on exactly the five DIAL Core request types the old `development-old` Next.js chat sent it on: chat completion (streaming), models list, default-model, rate, transcribe.
- Source the value from the same origin as before: the OIDC `job_title` claim resolved at login.
- Keep the value request-scoped — no shared/singleton state, no persistence beyond the existing session cookie.
- Match the existing `X-CONVERSATION-ID` pattern so the two per-request custom headers stay symmetric and easy to read side by side.

**Non-Goals:**

- No new REST endpoint, DTO field, or OpenAPI-visible contract change.
- No new provider configuration (unlike `rolesClaim`, `job_title` is not made configurable per-provider — the old chat used a fixed claim name and this preserves that).
- No frontend or `libs/*` change — the header is entirely a BFF-to-DIAL-Core concern, invisible to the browser.
- No change to caching behavior of the deployments list (job title does not affect response content, so it is not part of the cache key).

## Decisions

**Fixed allowlist entry, not a configurable claim.** `job_title` is added to `auth.controller.ts`'s `ALLOWED_CLAIM_KEYS` alongside `name`, `email`, etc., rather than introducing a new per-provider config key (the way `rolesClaim`/`DIAL_ROLES_FIELD` is configurable). The old chat read a fixed `job_title` claim with no per-provider override; matching that keeps the migration behavior-preserving instead of introducing new configuration surface no one asked for.

**Per-call-site propagation via an optional trailing parameter, not a request-scoped interceptor or AsyncLocalStorage.** Every candidate mechanism for "thread a value from the controller down to the DIAL Core call" was considered:
- A NestJS interceptor or middleware that mutates outbound headers globally — rejected because there is no single chokepoint; each service builds its `fetch`/SDK call independently, and `DialClientService`'s shared `fetchCore` only carries process-wide, non-request-scoped values (`User-Agent`) by design (see `dial-core-client`).
- `AsyncLocalStorage`-based request context — rejected as disproportionate: it would introduce a new cross-cutting primitive for one optional header, when the codebase already has an established, simpler idiom (positional optional parameters threaded from controller to DIAL Core call, as `conversationId`, `clientChannelId`, and `timezone` already are in the same call chains).
- Optional trailing parameter through the existing call chain (controller → domain service → adapter) — chosen. It matches the existing style of every sibling per-request value in these same methods, requires no new abstraction, and keeps the value's lifetime scoped exactly to the request that produced it.

**`buildJobTitleHeaders` mirrors `buildConversationIdHeaders` exactly**, including reusing `encodeHeaderValue` for percent-encoding. A job title can contain non-ASCII text or characters outside the safe HTTP field-value byte range (e.g. accented characters, CJK, em dashes) for the same reason a conversation title can; reusing the already-hardened encoder avoids re-deriving that logic or re-introducing the ByteString conversion failure `X-CONVERSATION-ID` encoding was built to fix.

**Header-token auth needs no code change.** `HeaderTokenStrategy.authenticate()` already assigns the full verified JWT payload to `SessionUser.claims` with no allowlist filtering (unlike the cookie/session login path). If the upstream JWT carries a `job_title` claim, `getJobTitleClaim()` finds it there without any strategy change; this design does not add allowlist filtering to that path, preserving its existing (deliberately permissive) behavior.

**`ChatCompletionsAdapter` (currently unused/dead code) is updated for consistency, not left to drift.** `ConversationStreamingService.relayModelCompletion` duplicates the Chat Completions call inline rather than delegating to the injected-but-uncalled `ChatCompletionsAdapter`. Both were updated identically so a future refactor that switches the live call site to the adapter does not silently regress this header.

**Deployments list cache key is unchanged.** `X-JOB-TITLE` only affects what DIAL Core is told about the caller, not what it returns; the existing `deployments:list:<sub>[:interface:<types>]` cache key stays as-is, and a cache hit still skips the DIAL Core call (and therefore the header) entirely — consistent with how `Authorization` is already omitted from that cache key today.

## Risks / Trade-offs

- **[Positional-parameter propagation grows already-long parameter lists]** → Every touched method already threaded 3-6 optional positional parameters (`clientChannelId`, `timezone`, `conversationId`, …) before this change; `jobTitle` is appended last, after all existing parameters, so no call site's existing positional arguments shift. Accepted as consistent with the existing style rather than introducing a options-object refactor out of scope for this change.
- **[A caller's job title changes mid-session]** → The claim is captured once at login and cached in the encrypted session cookie for the life of that session, same as `name`, `email`, and every other allowlisted claim; a title change at the identity provider is only picked up on the next login. This matches the old chat's behavior (job title also came from the JWT captured at sign-in) and is intentionally out of scope.
- **[`job_title` absent from a provider's ID token]** → `getJobTitleClaim` returns `undefined`, and `buildJobTitleHeaders` omits the header entirely rather than sending an empty value — DIAL Core sees exactly what it sees today for such a caller.

## Migration Plan

No data migration. The change is deployed as a normal `chat-api` release:
1. Existing sessions (created before deploy) do not have `job_title` cached — those users get no `X-JOB-TITLE` header until they log in again (equivalent to "absent claim" above; no error, no degraded behavior).
2. New logins after deploy pick up `job_title` immediately.
Rollback is a plain revert — no schema, cache, or cookie-format change to undo.

## Open Questions

None — behavior, source claim, and target requests were fully specified by the prior `development-old` implementation being ported.
