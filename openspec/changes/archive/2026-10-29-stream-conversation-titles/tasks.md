## 1. Prove cancellation ownership before introducing a new transport

Slicing strategy: **risk-first**, followed by an end-to-end stream slice and a viewport-priority slice. Keep existing JSON behavior operational throughout. All TypeScript work uses extensionless relative code imports and preserves frontend bundler resolution. Follow the corresponding app AGENTS.md; unrelated diagnostics, Core indexing and other changes are outside this task list.

- [x] 1.1 Add dedicated unit regressions in `apps/chat-api/src/conversations/listing/tests/conversation-title-cache.service.spec.ts` for two consumers, last-consumer cancellation before/after admission, slot release after SDK settlement, late success/404 after a newer write, and simultaneous JSON/SSE ownership.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/listing/tests/conversation-title-cache.service.spec.ts`; deferred SDK promises must expose the incorrect behavior before the ownership change.

- [x] 1.2 Implement operation-owned cancellation/consumer leases in `apps/chat-api/src/conversations/listing/conversation-title-cache.service.ts`; thread cancellation through `conversation-titles.service.ts` and the existing JSON handler in `apps/chat-api/src/conversations/conversation.controller.ts`. Retain token isolation, all cache invalidation hooks and the global read/queue bounds.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/listing/tests/conversation-title-cache.service.spec.ts apps/chat-api/src/conversations/listing/tests/conversation-titles.service.spec.ts apps/chat-api/src/conversations/persistence/tests/conversation-title-cache.integration.spec.ts apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`.

## 2. Deliver a bounded stream through the generated API boundary

Depends on section 1. This slice introduces the additive endpoint while the UI still uses JSON.

- [x] 2.1 Add `apps/chat-api/src/conversations/dto/stream-conversation-titles.dto.ts` with request validation, discriminated event DTOs and concrete SSE examples; annotate `streamConversationTitles` in `conversation.controller.ts` with operation ID, string event-stream content, event-component schemas and pre-header error responses. Keep existing list/JSON operations compatible.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-title-stream.controller.integration.spec.ts` after its dedicated coverage is added in 2.4; inspect generated DTO validation for count, serialized bytes, duplicates and encoded IDs.

- [x] 2.2 Add dedicated service unit tests in `apps/chat-api/src/conversations/listing/tests/conversation-title-stream.service.spec.ts`. Use deferred promises to prove a fast frame arrives and the next queued ID starts while a slow peer is unresolved; cover partial/fatal failures, consecutive-failure cutoff, admission/output limits, deadlines and cleanup.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/listing/tests/conversation-title-stream.service.spec.ts`; assert observable ordering and concurrency, without wall-clock speed thresholds.

- [x] 2.3 Add the request-owned worker/writer orchestration in `apps/chat-api/src/conversations/listing/conversation-title-stream.service.ts`, reuse title resolution/cache ownership from `conversation-titles.service.ts`, and wire it through `conversation.module.ts`, `conversation.service.ts` and `conversation.controller.ts`. Reuse `apps/chat-api/src/common/utils/sse.ts` for initial/keepalive frames, drain waiting and cleanup. Enforce all design bounds, truthful terminal counts and stop-admission semantics without eagerly spawning every ID.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/listing/tests/conversation-title-stream.service.spec.ts apps/chat-api/src/conversations/listing/tests/conversation-title-cache.service.spec.ts apps/chat-api/src/common/utils/tests/sse.spec.ts`.

- [x] 2.4 Add dedicated Supertest/real-stream HTTP integration coverage in `apps/chat-api/src/conversations/tests/conversation-title-stream.controller.integration.spec.ts`, consuming bytes before response completion. Cover session/CSRF rejection, 400/413/503 before SSE, title delivery before a blocked read, terminal in-band errors, disconnect/slow receiver, JSON compatibility and no work after closure.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-title-stream.controller.integration.spec.ts apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`; the early-delivery assertion must fail if the handler buffers the whole response.

