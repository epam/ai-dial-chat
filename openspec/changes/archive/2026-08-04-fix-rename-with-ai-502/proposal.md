## Why

"Rename with AI" (`POST /api/v1/conversations/generate-title`) fails with a generic 502 on the UAT environment every time, while manual rename and other environments work fine (GitHub issue #8083). The endpoint authenticates the utility-model completion with the calling user's own bearer token by design (see `ai-conversation-rename` spec, "On-demand generation authenticates as the calling user") so that users only get suggestions from models they're actually authorized to use — so the most likely cause is DIAL Core on UAT rejecting that token for the `UTILITY_MODEL` deployment (an access/RBAC configuration difference on that environment). However, `ConversationNamingService` currently collapses every upstream failure — auth/access rejection, timeout, malformed response, real outage — into the same generic `BadGatewayException('LLM title generation failed')`, so neither the API response nor the logs let anyone distinguish "this user/environment isn't authorized for the utility model" from "DIAL Core is actually down." That makes environment-specific failures like this one slow to diagnose and impossible to tell apart from a genuine backend outage without shell access to debug logs.

## What Changes

- Preserve and surface the upstream DIAL Core response status when the on-demand `generate-title` completion call fails, instead of always throwing a flat 502, by reusing the shared `mapDialHttpStatus` / `handleDialFetchError` DIAL Core error mapping already used throughout `chat-api` (`deployments.service.ts`, `applications.service.ts`, `toolsets.service.ts`, `share.service.ts`, etc.):
  - Upstream `401` → `401 Unauthorized`; upstream `403` → `403 Forbidden` — matching the shared mapper's existing, codebase-wide convention, so this reads as an authorization problem rather than a gateway failure and behaves the same as every other endpoint that proxies a DIAL Core call.
  - Upstream `5xx` or network-level failures → keep the existing `502 Bad Gateway` behavior.
  - Timeout → keep the existing `503 Service Unavailable` behavior (unchanged).
- Elevate the failure log to the `warn`/`error` level the shared mapper already logs at (upstream status + error body), instead of the previous debug-only DIAL Core response log, so this is visible in standard production log aggregation without leaking secrets.
- Update the OpenAPI documentation for `generate-title` (`@ApiResponse` on `ConversationController.generateConversationTitle`) to document the new `403` case (and the second cause of the existing `401`).
- No change to the authentication mechanism itself (still the calling user's bearer token) — this is a diagnostics/error-mapping change only.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ai-conversation-rename`: the "Endpoint failure handling and rate limiting" requirement changes from "translate upstream/LLM failures into typed HTTP exceptions" (undifferentiated) to explicitly distinguishing upstream auth/access rejection (401/403) from other upstream failures (502/503), using the shared DIAL Core error mapper, and documents this in the OpenAPI spec.

## Impact

- `apps/chat-api/src/conversations/conversation-naming.service.ts` — `generateTitle` / `sendNamingCompletion` error mapping and logging.
- `apps/chat-api/src/conversations/conversation.controller.ts` — `@ApiResponse` documentation for `generate-title`.
- No frontend changes required: `RenameConversationPopup` already surfaces a generic AI-rename error; a 403 will fall into its existing error-handling path (confirm no code assumes only 502/503 are possible).
- No changes to `renameWithLlm` (the automatic post-first-reply naming path, which uses `DIAL_API_KEY` and is unaffected by this issue).
