# forward-browser-language-to-dial-core — tasks

## 1. Vertical Slice: App to DIAL Core Chat Completions

- [x] 1.1 Add optional `getLanguage?: () => string | undefined` to `CreateChatStreamApiDeps` in `libs/chat-hooks/src/conversation/create-chat-stream-api.ts` and conditionally emit `X-Lang` next to `X-Timezone`; update the chat-hooks README and the `chat-hooks-api-transport` spec delta.
- [x] 1.2 Wire an app-edge current-locale resolver into `apps/chat/src/server-api/chat-stream.api.ts` and `apps/chat/src/utils/project-conversation-data-source.ts` via `getLanguage` (`apps/chat/src/i18n/get-ui-language.ts`).
- [x] 1.3 Add `apps/chat-api/src/conversations/utils/lang-header.ts` with optional single-header validation (`LANG_HEADER`, `LANG_MAX_LENGTH = 35`, BCP-47-like `LANG_PATTERN`), Swagger-document the optional `X-Lang` header in `apps/chat-api/src/conversations/conversation.controller.ts` (and the project conversations controller), and thread the validated request-local value through `ConversationCompletionsResponder.streamCompletion` → `ConversationStreamingService.streamCompletion` → `ChatCompletionsAdapter.stream` upstream headers.
- [x] 1.4 Add backend tests: `lang-header.spec.ts` (19), completions integration coverage (valid, absent, invalid, oversized, multi-value; invalid never reaches Core), adapter coverage (present/absent), streaming-service coverage (forwarding, omission; concurrency covered by the existing timezone-isolation suite).
- [x] 1.5 Verified: full `apps/chat-api` vitest suite 6551/6551 passed; full `libs/chat-hooks` suite 2545/2545 passed. (`nx`-wrapped targets and the `apps/chat` vitest run cannot start in this workspace: pre-existing `@nx/vite` "nx-ready-signal.plugin" resolution failure, reproducible on clean HEAD.)

## 2. Vertical Slice: Responses API Parity

- [x] 2.1 Thread the same validated optional language into `apps/chat-api/src/conversations/generation/responses.adapter.ts` (both `stream` and `relay` signatures) and `background-generation.service.ts` (`BackgroundStartParams.lang` and the pass-through replay call), conditionally adding `X-Lang` to `createResponse` upstream headers.
- [x] 2.2 Extended `responses.adapter.spec.ts` and `conversation-streaming.service.spec.ts` for present/absent language behavior and parity with Chat Completions.

## 3. Generated Contract and Documentation

- [x] 3.1 Regenerate Swagger/OpenAPI with `npm run openapi`; verify optional `xLang?: string` on `StreamCompletionRequest`; do not hand-edit generated files. Regenerated `libs/chat-api-client/openapi.json` and the generated client (ConversationsApi gains `xLang?: string` and the `X-Lang` header emission); `npm run openapi:check` passes. Local toolchain notes: the openapi-spec script needs the validated env vars exported before the process starts, and the SDK step needs a JDK on `PATH` (`brew install openjdk`).
- [x] 3.2 Updated `docs/responses-api-integration.md` with the browser-to-BFF-to-DIAL-Core `X-Lang` flow for both generation modes; README updated. `npm run validate:docs` and `npm run validate:specs` pass (0 errors).

## 4. Final Verification

- [x] 4.1 Run affected test/lint/typecheck/build against `origin/development`: `nx test chat-api` (conversations suite 1189/1189), `nx test chat` (server-api/utils/i18n slices 266/266), `nx run-many -t lint -p chat-api,chat,chat-hooks` all green; `npm run openapi:check`, `validate:docs`, `validate:specs` pass.
- [x] 4.2 Audit the diff against `specs/browser-language-forwarding/spec.md`: optional, request-local, both generation paths covered, invalid values fail before Core, no language values in logs — covered by `lang-header.spec.ts`, completions integration tests, and adapter/streaming-service specs asserting header presence/absence.
