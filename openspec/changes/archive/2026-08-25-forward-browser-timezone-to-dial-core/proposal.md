## Why

MCP-backed tools that interpret dates and times currently receive no reliable indication of the user's browser timezone, so requests such as calendar lookups can be evaluated in the wrong local time. Issue [#8442](https://github.com/epam/ai-dial-chat/issues/8442) requests forwarding that context through Chat to DIAL Core, and legacy PR [#8444](https://github.com/epam/ai-dial-chat/pull/8444) provides the established `X-Timezone` contract to carry forward into the current architecture.

### Problem

The current browser completion transport sends only JSON/CSRF headers (`apps/chat/src/server-api/chat-stream.api.ts:42`), while the BFF's active Chat Completions relay and Responses adapter construct their upstream headers independently (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:180`, `apps/chat-api/src/conversations/generation/responses.adapter.ts:112`). Consequently, DIAL Core, Quick Apps, toolsets, and MCP servers cannot infer the user's local timezone from a normal conversation completion.

### Solution

Detect the browser's current IANA timezone on each conversation completion request, send it as an optional `X-Timezone` header to the BFF, validate it at the existing completion endpoint, and forward the accepted value to DIAL Core for both supported generation APIs.

### Non-goals

- Add a user-facing timezone selector, persisted timezone preference, or new React context/state.
- Change scheduled-task timezone conversion or the audio-transcription-only `/api/v1/chat/completions` flow.
- Configure or modify DIAL Core, Quick Apps, toolsets, or MCP servers beyond emitting the header they already support.

### Acceptance criteria

- A normal browser conversation completion includes `X-Timezone` when `Intl.DateTimeFormat().resolvedOptions().timeZone` returns a non-empty value.
- The BFF validates the optional header and forwards it unchanged to the selected DIAL Core Chat Completions or Responses request.
- Missing or unavailable browser timezone remains backward compatible: completion proceeds and the header is omitted.
- Malformed or oversized timezone headers are rejected with `400 Bad Request` before contacting DIAL Core.
- Automated frontend, controller/integration, and generation-adapter tests cover present, absent, and invalid timezone behavior.

## What Changes

- Extend the app-owned completion transport pattern (`apps/chat/src/utils/conversation-stream-transport.ts:13`) with best-effort, per-request browser timezone detection at the application edge.
- Document and validate optional `X-Timezone` input on `POST /api/v1/conversations/completions` (`apps/chat-api/src/conversations/conversation.controller.ts:213`).
- Thread the validated value through the conversation streaming service and add it to both DIAL Core generation adapter header sets.
- Regenerate the OpenAPI client so the existing `streamCompletion` operation exposes the optional header while the frontend keeps its raw fetch path for SSE streaming.
- Update the Responses API integration documentation to describe consistent timezone forwarding across both generation modes.
- No user-visible strings are introduced; i18n, RTL, accessibility, UI layout, feature flags, caching, rate limits, and telemetry behavior are unchanged.

### Alternatives considered

- **Selected — optional request header, resolved per completion:** matches the legacy/DIAL Core contract, avoids stale state when the system timezone changes, and is omitted safely when browser detection fails.
- **Persist timezone in React context or user configuration:** rejected because the value is browser runtime context, requires unnecessary ownership/synchronization, and creates migration and stale-value risk.
- **Add timezone to the JSON completion DTO:** rejected because it diverges from the established custom-header forwarding chain and treats transport metadata as conversation content.
- **Forward only through Chat Completions:** rejected because the BFF selects Chat Completions or Responses transparently; tool behavior must not depend on that internal choice.

## Capabilities

### New Capabilities

- `browser-timezone-forwarding`: Defines browser timezone detection, the optional BFF header contract and validation, and propagation to every DIAL Core generation path.

### Modified Capabilities

- None.

## Impact

- **Frontend:** `apps/chat/src/server-api/chat-stream.api.ts` and its tests; a small app-owned timezone utility may be added under `apps/chat/src/utils/`. No hand-authored library receives browser, endpoint, or header knowledge.
- **Backend:** the existing conversations controller, a domain-local header validation primitive, conversation streaming service, Chat Completions adapter, Responses adapter, and their tests.
- **API/OpenAPI:** `POST /api/v1/conversations/completions` gains one optional `X-Timezone` request header; operation ID, request body, response stream, auth, CSRF, rate limiting, and error mapping remain otherwise unchanged. The generated client changes are additive and generated rather than hand-edited.
- **Documentation:** `docs/responses-api-integration.md` will state that both generation paths forward the same validated timezone header.
- **Dependencies and operations:** no new dependency, environment variable, feature flag, cache, metric, or deployment step.
- **Compatibility and rollback:** additive and non-breaking for callers that omit the header. Rollback is removal of browser emission, controller validation/documentation, and upstream propagation; existing request bodies and completion behavior remain valid throughout.
- **Scope:** no shared/global provider or hand-authored `libs/*` change. `libs/chat-api-client` changes only through OpenAPI regeneration.
