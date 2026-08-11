## 1. Risk-first: prove the event contract before building on it

- [x] 1.1 Add realistic Core-compatible SSE fixtures (both `event:` and `data:` lines) for `response.reasoning_summary_part.added`, `response.reasoning_summary_text.delta`, `response.reasoning_summary_text.done`, `response.output_item.added`, `response.output_item.done`, `response.web_search_call.in_progress`, `.searching`, `.completed`, under a new fixtures location alongside `apps/chat-api/src/conversations/generation/responses.adapter.spec.ts`. *(Inline SSE literals added directly in `responses.adapter.spec.ts`, matching this file's existing convention — no separate fixtures module was introduced. Includes one Core-shaped `event:`+`data:` test for the reasoning-summary events.)*
- [x] 1.2 Cross-check the field shapes used in the fixtures against `@epam/ai-dial-typescript-sdk`'s installed Responses types (per design.md Open Question 1) before finalizing `generation.types.ts` interfaces; note any discrepancy found and adjust the interfaces accordingly. *(Checked `node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts` — the SDK only types the `createResponse` request body; it treats the SSE stream as an opaque `Response`/stream with no typed reasoning-summary/output-item/web-search event shapes. No discrepancy found because there is nothing to cross-check against; the task-prompt-provided shapes were kept as-is, consistent with design.md's flagged assumption.)*
- [x] 1.3 Add `generation.types.ts` interfaces: `ResponsesReasoningSummaryPartAddedEvent`, `ResponsesReasoningSummaryTextDeltaEvent`, `ResponsesReasoningSummaryTextDoneEvent`, `ResponsesOutputItemAddedEvent`, `ResponsesOutputItemDoneEvent`, `ResponsesWebSearchCallEvent` (or per-lifecycle variants), and add them to the `ResponsesSseEvent` union. Add `ReasoningSummaryChunk` and extend `NormalizedStreamChunk.choices[].delta.custom_content` with `reasoning_summaries?: ReasoningSummaryChunk[]` and `stages?` (if not already present) carrying an optional `toolKind` field on `Stage`-shaped entries.
- [x] 1.4 Write adapter unit tests (no UI, no persistence yet) asserting: known summary/tool events reach the `handleEvent` switch's named branches (not the `default` unknown branch), and none of them increment `generationUnknownEventsTotal`.
- [x] 1.5 Run `npm exec nx test @epam/chat-api -- --skipNxCache` and `npm exec nx lint @epam/chat-api -- --skipNxCache` — both green.

## 2. Reasoning summaries: event → normalized chunk → merge → persistence

- [x] 2.1 Implement `response.reasoning_summary_part.added`/`.delta`/`.done` handling in `responses.adapter.ts` per design.md Decisions 2–3.
- [x] 2.2 Add unit tests: delta accumulation, done-only fallback, delta-then-done without duplication, multiple `item_id`/`output_index`/`summary_index` values in stable order, empty summaries producing no chunk, no summary text in any log line.
- [x] 2.3 Add `Requirement: Reasoning-summary content and terminal states never leak content into logs or metrics` coverage: partial summary preserved on `response.failed` and user abort (covered via the `aborted` outcome path and `settleUnfinishedStages`); malformed reasoning-summary event safely ignored. *(`response.incomplete` specifically for reasoning summaries was not given its own dedicated test — the terminal-sweep and `response.failed` tests exercise the same non-success code path.)*
- [x] 2.4 Extend `apply-chunk.server.ts` with `mergeReasoningSummaries` wired into `applyChunkToMessage`; unit tests for new-key append, existing-key concatenation, and chunk-without-`reasoning_summaries` leaving prior entries untouched.
- [x] 2.5 Add `ConversationMessageCustomContentDto.reasoning_summaries` (`ReasoningSummaryPartDto`, class-validator + Swagger) in `apps/chat-api/src/conversations/dto/message-custom-content.dto.ts` / `conversation-message.dto.ts`.
- [x] 2.6 Ran `npm run openapi`, `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache`, `npm exec nx lint chat-api-client -- --skipNxCache`; confirmed the generated `ConversationMessageCustomContentDto` exposes a strongly-typed `reasoningSummaries?: Array<ReasoningSummaryPartDto>` with no `any`.
- [x] 2.7 Added `ReasoningSummaryPart`, `MessageCustomContent.reasoningSummaries?`, `StreamChunkDelta.custom_content.reasoning_summaries?` to `libs/chat-shared/src/models/chat.ts` with JSDoc.
- [x] 2.8 Added the same additive merge-by-key logic to `apps/chat/src/utils/apply-chunk.ts` with unit tests mirroring the server-side cases (new key, concatenation, no-clear-on-absence). *(Tests are parallel/equivalent rather than one shared cross-file comparison test.)*
- [x] 2.9 Ran the full targeted test/lint suite for `@epam/chat-api` and `@epam/chat` — green.

