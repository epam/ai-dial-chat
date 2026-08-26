## Context

Issue [#8442](https://github.com/epam/ai-dial-chat/issues/8442) requires the browser's timezone to reach DIAL Core so Quick Apps/toolsets/MCP servers can resolve date- and time-sensitive requests in the user's locale. Legacy PR [#8444](https://github.com/epam/ai-dial-chat/pull/8444) established `X-Timezone` and best-effort browser detection as the compatibility contract.

The current application has a host-owned SSE completion adapter in `apps/chat/src/server-api/chat-stream.api.ts`; it is the correct boundary for browser-only data and already owns the exceptional raw `fetch` required to consume the streaming response. The BFF endpoint is `POST /api/v1/conversations/completions`. After resolving the deployment capability, `ConversationStreamingService` currently sends Chat Completions itself and delegates Responses requests to `ResponsesAdapter`. Although `ChatCompletionsAdapter` exists and `docs/responses-api-integration.md` names it, the runtime Chat Completions relay remains `ConversationStreamingService.relayModelCompletion`; this design follows the code that executes today and does not fold an unrelated adapter refactor into the feature.

The feature crosses the browser/BFF/DIAL Core boundary but adds no user-facing UI or persisted data:

```text
browser Intl API
  -> X-Timezone on POST /api/v1/conversations/completions
  -> conversations controller validates header
  -> ConversationStreamingService carries validated value
  -> X-Timezone on selected Chat Completions or Responses SDK request
  -> DIAL Core -> Quick App/toolset -> MCP server
```

## Goals / Non-Goals

**Goals:**

- Send the current browser-resolved IANA timezone with every normal conversation completion when detection succeeds.
- Treat `X-Timezone` as untrusted input at the BFF boundary and reject invalid values before any DIAL Core call.
- Forward the validated value through both generation paths so the BFF's internal API selection is transparent to downstream tools.
- Preserve existing behavior for callers and browsers that omit or cannot resolve a timezone.
- Keep browser and header knowledge at application edges; do not add it to `libs/chat-hooks` or another hand-authored library.

**Non-Goals:**

- A timezone picker, user preference, React context, hook, Redux-style store, or persistence.
- Timezone conversion by Chat; downstream consumers interpret the IANA identifier.
- Adding the header to non-conversation DIAL calls, scheduled-task execution, naming requests, transcription, or `/api/v1/chat/completions`.
- Refactoring the dormant `ChatCompletionsAdapter` into the active runtime path.
- Changes to DIAL Core's existing custom `X-*` header forwarding behavior.

## Decisions

### 1. Resolve timezone per send at the frontend server-api boundary

Add a small pure app utility (for example `apps/chat/src/utils/browser-timezone.ts`) that calls `Intl.DateTimeFormat().resolvedOptions().timeZone`, catches runtime failures, and returns `undefined` for an absent/empty result. `apps/chat/src/server-api/chat-stream.api.ts` calls it immediately before `fetch` and conditionally adds `X-Timezone`.

This deliberately introduces no state owner: no context or hook owns the timezone, and there are no memoisation requirements. Resolving per send avoids stale values if a long-lived tab crosses a system-timezone change and makes the same app-owned transport work for the main conversation page and app preview.

Alternatives rejected:

- Resolve once in a top-level provider and store it: unnecessary global state, extra render/synchronisation surface, and potentially stale.
- Pass timezone through `ConversationStreamTransport`: this would expose browser/integration metadata to `libs/chat-hooks`, contrary to library isolation, even though the lib does not need the value.
- Add the timezone to the JSON body: diverges from the established DIAL custom-header contract and would make transport context part of the generated conversation DTO.

The direct `fetch` remains confined to `server-api/chat-stream.api.ts`. Neither a component nor a hook gains network code. This is the documented SSE generator gap: the generated operation returns `void` and does not expose the live response body in the shape required by the current decoder.

### 2. Define and validate one optional `X-Timezone` API header

The existing `POST /api/v1/conversations/completions` operation gains an optional Swagger `@ApiHeader` named `X-Timezone`; its body and SSE response stay unchanged. The controller reads the header and delegates validation to a conversations-domain utility modeled on `apps/chat-api/src/client-channel/client-channel.utils.ts:27`.

Validation accepts exactly one non-empty string, at most 255 characters, matching an IANA-name-safe allowlist (`[A-Za-z0-9._+-]+` path segments separated by single `/` characters), and accepted by the server's `Intl.DateTimeFormat` timezone option. The value is forwarded unchanged after validation; it is not trimmed, canonicalized, logged, cached, or stored. An absent header maps to `undefined`. Arrays, malformed syntax, unknown timezones, and oversized values produce `BadRequestException` and the existing documented `400` response.

The endpoint remains authorized for the same authenticated session users through the existing global session guard; no role or feature permission is added. Its existing `100` requests per 60 seconds throttle remains unchanged.

Alternatives rejected:

- Trust the browser-produced value: non-browser clients can call the BFF, so the BFF must enforce the boundary.
- Syntax-only validation: it blocks header injection but still forwards fabricated timezone names that downstream tools cannot use.
- Silently drop invalid values: hides client defects and makes behavior difficult to diagnose; explicit `400` matches the backend's validated-input contract.

### 3. Carry the validated value through the existing completion call chain

Append an optional `timezone` argument to the controller-to-service and generation relay calls without restructuring unrelated arguments. At the DIAL SDK call sites, conditionally merge `{ 'X-Timezone': timezone }` alongside bearer auth, `Accept`, and the optional client-channel header:

- `ConversationStreamingService.relayModelCompletion` for the active Chat Completions path;
- `ResponsesAdapter.stream` for the Responses path.

Both calls continue to use the shared `DialClientService` SDK client. No raw backend `fetch`, new SDK instance, retry, or fallback is introduced. The header is request-local; it is never placed on `DialClientService` or other singleton state, preventing cross-user leakage.

The existing generation API selection, request bodies, response normalization, persistence, abort behavior, and error mapping are unchanged.

### 4. Keep the OpenAPI contract additive and preserve the SSE frontend adapter

Swagger regeneration adds optional `xTimezone?: string` to `StreamCompletionRequest` for operation ID / SDK method `streamCompletion`; `SendCompletionDto` and the `void`/SSE response schema remain unchanged. The generated client is updated only via `npm run openapi` and is not hand-edited.

The frontend continues to call neither the normal nor `Raw` generated method for this endpoint because both abstractions are unsuitable for its live SSE reader; it keeps the existing `server-api/chat-stream.api.ts` raw transport and sends the documented header there. Other generated-client callers remain source-compatible because the new request member is optional.

### 5. Do not add product/UI or operational controls

There are no new user-visible strings or UI states, so i18n keys, loading/empty/error UI, accessibility behavior, RTL/direction handling, and responsive layout are unaffected. The capability is always best-effort and is not gated by `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`.

No cache is used (there is no cache key, TTL, or invalidation event). No new metric or analytics event is added; existing generation metrics continue unchanged, and the timezone is not logged because it can reveal coarse user location.

## Risks / Trade-offs

- **[Browser or embedded runtime lacks a usable Intl timezone]** → Catch detection errors and omit the optional header; completion remains functional.
- **[Client sends a forged or injection-shaped header]** → Enforce single-value, length, syntax, and semantic timezone validation before calling the service or DIAL Core.
- **[Timezone changes while the tab remains open]** → Resolve on every send instead of storing the first value.
- **[One generation path misses propagation]** → Exercise Chat Completions and Responses SDK calls independently in adapter/service tests and cover selection in integration tests.
- **[DIAL Core or a downstream component ignores the custom header]** → Chat cannot enforce behavior beyond its boundary; tests verify the exact outgoing SDK header, and rollout relies on the Core/Quick Apps forwarding mechanism stated in #8442.
- **[OpenAPI generator changes a request signature]** → Keep the parameter optional, regenerate from Swagger, run OpenAPI checks, and inspect the generated `ConversationsApi` diff.
- **[Pre-existing docs/runtime adapter mismatch causes implementation in dead code]** → Tasks name `ConversationStreamingService.relayModelCompletion` as the active Chat Completions call site and update the integration document to describe current behavior.

## Migration Plan

1. Add frontend detection/header tests and browser emission.
2. Add BFF header documentation/validation and controller integration coverage.
3. Propagate the validated value through both DIAL SDK request paths and verify present/absent cases.
4. Regenerate and validate OpenAPI artifacts, then update the Responses API integration document.
5. Deploy frontend and BFF together. Older callers remain compatible because the header is optional; a newer frontend talking to an older BFF also continues to complete because unknown request headers are ignored.

Rollback requires reverting browser emission, BFF validation/plumbing, upstream header merges, generated artifacts, and the documentation update. No data migration, cache invalidation, configuration rollback, or coordinated DIAL Core rollback is required.

## Open Questions

None blocking. The selected header name and best-effort semantics come from #8442/#8444; support for forwarding custom `X-*` headers beyond Chat remains an external DIAL Core/Quick Apps prerequisite.
