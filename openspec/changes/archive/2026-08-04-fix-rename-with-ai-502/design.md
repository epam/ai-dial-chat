## Context

`ConversationNamingService.generateTitle` (`apps/chat-api/src/conversations/conversation-naming.service.ts:75-145`) drives the on-demand "Rename with AI" endpoint. It calls `sendNamingCompletion` (lines 374-433), which authenticates with the calling user's bearer token (`getBearerAuthHeaders(token)`) — an intentional design choice per the `ai-conversation-rename` spec, so a user can only get title suggestions from models they are themselves authorized to call.

When `result.response.ok` is false, `sendNamingCompletion` throws a plain `Error` carrying only the upstream HTTP status in its message (line 414-416). The `catch` block in `generateTitle` (lines 122-131) only distinguishes a timeout (`error.message.includes('timed out')` → 503) from everything else, which always becomes `BadGatewayException('LLM title generation failed')` — regardless of whether DIAL Core rejected the request with 401/403 (no/insufficient access to the `UTILITY_MODEL` deployment) or genuinely failed with a 5xx. This is exactly the symptom in issue #8083: "Rename with AI" 502s consistently on UAT while manual rename (no LLM call) works, and there is no way from the API response or logs to tell whether this is an access/config problem specific to UAT or a real backend outage.

The codebase already has a shared, reusable solution for exactly this problem: `mapDialHttpStatus` / `handleDialFetchError` in `apps/chat-api/src/common/dial/dial-error.mapper.ts`, used throughout `chat-api` (`deployments.service.ts`, `applications.service.ts`, `toolsets.service.ts`, `share.service.ts`, etc.) to map a not-ok DIAL Core response (`mapDialHttpStatus`) or a thrown fetch/timeout error (`handleDialFetchError`) to the matching typed Nest exception — 400→`BadRequestException`, 401→`UnauthorizedException`, 403→`ForbiddenException`, 404→`NotFoundException`, 409→`ConflictException`, 413→`PayloadTooLargeException`, 429→429 `HttpException`, 5xx→`BadGatewayException`, anything else→`BadGatewayException('Unexpected upstream status …')`, and `AbortError`→`ServiceUnavailableException('DIAL Core request timed out')`. Both helpers already log the upstream status and error body at `warn`/`error` level. This change adopts those shared helpers in `sendNamingCompletion` instead of inventing a bespoke error class, so `generate-title` gets the same status-to-exception mapping every other `chat-api` domain gets, for free, and any future unmapped status is already visible in the shared mapper's log line without further changes here.

## Goals / Non-Goals

**Goals:**

- Distinguish upstream auth/access rejection (401/403) from other upstream failures in the `generate-title` endpoint's error response and logs.
- Keep existing 503 (timeout) and 502 (other upstream/network failures) behavior for all non-401/403 cases, so this is additive, not a breaking change to the documented 502/503 contract.
- Document the new 403 case in Swagger/OpenAPI and regenerate `chat-api-client`.

**Non-Goals:**

