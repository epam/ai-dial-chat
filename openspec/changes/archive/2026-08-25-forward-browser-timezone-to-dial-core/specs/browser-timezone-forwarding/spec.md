## ADDED Requirements

### Requirement: Browser timezone is attached to conversation completion requests

Immediately before starting a normal conversation completion, the Chat frontend SHALL resolve the current browser timezone through `Intl.DateTimeFormat().resolvedOptions().timeZone`. When resolution returns a non-empty string, the app-owned transport SHALL send that value in the `X-Timezone` request header to `POST /api/v1/conversations/completions`. The timezone SHALL be resolved per request and SHALL NOT be stored in a React context, hook, hand-authored library, browser storage, or user configuration.

#### Scenario: Browser supplies a timezone

- **WHEN** the browser resolves the current timezone as `Europe/Warsaw` and a user starts a conversation completion
- **THEN** the request to `POST /api/v1/conversations/completions` contains `X-Timezone: Europe/Warsaw`

#### Scenario: System timezone changes in a long-lived tab

- **WHEN** two completion requests in the same tab resolve different current timezone values
- **THEN** each request contains the value resolved immediately before that request, without requiring a reload

#### Scenario: Browser timezone is unavailable

- **WHEN** timezone resolution throws, returns an empty value, or returns no value
- **THEN** the frontend omits `X-Timezone` and starts the completion normally

#### Scenario: App preview uses the same behavior

- **WHEN** a completion is started from app preview through the shared app-owned conversation stream transport
- **THEN** timezone detection and conditional header emission match the main conversation flow

### Requirement: Completion endpoint validates the optional timezone header

The existing authenticated business endpoint `POST /api/v1/conversations/completions` SHALL accept one optional `X-Timezone` header. An accepted value MUST be a single string no longer than 255 characters, MUST consist only of IANA-name-safe path segments using ASCII letters, digits, `.`, `_`, `+`, and `-` separated by single `/` characters, and MUST be accepted as a timezone by the backend JavaScript `Intl.DateTimeFormat` implementation. The BFF SHALL pass an accepted value onward unchanged and SHALL NOT trim, canonicalize, persist, cache, or log it. A missing header SHALL remain valid; a present invalid value SHALL return `400 Bad Request` before DIAL Core is called.

The endpoint contract remains:

```http
POST /api/v1/conversations/completions
Content-Type: application/json
X-CSRF-Token: <session-csrf-token>
X-Timezone: Europe/Warsaw

{
  "generationId": "cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8",
  "path": "gpt-4o__Calendar__cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8",
  "model": "gpt-4o",
  "mode": "append",
  "message": "What is on my calendar tomorrow?"
}
```

A successful response remains the existing SSE stream, for example:

```text
data: {"id":"cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8","object":"chat.completion.chunk","choices":[{"delta":{"content":"You have..."}}]}

data: [DONE]
```

The existing response statuses remain `200` (SSE), `400`, `401`, `403`, `404`, `409`, `429`, `502`, and `503`; this change adds invalid timezone input as another `400` case. Authentication remains the existing session/header-token authentication with no new role requirement, and the existing per-route limit of 100 requests per 60 seconds remains unchanged.

#### Scenario: Valid IANA timezone is accepted

- **WHEN** an authenticated completion request contains `X-Timezone: America/New_York` and a valid existing request body
- **THEN** the endpoint starts the SSE completion and delegates `America/New_York` as the validated timezone

#### Scenario: Missing timezone remains backward compatible

- **WHEN** an otherwise valid completion request omits `X-Timezone`
- **THEN** the endpoint starts the SSE completion with no timezone value

#### Scenario: Invalid timezone syntax is rejected

- **WHEN** `X-Timezone` contains whitespace, control characters, repeated separators, or characters outside the allowlist
- **THEN** the endpoint returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Unknown timezone is rejected

- **WHEN** `X-Timezone` is syntactically safe but is not accepted by the backend `Intl.DateTimeFormat` implementation
- **THEN** the endpoint returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Oversized timezone is rejected

- **WHEN** `X-Timezone` is longer than 255 characters
- **THEN** the endpoint returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Multiple timezone header values are rejected

- **WHEN** the request exposes `X-Timezone` as more than one header value
- **THEN** the endpoint returns `400 Bad Request` and does not select or concatenate a value

### Requirement: Validated timezone is forwarded through every generation API

For a completion carrying a validated timezone, the BFF SHALL add `X-Timezone` with the unchanged value to the authenticated DIAL Core SDK request selected for that generation. This applies both to the active Chat Completions call and to the Responses API call. When the BFF receives no timezone, both upstream requests SHALL omit `X-Timezone`. Generation API selection, request bodies, SSE normalization, persistence, stopping, retries, and error handling SHALL otherwise remain unchanged. The timezone SHALL remain request-local and SHALL NOT be stored on a singleton SDK client or shared across requests.

#### Scenario: Chat Completions request forwards timezone

- **WHEN** the BFF selects Chat Completions for a request carrying validated timezone `Asia/Tokyo`
- **THEN** `sendChatCompletionRequest` receives `X-Timezone: Asia/Tokyo` alongside the existing auth and stream headers

#### Scenario: Responses request forwards timezone

- **WHEN** the BFF selects Responses API for a request carrying validated timezone `Asia/Tokyo`
- **THEN** `createResponse` receives `X-Timezone: Asia/Tokyo` alongside the existing auth and stream headers

#### Scenario: Upstream header is omitted when client header is absent

- **WHEN** a valid completion request omits `X-Timezone`
- **THEN** the selected DIAL Core SDK request contains no `X-Timezone` header

#### Scenario: Concurrent requests do not share timezone

- **WHEN** two concurrent authenticated completions carry different valid timezone values
- **THEN** each DIAL Core request receives only the timezone from its own BFF request

### Requirement: OpenAPI and cross-cutting behavior remain compatible

Swagger SHALL document `X-Timezone` as an optional header on operation ID / SDK method `streamCompletion`. OpenAPI regeneration SHALL add optional `xTimezone?: string` to `StreamCompletionRequest` while leaving `SendCompletionDto` and the SSE response contract unchanged. The frontend SHALL continue using the existing raw SSE transport rather than the normal or `Raw` generated method because the generated response abstraction does not expose the live stream required by the decoder.

The capability SHALL introduce no user-visible strings, i18n keys, UI surface, keyboard interaction, ARIA contract, RTL/direction behavior, responsive layout, memoisation, `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` gate, cache key/TTL/invalidation rule, new rate limit, metric, or analytics event. Existing generation metrics SHALL remain unchanged, and logs SHALL NOT contain the timezone value.

#### Scenario: Generated client remains source compatible

- **WHEN** OpenAPI artifacts are regenerated from the annotated completion endpoint
- **THEN** `ConversationsApi.streamCompletion` accepts optional `xTimezone`, existing callers that provide only `sendCompletionDto` still type-check, and no generated file is hand-edited

#### Scenario: No UI or product configuration is introduced

- **WHEN** the timezone-forwarding capability is enabled by deploying the change
- **THEN** users see no new control or text, no feature role is required, and no UI accessibility or direction behavior changes

#### Scenario: Timezone is excluded from observability

- **WHEN** a completion with `X-Timezone` succeeds or fails
- **THEN** existing completion metrics may record their current generation attributes, but no log, metric, or analytics event records the timezone value
