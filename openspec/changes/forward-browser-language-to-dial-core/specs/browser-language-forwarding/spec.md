# browser-language-forwarding Specification

## ADDED Requirements

### Requirement: Application language is attached to conversation completion requests

Immediately before starting a normal conversation completion, the Chat frontend SHALL resolve its current UI language (i18n locale) and send it as the `X-Lang` request header to `POST /api/v1/conversations/completions` when it resolves to a non-empty value. The language SHALL be resolved per request and SHALL NOT be persisted for this purpose beyond the app's existing i18n state. The resolver SHALL be injected into the stream transport `createChatStreamApi` as its optional `getLanguage` dependency; the lib SHALL NOT read browser or app state itself. The transport SHALL omit `X-Lang` entirely when the resolver returns `undefined` or an empty value.

#### Scenario: App supplies a language

- **WHEN** the app's current locale is `en` and a user starts a conversation completion
- **THEN** the request to `POST /api/v1/conversations/completions` contains `X-Lang: en`

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

The authenticated business endpoint `POST /api/v1/conversations/completions` SHALL accept one optional `X-Lang` header. An accepted value MUST be a single string no longer than 35 characters, and MUST consist only of ASCII letters and digits, with the primary subtag being 2–8 letters and optional `-`-separated subtags of 1–8 alphanumeric characters (a BCP-47-like shape). The BFF SHALL pass an accepted value onward unchanged and SHALL NOT trim, canonicalize, persist, cache, or log it. A missing header SHALL remain valid; a present invalid value SHALL return `400 Bad Request` before DIAL Core is called. The rule is implemented by `assertValidOptionalLang` with `LANG_HEADER`, `LANG_MAX_LENGTH`, and `LANG_PATTERN` in `apps/chat-api/src/conversations/utils/lang-header.ts`.

#### Scenario: Valid language is accepted

- **WHEN** an authenticated completion request contains `X-Lang: en` and a valid existing request body
- **THEN** the endpoint starts the SSE completion and delegates `en` as the validated language

#### Scenario: Valid locale with region is accepted

- **WHEN** the request contains `X-Lang: en-US`
- **THEN** the endpoint starts the SSE completion and delegates `en-US` unchanged

#### Scenario: Missing language remains backward compatible

- **WHEN** an otherwise valid completion request omits `X-Lang`
- **THEN** the endpoint starts the SSE completion with no language value

#### Scenario: Invalid language syntax is rejected

- **WHEN** `X-Lang` contains whitespace, control characters, repeated separators, leading/trailing separators, characters outside the allowlist, or a malformed subtag shape
- **THEN** the endpoint returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Oversized language is rejected

- **WHEN** `X-Lang` is longer than 35 characters
- **THEN** the endpoint returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Multiple language header values are rejected

- **WHEN** the request exposes `X-Lang` as more than one header value
- **THEN** the endpoint returns `400 Bad Request` and does not select or concatenate a value