- [x] 2.5 Regenerate `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated` from the backend with `npm run openapi`; run `npm run openapi:check`, and build/lint `chat-api-client` through Nx. Confirm `ConversationsApi.streamConversationTitlesRaw`, typed request/events, media type and errors; reuse the existing singleton in `apps/chat/src/server-api/api-client.ts`, adjusting its exports only if required. Never hand-edit generated output.

  **Verification:** generated contract inspection plus `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-title-stream.controller.integration.spec.ts`; `npm exec nx run chat-api-client:build` and `npm exec nx run chat-api-client:lint`.

## 3. Consume each title in the existing history context

Depends on section 2. Complete one API-to-UI path before adding viewport priority.

- [x] 3.1 Add dedicated unit cases in `apps/chat/src/server-api/tests/conversation-title-stream.spec.ts` and `apps/chat/src/hooks/conversation/tests/useConversationTitleEnrichment.spec.tsx` for chunked UTF-8/CRLF/multi-line frames, comments, bounded buffers, malformed/duplicate/unknown IDs, terminal counts, early UI updates, budget continuation, interruption and restricted JSON fallback.

  **Verification:** `npm run test:file -- apps/chat/src/server-api/tests/conversation-title-stream.spec.ts apps/chat/src/hooks/conversation/tests/useConversationTitleEnrichment.spec.tsx`; retain existing rename/delete/cross-identity regressions with behavior-based test names.

- [x] 3.2 Implement a domain-local frame decoder in `apps/chat/src/server-api/conversation-title-stream.ts` and a typed streaming wrapper in `apps/chat/src/server-api/conversations.api.ts` using the generated Raw operation and existing singleton. Validate the event union at runtime and release/cancel the reader on every exit; do not introduce a direct `base.ts` REST helper or refactor generation streaming.

  **Verification:** `npm run test:file -- apps/chat/src/server-api/tests/conversation-title-stream.spec.ts apps/chat/src/server-api/tests/conversations.api.spec.ts`; include abort and non-2xx generated-client behavior.

