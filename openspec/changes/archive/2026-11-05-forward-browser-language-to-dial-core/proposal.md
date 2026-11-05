## Why

DIAL Core agents and MCP-backed tools (for example office MCP search returning localized document names) receive no indication of the user's preferred language, so they cannot reliably decide which language to return documents and names in. Legacy PR [#6488](https://github.com/epam/ai-dial-chat/pull/6488) established the intent: forward the frontend's current UI language to DIAL Core as an `X-Lang` request header. Note that `PROXY_LANGUAGE_HEADER` is a DIAL Core setting naming the header Core reads — the legacy chat also had a same-named variable for the outbound header (default `accept-language` since #8377), which is not carried over; deployments must point DIAL Core's setting at `X-Lang` (see `docs/legacy-chat-migration-guide.md`). That PR targeted the removed Next.js route-handler architecture; the current BFF architecture needs the same pipeline the browser timezone uses.

### Problem

A conversation completion currently carries the user's timezone (`X-Timezone`) but no language context. The chat-api BFF constructs upstream DIAL Core headers explicitly and drops unknown request headers, so even a client sending `X-Lang` today has it discarded before DIAL Core. Models and agents therefore answer in a guessed language for document-name- and locale-sensitive tools.

### Solution

Resolve the application's current UI language on each conversation completion request, send it as an optional `X-Lang` header to the BFF, validate it at the completion endpoint, and forward the accepted value to DIAL Core on both supported generation APIs (Chat Completions and Responses). The header name is fixed (`X-Lang`), mirroring `X-Timezone` — deployments configure DIAL Core's own `PROXY_LANGUAGE_HEADER` setting to `X-Lang`.

### Non-goals

- Add a user-facing language selector (the existing app i18n locale is the source).
- Configure or modify DIAL Core, toolsets, or MCP servers beyond emitting the header they already support.
- Support a configurable header name via a chat-api environment variable (legacy PR #6488 pattern); the fixed name matches `X-Timezone`'s design and the deployment.
- Change request bodies, DTOs, persistence, stopping, retries, or SSE normalization.

### Acceptance criteria

- A browser conversation completion includes `X-Lang` when the app's current locale resolves to a non-empty value.
- The BFF validates the optional header and forwards it unchanged to the selected DIAL Core Chat Completions or Responses request.
- A missing header remains backward compatible: completion proceeds, no upstream header is added.
- Malformed, oversized, or multi-value language headers are rejected with `400 Bad Request` before contacting DIAL Core.
- Frontend, controller/integration, and generation-adapter tests cover present, absent, and invalid language behavior.

## What Changes

- Add an optional `getLanguage?: () => string | undefined` dependency to `createChatStreamApi` in `libs/chat-hooks` (injected, no browser/API knowledge in the lib) and emit `X-Lang` when it resolves non-empty.
- Wire the app's current i18n locale resolver into `apps/chat/src/server-api/chat-stream.api.ts` and `apps/chat/src/utils/project-conversation-data-source.ts`.
- Add `apps/chat-api/src/conversations/utils/lang-header.ts` with `assertValidOptionalLang`, document and accept the optional `X-Lang` header on `POST /api/v1/conversations/completions`.
- Thread the validated value request-locally through the responder, streaming service, background generation service, and both generation adapters.
- Regenerate the OpenAPI artifacts so `streamCompletion` exposes optional `xLang?: string`.
- Update `docs/responses-api-integration.md` for language forwarding parity.

### Alternatives considered

- **Selected — fixed `X-Lang` header, resolved per completion:** mirrors `X-Timezone`, no new configuration surface; deployments point DIAL Core's own `PROXY_LANGUAGE_HEADER` setting at `X-Lang`.
- **Configurable header name via an env in chat-api (legacy PR #6488's `PROXY_LANGUAGE_HEADER` variable, default `accept-language` since #8377):** rejected — adds configuration surface and a second name source; the deployment standardizes on `X-Lang` (change recorded in `docs/legacy-chat-migration-guide.md`).
- **Language in the JSON completion DTO:** rejected — transport metadata does not belong in conversation content.
- **`Accept-Language` reuse:** rejected — the app's chosen UI locale is authoritative for the user's expectation, and DIAL Core reads `X-Lang`.

## Capabilities

### New Capabilities

- `browser-language-forwarding`: app language detection, the optional BFF `X-Lang` contract and validation, and propagation to every DIAL Core generation path.

### Modified Capabilities

- `chat-hooks-api-transport`: `createChatStreamApi` gains the optional `getLanguage` dependency and conditional `X-Lang` emission.

## Impact

- **Frontend:** `apps/chat/src/server-api/chat-stream.api.ts`, `apps/chat/src/utils/project-conversation-data-source.ts`, and tests; a locale resolver at the application edge.
- **Backend:** conversations controller, `lang-header.ts` validator, completions responder, conversation streaming service, background generation service, Chat Completions adapter, Responses adapter, and their tests.
- **API/OpenAPI:** `POST /api/v1/conversations/completions` gains one optional `X-Lang` request header; everything else unchanged. Generated client changes are additive via `npm run openapi`.
- **Documentation:** `docs/responses-api-integration.md`, the `browser-language-forwarding` spec, and `chat-hooks` README.
- **Dependencies and operations:** no new dependency, environment variable, feature flag, cache, metric, or deployment step.
- **Compatibility and rollback:** additive and non-breaking for callers that omit the header.
- **Scope:** no hand-authored `libs/*` behavior beyond the injected `getLanguage` dependency in `chat-hooks` (host capabilities pattern, same as `getTimezone`).
