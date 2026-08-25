## 1. Vertical Slice: Browser to DIAL Core Chat Completions

- [x] 1.1 Add a best-effort per-request browser timezone resolver in `apps/chat/src/utils/browser-timezone.ts`, wire conditional `X-Timezone` emission into `apps/chat/src/server-api/chat-stream.api.ts`, and keep the browser/header concern out of `libs/chat-hooks` and every other hand-authored `libs/*` package.
- [x] 1.2 Add dedicated unit coverage in `apps/chat/src/utils/tests/browser-timezone.spec.ts` and `apps/chat/src/server-api/tests/chat-stream.api.spec.ts` for a resolved timezone, re-resolution on consecutive sends, empty/throwing `Intl` results, header omission, and preservation of the existing completion request body/CSRF behavior.
- [x] 1.3 Add `apps/chat-api/src/conversations/utils/timezone-header.ts` with optional single-header validation (255-character limit, segment allowlist, and `Intl.DateTimeFormat` semantic validation), document the optional `X-Timezone` header with Swagger in `apps/chat-api/src/conversations/conversation.controller.ts`, and pass only the validated request-local value through `ConversationService` / `ConversationStreamingService` to the active `relayModelCompletion` SDK call in `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`.
- [x] 1.4 Add dedicated backend tests in `apps/chat-api/src/conversations/utils/timezone-header.spec.ts`, `apps/chat-api/src/conversations/tests/completions.integration.spec.ts`, and `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts` for valid, absent, unknown, malformed, oversized, and multi-value headers; assert invalid requests never reach the service/Core, valid values reach `sendChatCompletionRequest` unchanged, omitted values add no upstream header, concurrent calls do not share values, and logs contain no timezone.
- [x] 1.5 Verify the completed Chat Completions slice with `npm exec nx test @epam/chat`, `npm exec nx lint @epam/chat`, `npm exec nx typecheck @epam/chat`, `npm exec nx test @epam/chat-api`, `npm exec nx lint @epam/chat-api`, and `npm exec nx typecheck @epam/chat-api`; fix only failures caused by this slice before continuing.

## 2. Vertical Slice: Responses API Parity

- [x] 2.1 Thread the same validated optional timezone into `apps/chat-api/src/conversations/generation/responses.adapter.ts` and conditionally add `X-Timezone` to `DialClientService.client.createResponse` without changing generation selection, request bodies, SSE normalization, persistence, retry, abort, metrics, or error behavior.
- [x] 2.2 Extend the dedicated adapter coverage in `apps/chat-api/src/conversations/generation/responses.adapter.spec.ts` and the generation-selection coverage in `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts` to prove present and absent timezone behavior on the Responses request and parity with Chat Completions.
- [x] 2.3 Verify the Responses slice with `npm exec nx test @epam/chat-api`, `npm exec nx lint @epam/chat-api`, `npm exec nx typecheck @epam/chat-api`, and `npm exec nx build @epam/chat-api`; fix only failures caused by this slice before continuing.

## 3. Generated Contract and Documentation

- [x] 3.1 Regenerate the Swagger/OpenAPI artifacts with `npm run openapi`, then verify `libs/chat-api-client/openapi.json` and the generated `ConversationsApi.streamCompletion` contract expose optional `xTimezone?: string` while `SendCompletionDto` and the SSE response remain unchanged; do not hand-edit any file under `libs/chat-api-client/src/generated/`.
- [x] 3.2 Confirm the existing generated API singleton in `apps/chat/src/server-api/api-client.ts` remains the owner of `ConversationsApi` and needs no new singleton, while `apps/chat/src/server-api/chat-stream.api.ts` intentionally continues its raw SSE `fetch` path because neither the normal nor `Raw` generated method exposes the required live stream.
- [x] 3.3 Run `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache`, `npm exec nx lint chat-api-client`, and `npm exec nx typecheck chat-api-client`; verify the generated-client-only library exception contains no hand-authored app behavior or manual generated-file changes.
- [x] 3.4 Update `docs/responses-api-integration.md` with the browser-to-BFF-to-DIAL-Core timezone header flow for both generation modes and describe the actual runtime Chat Completions relay accurately; do not introduce i18n, UI, RTL, accessibility, feature-flag, cache, rate-limit, or telemetry documentation because those contracts are unchanged.
- [x] 3.5 Run `npm run validate:docs` after the integration document and generated client public contract changes, and correct only documentation drift introduced by this change.

## 4. Final Verification and Scope Audit

- [x] 4.1 Run `npm exec nx affected --target=test --base=origin/development`, `npm exec nx affected --target=lint --base=origin/development`, `npm exec nx affected --target=typecheck --base=origin/development`, and `npm exec nx affected --target=build --base=origin/development` as the final affected-set verification.
- [x] 4.2 Review the final diff against `specs/browser-timezone-forwarding/spec.md`: confirm the header is optional and request-local, both upstream generation paths are covered, invalid values fail before Core, timezone values are absent from logs/metrics/storage, no user-visible strings or feature gate were added, TypeScript source imports remain extensionless, and unrelated cleanup (including the dormant Chat Completions adapter refactor) is excluded.

## 5. Temporary Header Diagnostics

- [x] 5.1 Add a temporary debug-level dump of incoming completion request headers for #8442 verification, keeping authentication, cookie, CSRF, token, secret, and API-key values redacted and covering the redaction behavior with an integration test.
- [x] 5.2 Remove the temporary header dump and its dedicated test after propagation is verified, then repeat the final lint/test checks so the no-timezone-in-logs requirement is restored before archive.