- [x] 3.3 Replace the sequential JSON-only loop in `apps/chat/src/hooks/conversation/useConversationTitleEnrichment.ts`, keeping `apps/chat/src/context/ConversationsContext.tsx` as the history owner. Track unattempted versus settled IDs, bounded render-flush buffers, one active stream, finite continuations and identity-scoped capability fallback. Preserve snapshot/title revisions, local-title protection, deletion tombstones, rollback and pin/unread state.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/conversation/tests/useConversationTitleEnrichment.spec.tsx apps/chat/src/context/tests/ConversationsContext.spec.tsx`; prove a delivered title updates before an unresolved sibling and that EOF/error clears progress while retaining valid results.

- [x] 3.4 Run `npm run verify:changed` once for the completed end-to-end slice. Record any unrelated failures separately; fix failures caused by this slice before continuing.

  **Verification:** the section 2–3 test files plus the affected verification result; do not repeat the full workspace suite at this point.

## 4. Prioritize the visible rows through a library callback

Depends on section 3. This is the only hand-authored shared-library API change.

- [x] 4.1 Add viewport reporting regressions in `libs/conversation-panel/src/components/ConversationList/tests/ConversationList.spec.tsx` and forwarding cases in the corresponding `ConversationListSection` and `ConversationPanel` test files. Cover actual visible range versus overscan, group headers, duplicate IDs, collapsed/empty lists and unchanged-ID callback suppression.

  **Verification:** `npm run test:file -- libs/conversation-panel/src/components/ConversationList/tests/ConversationList.spec.tsx libs/conversation-panel/src/components/ConversationListSection/tests/ConversationListSection.spec.tsx libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx`.

- [x] 4.2 Add and thread `onVisibleConversationIdsChange` through `libs/conversation-panel/src/models/{conversation-list,conversation-list-section,panel-props}.ts` and the matching components, using the existing virtualizer callback. Update public exports if needed. Architecture guard: the library reports IDs only and must not acquire URLs, generated clients, app contexts, auth/session/env/feature flags, routing, telemetry, SDK setup or persistence knowledge.

  **Verification:** `npm run test:file -- libs/conversation-panel/src/components/ConversationList/tests/ConversationList.spec.tsx libs/conversation-panel/src/components/ConversationListSection/tests/ConversationListSection.spec.tsx libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx`; inspect the changed library imports and every callback forwarding path.

- [x] 4.3 Wire per-view visible-ID registrations from `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` to the existing `ConversationsContext` and enrichment hook. Prioritize at request creation with the initial bounded viewport-report wait, resample on continuation, and clear only the hidden/unmounted view's registration. Preserve eligibility of the full metadata history and memoize context/callback values.

  **Verification:** `npm run test:file -- apps/chat/src/context/tests/ConversationsContext.spec.tsx apps/chat/src/hooks/conversation/tests/useConversationTitleEnrichment.spec.tsx`; cover multiple registrations, no visible results, opening/closing mobile history and scrolling without a stream restart.

- [x] 4.4 Verify mobile/desktop and RTL parity, focus and polite status behavior in the shared panel tests. Reuse `conversationPanel.updatingTitles` from `apps/chat/src/i18n/locales/en.json` and `ConversationPanelI18nKeys.UpdatingTitles`; add no new strings, styling or flags. Keep active search matches and use the existing Highlight component.

  **Verification:** `npm run test:file -- libs/conversation-panel/src/components/ConversationList/tests/ConversationList.spec.tsx libs/conversation-panel/src/components/ConversationListSection/tests/ConversationListSection.spec.tsx apps/chat/src/context/tests/ConversationsContext.spec.tsx`; use role/label/text queries for user-visible behavior, including `dir="rtl"` and hidden-view cleanup.

- [x] 4.5 Run `npm run verify:changed` once after this viewport-priority slice, then build the shared panel through Nx to validate its public types and package boundary.

  **Verification:** section 4 test files, the affected result, and `npm exec nx run @epam/ai-dial-conversation-panel:build`.

## 5. Measure, document and close verification

Depends on sections 1–4. Metrics extend existing infrastructure rather than creating a separate observability subsystem.

- [x] 5.1 Add title-stream accounting and latency/result instruments in `apps/chat-api/src/telemetry/runtime-metrics.ts` and a focused `conversation-title-metrics.ts` module; include the route in `http-lifecycle-metrics.ts`. Wire measurements at cache admission/read and stream-write boundaries. Add dedicated unit cases for exporter disablement, coalesced-read counting, no-title streams and cleanup races.

  **Verification:** `npm run test:file -- apps/chat-api/src/telemetry/tests/runtime-metrics.spec.ts apps/chat-api/src/telemetry/tests/conversation-title-metrics.spec.ts apps/chat-api/src/telemetry/tests/http-lifecycle-metrics.spec.ts apps/chat-api/src/conversations/listing/tests/conversation-title-stream.service.spec.ts`; assert the fixed label vocabulary and no raw IDs/titles/credentials.

- [x] 5.2 Update `docs/architecture.md`, `docs/observability.md`, `libs/conversation-panel/README.md` and the four affected main OpenSpec capabilities to match the final implementation. Document the finite stream, compatibility fallback, viewport-priority limitation and unchanged Core body-read cost. Keep read latency, first-result timing and total response duration distinct.

  **Verification:** `npm run validate:docs`, `npm run validate:specs`, strict OpenSpec validation and inspection against the actual generated operation/props. Recheck the section 2–4 integration test names cited by the documentation if those files changed.

- [x] 5.3 Run exactly one final `npm run verify:full`, plus `npm run build:quiet` because the generated client and shared panel bundle changed. Review correctness, architecture/library isolation, security, bounded performance, documentation and responsive parity. Use the deferred-read fixtures to report first-result versus total completion behavior; record unrelated failures without widening this change.

  **Verification:** full verification/build results; `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-title-stream.controller.integration.spec.ts apps/chat/src/hooks/conversation/tests/useConversationTitleEnrichment.spec.tsx` only if final edits or unresolved findings require a focused rerun. Do not claim live Core latency improvement from local mocks.
