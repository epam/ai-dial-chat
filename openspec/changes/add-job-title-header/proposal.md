## Why

The previous Next.js chat (`development-old`) sent the caller's job title to DIAL Core as an `X-JOB-TITLE` header on chat completion, models list, default-model, rate, and transcribe requests, using the OIDC `job_title` claim captured at login. The current `apps/chat-api` NestJS backend has no equivalent: `job_title` is not in the OIDC claims allowlist, is not stored on the session, and no outbound DIAL Core request carries it. DIAL Core-side features that key off the caller's job title (analytics, per-title routing/limits, audit) silently stop receiving it after the migration to `apps/chat-api`, with no code path left to restore it.

## What Changes

- Add `job_title` to the OIDC claims allowlist captured on login (`AuthController.callback()`), so it is stored on the encrypted session (`SessionPayload.claims` / `SessionUser.claims`) alongside the existing allowlisted claims.
- Add a `getJobTitleClaim(claims)` helper that safely reads a string `job_title` value out of `SessionUser.claims`.
- Add a `buildJobTitleHeaders(jobTitle)` helper (`X-JOB-TITLE`, percent-encoded via the existing `encodeHeaderValue`) alongside the existing `buildConversationIdHeaders`, for spreading into a DIAL Core call's headers.
- Forward the caller's job title as `X-JOB-TITLE` on the same five DIAL Core request types the old chat sent it on:
  - chat completion (both the Chat Completions and Responses API generation paths)
  - models list / default-model (a single DIAL Core `listDeployments` call backs both)
  - rate
  - transcribe
- Header-token (JWT bearer) authenticated callers already store unfiltered claims on the session, so `job_title` flows through unchanged for that auth path with no additional code.
- No new endpoint, DTO, or OpenAPI-visible contract change — this only affects an outbound header to DIAL Core and what the session stores internally.

## Capabilities

### New Capabilities

- `job-title-header-forwarding`: capturing the `job_title` OIDC claim into the session and forwarding it as `X-JOB-TITLE` on chat completion, models/default-model listing, rate, and transcribe requests to DIAL Core.

### Modified Capabilities

(none — no existing spec documents the OIDC claims allowlist or per-request custom header forwarding to DIAL Core; this is new documented behavior)

## Impact

- `apps/chat-api/src/auth/auth.controller.ts` — claims allowlist.
- `apps/chat-api/src/auth/session/session.types.ts` — `getJobTitleClaim` helper.
- `apps/chat-api/src/common/utils/header-value.ts` — `JOB_TITLE_HEADER`, `buildJobTitleHeaders`.
- `apps/chat-api/src/conversations/conversation.controller.ts`, `.../streaming/conversation-streaming.service.ts`, `.../generation/responses.adapter.ts`, `.../generation/chat-completions.adapter.ts`.
- `apps/chat-api/src/deployments/deployments.controller.ts`, `.../listing/deployments-listing.service.ts`.
- `apps/chat-api/src/rate/rate.controller.ts`, `rate.service.ts`.
- `apps/chat-api/src/transcription/transcription.controller.ts`, `transcription.service.ts`.
- No frontend (`apps/chat`), library (`libs/*`), OpenAPI, or database changes.