- Do not change the authentication mechanism (still the calling user's bearer token) — that is an intentional, spec-documented security property, not a bug.
- Do not attempt to fix the underlying UAT DIAL Core deployment/RBAC configuration — that's an environment configuration concern outside this repo; this change only makes the symptom diagnosable from the app side.
- Do not add retry or fallback-to-service-credential behavior on auth rejection.

## Decisions

**Decision: Reuse `mapDialHttpStatus` / `handleDialFetchError` in `sendNamingCompletion` instead of a bespoke error class.**

`sendNamingCompletion` follows the same shape as the SDK calls elsewhere in `chat-api` (e.g. `DeploymentsService.getDeploymentLimits`): it resolves to `{ data, error, response }`. When `result.error != null || !result.response.ok`, call `mapDialHttpStatus(result.response.status, context, this.logger, result.error)`; wrap the whole call in try/catch and route thrown/rejected errors (network failure, `AbortError` timeout) through `handleDialFetchError(error, context, this.logger, timeoutMs)`. Both are typed `never`-returning functions, so `return mapDialHttpStatus(...)` / `return handleDialFetchError(...)` type-check inside a function returning `Promise<string>`. `generateTitle` no longer needs its own catch block — it just awaits `sendNamingCompletion` and lets the already-typed exception propagate.

- Alternative considered (and initially implemented, then reverted): a bespoke `DialNamingRequestError extends Error { status: number }` thrown from `sendNamingCompletion`, manually re-mapped to `ForbiddenException`/`BadGatewayException`/`ServiceUnavailableException` in `generateTitle`'s catch block. Rejected on review — it duplicates logic and log lines the shared mapper already provides, and produces a status mapping (401/403 both collapsed to 403) inconsistent with how every other `chat-api` domain handles the same upstream statuses.

**Decision: Let upstream 401 map to `UnauthorizedException` (401) and 403 map to `ForbiddenException` (403), matching the shared mapper's existing convention — do not collapse both to 403.**

`mapDialHttpStatus` already encodes the codebase-wide convention that a DIAL Core 401 becomes `UnauthorizedException` and a 403 becomes `ForbiddenException`. Reusing it means `generate-title` behaves exactly like every other endpoint that proxies a DIAL Core call, which is more valuable for consistency (and for anyone debugging via status code across domains) than the alternative of a naming-endpoint-specific collapse to a single "not authorized" status.

- Alternative considered: keep the earlier design's choice of collapsing both 401 and 403 to `ForbiddenException`, reasoning that the app session is already authenticated so any DIAL-Core-level rejection is "authorization", not "authentication". Rejected in favor of consistency with the shared mapper — introducing a one-off exception in this file would mean this endpoint's 401 has a different meaning than a 401 from every other `chat-api` endpoint, which is confusing for API consumers and harder to maintain.

**Decision: Rely on `mapDialHttpStatus`'s built-in logging instead of adding bespoke classification logging in `generateTitle`.**

`mapDialHttpStatus` already logs `warn`-level "DIAL Core returned {status} for {context}" plus the error body for every not-ok response, and `handleDialFetchError` already logs thrown/timeout errors at `error` level with context. This fires on every failure path, including upstream statuses with no explicit `if` branch (e.g. 400/404/409/413/429 aren't naming-specific, but still get logged and mapped correctly), which covers the original motivation (surfacing unmapped/unexpected statuses) without a separate ad hoc debug line in `conversation-naming.service.ts`.

- Alternative considered: keep a custom `classification` (`accessRejected` vs `other`) computed and logged in `generateTitle`'s catch block. Rejected — redundant with the shared mapper's own logging, and it duplicated status-inspection logic that the mapper already centralizes for every domain.

## Risks / Trade-offs

- [Risk: Changing the exception type for a subset of failures could be perceived as a breaking API change] → Mitigation: 401/403 are additive response codes alongside the already-documented 400/404/429/502/503 (401 was already documented for session-level auth failures; this adds a second cause for the same status); existing 502/503 behavior for all other failure modes is unchanged, and the frontend already handles arbitrary failure status generically (`ConversationsContext.generateConversationTitle` just re-throws; `RenameConversationPopup` shows a generic AI-rename error toast regardless of status).
- [Risk: A client can no longer distinguish "session not authenticated" from "DIAL Core rejected the utility-model deployment" — both are HTTP 401] → Mitigation: this is an accepted trade-off for consistency with the rest of the API; the response body's message text still differs, and server-side logs unambiguously show which case occurred (`mapDialHttpStatus`'s log line names the context, `LLM naming request (model=…)`, versus `SessionGuard`'s own auth-failure logging).
- [Risk: Misclassifying a genuine DIAL Core 401 that's unrelated to model access (e.g. a stale/expired session token) as a utility-model access problem] → Mitigation: the request already passed session auth (`SessionGuard`) to reach the controller, and the same `at` token is used for the underlying `conversationPersistence.getConversation` call earlier in `generateTitle`, which would already have failed first if the token were simply invalid/expired; a 401/403 from this specific DIAL Core call is therefore attributable to the model deployment access check, not general session validity.

## Migration Plan

- Backend-only change, no data migration. Deploy as a normal `chat-api` release.
- After merging, run `npm run openapi && npm run openapi:check` and rebuild/lint `chat-api-client` per `apps/chat-api/AGENTS.md`, since the `generate-title` OpenAPI contract gains a `403` response.
- Rollback: revert the commit; no persisted state or schema changes are involved.

## Open Questions

- None — the actual UAT DIAL Core deployment/RBAC configuration for `UTILITY_MODEL` is out of scope for this change and should be tracked separately (e.g. as a DevOps/infra ticket) once this change makes the 403 visible in UAT logs/responses.