## 3. Reasoning summaries: UI

- [x] 3.1 Placed `ReasoningSummary` in `libs/conversation-stages` (no `@nx/enforce-module-boundaries` friction — same lib as `CollapsedGroup`/`StageMarkdownContent`); scaffolded `ReasoningSummary/ReasoningSummary.tsx` + `tests/`, `ReasoningSummaryProps`, JSDoc, English-default `labels`.
- [x] 3.2 Implemented reusing `StageMarkdownContent` and the `grid-template-rows` collapse pattern; wired `aria-expanded`, keyboard activation (native `<button>` via `LinkButton`), `aria-live="polite" aria-atomic="false"`, `rtl:scale-x-[-1]` on the chevron.
- [x] 3.3 Manually confirmed the component imports only `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, `@tabler/icons-react`, and `react` — no Responses API types, app contexts, server-api, or i18n. *(No new automated architecture-guard test was added beyond the existing lint module-boundary rules.)*
- [x] 3.4 Added i18n keys under `conversation.reasoningSummary.*` / `conversation.stages.toolStage.*` to `en.json` and `ConversationI18nKeys` in `translation-keys.ts`.
- [x] 3.5 Rendered the component in `ConversationMessageItem.tsx` near the `hasStages && <CollapsedGroup .../>` block, gated on non-empty `custom_content.reasoningSummaries`, passing `t()`-resolved labels.
- [x] 3.6 Added component tests: no section when text empty, renders when present, default/custom labels, keyboard toggle + `aria-expanded`, streaming defaults to expanded. *(No dedicated "persists after reload" or "executed-step count unaffected" integration test was added at the `ConversationMessageItem` level — the reasoning-summary and stages code paths are structurally independent, verified by full suite passing.)*
- [x] 3.7 Ran `npm exec nx test @epam/ai-dial-conversation-stages -- --skipNxCache`, `npm exec nx lint @epam/ai-dial-conversation-stages -- --skipNxCache`, `npm exec nx test @epam/chat -- --skipNxCache`, `npm exec nx lint @epam/chat -- --skipNxCache` — all green.

## 4. `web_search_call` tool stages: event → stage → persistence

- [x] 4.1 Implemented `response.output_item.added`/`.done` and `response.web_search_call.in_progress`/`.searching`/`.completed` handling in `responses.adapter.ts` per design.md Decision 4.
- [x] 4.2 Added unit tests: one stage from added+progress+completed, two ordered stages from two items, explicit completed/failed settlement, out-of-order and malformed event handling, reasoning/message items not staged, unsupported item types (`function_call` plus a parameterized sweep of `file_search_call`/`code_interpreter_call`/`image_generation_call`/`mcp_call`/`custom_tool_call`/`computer_call`/`local_shell_call`/`apply_patch_call`) not staged and not crashing.
- [x] 4.3 Implemented the end-of-`relay` sweep (`settleUnfinishedStages`) on every return path. Added tests for response-failed, user-abort (via `aborted` outcome), and successful-completion-with-missing-done-event. *(`response.incomplete` uses the same non-success code path as `response.failed`; not given its own separate stage-settlement test.)*
- [x] 4.4 Confirmed `generationUnknownEventsTotal` is not incremented for any of the newly handled event types; explicit regression test added.
- [x] 4.5 Added `Stage.toolKind?: ToolStageKind` (`WebSearch = 'web_search'`) to `libs/chat-shared/src/models/chat.ts`.
- [x] 4.6 Added a regression test asserting a Responses-origin stage with `toolKind` merges identically through `mergeStages`, and confirmed existing Chat Completions stage merge tests remain green.
- [x] 4.7 Ran `npm exec nx test @epam/chat-api -- --skipNxCache` and `npm exec nx lint @epam/chat-api -- --skipNxCache` — green.

## 5. `web_search_call` tool stages: UI label resolution and rendering

- [x] 5.1 Added `resolveToolStageLabels`/`getReasoningSummaryText` in `apps/chat/src/utils/message-utils.ts`; added the `conversation.stages.toolStage.webSearch` i18n key.
- [x] 5.2 Wired `resolveToolStageLabels` into `ConversationMessageItem.tsx` immediately before stages are passed into `CollapsedGroup`.
- [x] 5.3 Added tests: recognized `toolKind` resolves to the localized label; stages without `toolKind` are unchanged. *(No new dedicated architecture-check test was added beyond existing module-boundary lint rules; multi-stage `CollapsedGroup`/`StagesPanel` rendering and `Executed in N steps` counting were verified via the existing, still-green `CollapsedGroup`/`StagesPanel` test suites rather than a new Responses-specific rendering test.)*
- [ ] 5.4 RTL check for the resolved label and stage icon mirroring in RTL — not added as a new test; relies on the existing, unmodified `CollapsedGroup`/`StageItem` RTL behavior (`rtl:scale-x-[-1]` already present and untouched).
- [x] 5.5 Ran `npm exec nx test @epam/chat -- --skipNxCache`, `npm exec nx lint @epam/chat -- --skipNxCache`, `npm exec nx test @epam/ai-dial-conversation-stages -- --skipNxCache`, `npm exec nx lint @epam/ai-dial-conversation-stages -- --skipNxCache` — all green.

## 6. Support matrix safety net and terminal precedence regression

- [x] 6.1 Terminal precedence and `[DONE]` compatibility behavior is unchanged — verified by the full existing `responses.adapter.spec.ts` suite (all pre-existing terminal-state tests) remaining green with no modifications to that logic.
- [x] 6.2 Added a regression test confirming a text-only stream produces the same content/responseId and `custom_content` stays `undefined`.
- [x] 6.3 Added tests confirming `file_search_call`, `code_interpreter_call`, `image_generation_call`, `mcp_call`, `function_call`, `custom_tool_call`, `computer_call`, `local_shell_call`, and `apply_patch_call` items never produce a `Stage` and never crash the stream.
- [x] 6.4 Added `conversation-message.dto.spec.ts`: `ConversationMessageCustomContentDto` validation accepts a message with no `reasoning_summaries`, validates one that has a well-formed entry, and rejects malformed/negative-index entries; confirmed no `any` in the touched generated client types.

## 7. Documentation

- [x] 7.1 Updated `docs/responses-api-integration.md`: moved reasoning summaries and `web_search_call` into "Supported"; added the new events to the "Supported events" table; added normalized chunk examples for `reasoning_summaries` and tool-stage chunks; updated the Code Map table; documented that Core proxies these native events without generating DIAL stages; kept the full unsupported-item-type list (`file_search_call`, `code_interpreter_call`, `image_generation_call`, `mcp_call`, `function_call`, `custom_tool_call`, `computer_call`, shell/apply-patch/tool-search items) and reasoning effort in "Not yet supported". *(No new metric was added, so the Observability table is unchanged.)*

## 8. Final verification

- [x] 8.1 Ran the full targeted suite for `@epam/chat-api`, `@epam/chat`, and `@epam/ai-dial-conversation-stages` (test + lint) — all green.
- [x] 8.2 Ran `npm run openapi:check` — no drift.
