
### Requirement: Validated language is forwarded through every generation API

For a completion carrying a validated language, the BFF SHALL add `X-Lang` with the unchanged value to the authenticated DIAL Core SDK request selected for that generation, both on the Chat Completions call and on the Responses API call. When the BFF receives no language, both upstream requests SHALL omit `X-Lang`. Generation API selection, request bodies, SSE normalization, persistence, stopping, retries, and error handling SHALL otherwise remain unchanged. The language SHALL remain request-local and SHALL NOT be stored on a singleton SDK client or shared across requests.

#### Scenario: Chat Completions request forwards language

- **WHEN** the BFF selects Chat Completions for a request carrying validated language `en`
- **THEN** `sendChatCompletionRequest` receives `X-Lang: en` alongside the existing auth and stream headers

#### Scenario: Responses request forwards language

- **WHEN** the BFF selects Responses API for a request carrying validated language `en`
- **THEN** `createResponse` receives `X-Lang: en` alongside the existing auth and stream headers

#### Scenario: Upstream header is omitted when client header is absent

- **WHEN** a valid completion request omits `X-Lang`
- **THEN** the selected DIAL Core SDK request contains no `X-Lang` header

#### Scenario: Concurrent requests do not share language

- **WHEN** two concurrent completions carry different validated languages
- **THEN** each upstream request receives exactly its own language value

### Requirement: OpenAPI and cross-cutting behavior remain compatible

Swagger SHALL document `X-Lang` as an optional header on operation ID / SDK method `streamCompletion`. OpenAPI regeneration SHALL add optional `xLang?: string` to `StreamCompletionRequest` while leaving `SendCompletionDto` and the SSE response contract unchanged. No user-visible strings, UI surface, feature gate, cache rule, rate limit, metric, or analytics event SHALL be introduced, and logs SHALL NOT contain the language value.

#### Scenario: Generated contract is additive

- **WHEN** OpenAPI artifacts are regenerated from the annotated completion endpoint
- **THEN** `ConversationsApi.streamCompletion` accepts optional `xLang`, existing callers that provide only `sendCompletionDto` still type-check, and no generated file is hand-edited

## MODIFIED Requirements

### Requirement: Chat-stream completion transport is a factory over an injected fetch and host capabilities

`@epam/ai-dial-chat-hooks` SHALL export `createChatStreamApi(deps: CreateChatStreamApiDeps)` (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts`; `deps: { getCsrfToken: () => string | null; setCsrfToken: (token: string | null) => void; completionsBasePath: string; getTimezone?: () => string | undefined; getLanguage?: () => string | undefined; fetchImpl?: typeof fetch; idleTimeoutMs?: number }`), returning `ChatStreamApi { streamCompletion, stopCompletion }`, which `apps/chat/src/server-api/chat-stream.api.ts` composes with `completionsBasePath: ApiEndpoints.CONVERSATIONS`, `getTimezone: getBrowserTimezone`, and `getLanguage` resolving the app's current UI language. Behavior: all existing parsing, CSRF, error, idle-watchdog, and body semantics are unchanged; the `X-Timezone` header is present only when `deps.getTimezone` resolves a non-empty value; the `X-Lang` header is present only when `deps.getLanguage` resolves a non-empty value.
