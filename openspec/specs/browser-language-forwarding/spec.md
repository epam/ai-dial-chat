# browser-language-forwarding Specification

## Purpose

Forward the Chat frontend's current UI language to DIAL Core as the `X-Lang` header on conversation completions: the app resolves the locale per request, the `createChatStreamApi` transport attaches it, the chat-api BFF validates it and forwards it through every generation API, so agents and MCP-backed tools can choose the response language.

## Requirements

### Requirement: Application language is attached to conversation completion requests

Immediately before starting a normal conversation completion, the Chat frontend SHALL resolve its current UI language through `getUiLanguage` (`apps/chat/src/i18n/get-ui-language.ts`) and send it as the `X-Lang` request header to `POST /api/v1/conversations/completions` when it resolves to a non-empty value. The language SHALL be resolved per request and SHALL NOT be persisted for this purpose beyond the app's existing i18n state. The resolver SHALL be injected into the stream transport `createChatStreamApi` as its optional `getLanguage` dependency; the lib SHALL NOT read browser or app state itself. The transport SHALL omit `X-Lang` entirely when the resolver returns `undefined` or an empty value.

The forwarded value is i18next's `i18n.language`: the locale the user chose or the browser reported. It is not `i18n.resolvedLanguage`, the locale whose translation bundle is rendered. The two differ when the chosen or detected locale has no registered bundle and the UI falls back to English. In that case the header SHALL carry the chosen or detected locale (for example `ru` or `uk`), not the rendered fallback `en`, because it is the better predictor of the language the user expects documents, names and answers in. A region subtag (for example `en-US`) SHALL be forwarded unchanged.

#### Scenario: App supplies a language

- **WHEN** the app's current locale is `en` and a user starts a conversation completion
- **THEN** the request to `POST /api/v1/conversations/completions` contains `X-Lang: en`

#### Scenario: Detected locale has no translation bundle

- **WHEN** the browser reports `ru`, no `ru` bundle is registered, and the UI therefore renders in English
- **THEN** the completion request contains `X-Lang: ru`, not `X-Lang: en`

#### Scenario: Language changes in a long-lived tab

- **WHEN** the user switches the UI language and sends another completion from the same tab
- **THEN** the new request carries the newly resolved language without a reload

#### Scenario: Language is unavailable

- **WHEN** the language resolver returns `undefined` or an empty value
- **THEN** the frontend omits `X-Lang` and starts the completion normally

#### Scenario: Project conversations use the same behavior

- **WHEN** a completion is started on a project conversation through the shared app-owned conversation stream transport
- **THEN** language detection and conditional header emission match the top-level conversation flow

### Requirement: Completion endpoint validates the optional language header

The authenticated business endpoint `POST /api/v1/conversations/completions` SHALL accept one optional `X-Lang` header. An accepted value MUST be a single string no longer than 35 characters, and MUST consist only of ASCII letters and digits, with the primary subtag being 2–8 letters and optional `-`-separated subtags of 1–8 alphanumeric characters (a BCP-47-like shape). The BFF SHALL pass an accepted value onward unchanged and SHALL NOT trim, canonicalize, persist, cache, or log it. A missing header SHALL remain valid; a present invalid value SHALL return `400 Bad Request` before DIAL Core is called. A header that is present with an empty value (`X-Lang:`) is invalid, not missing: the frontend never sends it, so an empty value comes only from a malformed client, which the BFF rejects rather than silently dropping. This matches the `X-Timezone` contract. The rule is implemented by `assertValidOptionalLang` with `LANG_HEADER`, `LANG_MAX_LENGTH`, and `LANG_PATTERN` in `apps/chat-api/src/conversations/utils/lang-header.ts`.

#### Scenario: Valid language is accepted

- **WHEN** an authenticated completion request contains `X-Lang: en` and a valid existing request body
- **THEN** the endpoint starts the SSE completion and delegates `en` as the validated language

#### Scenario: Valid locale with region is accepted

- **WHEN** the request contains `X-Lang: en-US`
- **THEN** the endpoint starts the SSE completion and delegates `en-US` unchanged

#### Scenario: Missing language remains backward compatible

- **WHEN** an otherwise valid completion request omits `X-Lang`
- **THEN** the endpoint starts the SSE completion with no language value

#### Scenario: Empty language is rejected

- **WHEN** the request contains `X-Lang` with an empty value
- **THEN** the endpoint returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Invalid language syntax is rejected

- **WHEN** `X-Lang` contains whitespace, control characters, repeated separators, leading/trailing separators, characters outside the allowlist, or a malformed subtag shape
- **THEN** the endpoint returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Oversized language is rejected

- **WHEN** `X-Lang` is longer than 35 characters
- **THEN** the endpoint returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Multiple language header values are rejected

- **WHEN** the request exposes `X-Lang` as more than one header value
- **THEN** the endpoint returns `400 Bad Request` and does not select or concatenate a value

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
