## 1. Contract and data preservation

Slicing strategy: **contract-first**, followed by one UI slice. Slice 1 establishes the additive DTO, generated model, normalization and stream/persistence contract; slice 2 consumes it in the existing interface. No parallel agents are required. Tasks within a slice depend on preceding production changes unless stated otherwise.

Architecture guard for every library task: keep endpoint paths, generated clients (except existing permitted `chat-hooks` type signatures), server-api imports, app contexts, auth/session/cookies/env, flags, routing, telemetry/logging clients, SDK setup, platform bridges and storage behavior outside hand-authored libs. The app supplies normalized stage data, labels, styles, streaming state and attachment callbacks. Use extensionless relative TypeScript imports, retain frontend bundler module resolution, and document changed public fields with JSDoc. Do not add dependencies or widen public exports for internal tree nodes.

- [x] 1.1 Add optional parent metadata to `libs/chat-shared/src/models/chat.ts`, `libs/chat-hooks/src/conversation/stage.ts` (`RawStage`) and `apps/chat-api/src/conversations/dto/stage.dto.ts`. Describe index/position semantics and add integer/minimum-zero Swagger and validation metadata. Preserve the current whole-conversation save-envelope policy.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/dto/stage.dto.spec.ts`; add assertions for accepted zero/positive values, omission, invalid negative/fraction/string values, and transforming nested message validation. Follow `apps/chat-api/AGENTS.md` and do not infer that the save envelope runs nested validation.

- [x] 1.2 Regenerate `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated` from the backend DTO using `npm run openapi` and `npm run openapi:check`. Check that `StageDto` gains only the intended field and `getConversation`/`saveConversation` operation names stay unchanged. Confirm existing wiring in `apps/chat/src/server-api/api-client.ts` and `conversations.api.ts` suffices; no new singleton/wrapper is needed.

  **Verification:** run `npm exec nx run chat-api-client:build`, `npm exec nx run chat-api-client:lint`, and `npm run test:file -- apps/chat/src/server-api/tests/conversations.api.spec.ts`. Add a typed parent-bearing save/get fixture to that existing suite. Never hand-edit generated files.

- [x] 1.3 Update `toStage` and `mapStages` in `libs/chat-hooks/src/conversation/stage.ts` to preserve parent zero and assign array positions to absent indexes only when mapping complete arrays. Preserve single-item `toStage` defaults and explicit sparse indexes; do not apply complete-array defaults to partial deltas.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/conversation/tests/stage.spec.ts`.

- [x] 1.4 Add dedicated normalization tests in `libs/chat-hooks/src/conversation/tests/stage.spec.ts`: three-level unindexed snapshot, explicit sparse identities, parent zero, missing/nullish parent, snake/camel source forms, unchanged attachments/status defaults, no input mutation, and generated DTO assignability.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/conversation/tests/stage.spec.ts`; test names describe normalized output rather than internal calls.

- [x] 1.5 Add opening-only parent regression cases to `libs/chat-hooks/src/conversation/useConversationStream/tests/apply-chunk.spec.ts` and `apps/chat-api/src/conversations/utils/apply-chunk.server.spec.ts`. Cover later text/attachment/status updates, interleaved children, explicit sparse indexes, empty chunks, legacy flat input and independent parent status. Keep production merge logic in its existing files unless a case demonstrates a loss.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/apply-chunk.spec.ts apps/chat-api/src/conversations/utils/apply-chunk.server.spec.ts`.

- [x] 1.6 Extend existing persistence/HTTP/replay tests with nested fixtures in `apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts`, `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`, and `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`. Prove terminal persistence, save/get round-trip and buffered/replayed parent metadata, retaining current validation and error behavior. No new controller or service is needed.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`. The HTTP tests must exercise the current controller/serialization path, not merely compare a constructed fixture with itself.

- [x] 1.7 Verify the completed data slice before starting the renderer.

  **Verification:** `npm run verify:changed` once for this slice; `npm run openapi:check` and `npm run validate:docs` for the public-model change. Resolve failures attributable to this slice.

## 2. Nested display through the existing app boundary

Depends on slice 1.

- [x] 2.1 Add internal `models/stage-tree.ts` and `utils/stage-tree.ts` under `libs/conversation-stages/src/` with O(n) forest derivation, stable encounter order and safe invalid-edge fallback. Adapt `models/stage-grouping.ts` and `utils/stage-grouping.ts` to group sibling nodes while retaining each attempt's descendants. Memoize derivation in `StagesPanel` using the stage-array reference.

  **Verification:** `npm run test:file -- libs/conversation-stages/src/utils/tests/stage-tree.spec.ts libs/conversation-stages/src/utils/tests/stage-grouping.spec.ts` (new suites in task 2.2).

- [x] 2.2 Add dedicated utility tests in `utils/tests/stage-tree.spec.ts` and `utils/tests/stage-grouping.spec.ts` for parent zero, multiple roots, at least three levels, interleaved siblings, sparse indexes, missing/self/forward/cyclic/malformed links, immutable inputs, same-name children under different parents and grouped parent attempts with distinct subtrees. Include a many-level fixture and verify each input node appears once without relying on wall-clock timing assertions.

  **Verification:** `npm run test:file -- libs/conversation-stages/src/utils/tests/stage-tree.spec.ts libs/conversation-stages/src/utils/tests/stage-grouping.spec.ts`.

- [x] 2.3 Extend `libs/conversation-stages/src/components/StagesPanel/StagesPanel.tsx` and `StageItem/StageItem.tsx` with recursive sibling rendering and a child-content slot. Keep markdown → attachments → children order and make child-only parents expandable. Retain local state keyed by stage identity across streaming updates and retry-group formation. Confirm the existing 2.0 `Accordion` public signature through the UI-kit MCP before changing its usage.

  **Verification:** `npm run test:file -- libs/conversation-stages/src/components/StagesPanel/tests/StagesPanel.spec.tsx libs/conversation-stages/src/components/StageItem/tests/StageItem.spec.tsx`.

- [x] 2.4 Extend the real-Accordion component tests in `StagesPanel/tests/StagesPanel.spec.tsx`, `StageItem/tests/StageItem.spec.tsx`, and `CollapsedGroup/tests/CollapsedGroup.spec.tsx`: child-only disclosure, multilevel content, group boundaries, retained expansion, parent/child status independence, flat compatibility, grandchild attachment callbacks, total/failure counts and unchanged durations. Verify keyboard toggling, `aria-expanded`, hidden-region `inert` behavior and focus. Use role/label/text queries.

  **Verification:** `npm run test:file -- libs/conversation-stages/src/components/StagesPanel/tests/StagesPanel.spec.tsx libs/conversation-stages/src/components/StageItem/tests/StageItem.spec.tsx libs/conversation-stages/src/components/CollapsedGroup/tests/CollapsedGroup.spec.tsx libs/conversation-stages/src/utils/tests/stage-name.spec.ts`.

- [x] 2.5 Wire memoized `mapStages` output into the existing `CollapsedGroup` call in `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`. Preserve message data and the existing streaming/attachment integration. Cover live indexed data, unindexed history, initial data and post-completion/replayed snapshots in the app tests.

  **Verification:** `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`. Assert normalized props at the app boundary and use the library suites to assert the real hierarchy.

- [x] 2.6 Add the six specified `conversation.stages` keys to `apps/chat/src/i18n/locales/en.json` and enum entries to `apps/chat/src/constants/translation-keys.ts`; pass translated running/failed/count/attempt/copy/preview labels through the existing app call. Reuse current executed/step labels and keep i18n out of libraries.

  **Verification:** `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx libs/conversation-stages/src/components/StagesPanel/tests/StagesPanel.spec.tsx`; assert supplied label functions reach nested attempts and attachment controls.

- [x] 2.7 Implement mobile and RTL nesting in `libs/conversation-stages/src/components/StagesPanel/StagesPanel.module.scss` and affected stage markup: logical indentation, a cumulative indentation cap after level three, directional-chevron mirroring, `min-w-0`/wrapping, and 44px mobile controls. Preserve theme/typography props and avoid adding per-level wrapper padding that defeats the cap. Add a `dir="rtl"` regression in the component suite.

  **Verification:** `npm run test:file -- libs/conversation-stages/src/components/StagesPanel/tests/StagesPanel.spec.tsx libs/conversation-stages/src/components/StageItem/tests/StageItem.spec.tsx`; actual rendered-width checks belong to task 2.8, since jsdom does not perform layout.

- [x] 2.8 Add `apps/chat/browser-tests/nested-stages.browser.spec.mjs`, following the standalone Vite/Playwright fixture pattern in `text-refinement.browser.spec.mjs`, and an Nx `test-nested-stages-browser` target in `apps/chat/package.json`. Exercise the real stage components at 360/900/1280/1920px in LTR and RTL, including depth beyond three, long labels, attachment controls and nested keyboard focus. Assert no page-level overflow and mobile target dimensions. Use the existing Playwright dependency; no interactive authenticated app audit or new project is needed.

  **Verification:** `npm exec nx run @epam/chat:test-nested-stages-browser`. Also run `npm run test:file -- libs/conversation-stages/src/components/StagesPanel/tests/StagesPanel.spec.tsx` for the matching component behaviors. Close browsers/servers and keep generated fixture/build output outside tracked source.

  **Note:** the browser test passed during implementation but was removed from the PR before merge; it is not committed, so the layout guarantees above are no longer checked automatically.

- [x] 2.9 Verify the completed UI slice and library boundaries.

  **Verification:** `npm run verify:changed` once for this slice; `npm run build:quiet` because component styles and the library bundle changed. Inspect changed library imports against the architecture guard; verify no new app-aware behavior or unused public prop/export was introduced.

## 3. Documentation and completion

Depends on both slices.

- [x] 3.1 Update `libs/conversation-stages/README.md`, `libs/chat-shared/README.md` and `libs/chat-hooks/README.md` with the optional field, a valid nested example, complete-array index fallback, sibling retry grouping, fallback behavior, expansion rules and unchanged summary-duration policy. Keep examples consistent with exported types and the host callback boundary. No architecture structure, endpoint or overlay protocol changed; do not rewrite unrelated `docs/` sections.

  **Verification:** `npm run validate:docs`; `npm run test:file -- libs/chat-hooks/src/conversation/tests/stage.spec.ts libs/conversation-stages/src/components/StagesPanel/tests/StagesPanel.spec.tsx` if examples reveal any source change. Documentation-only edits do not require rerunning already-passing source tests.

- [x] 3.2 Run the final change verification and check acceptance-criterion coverage in the planning artifacts.

  **Verification:** `npm run openapi:check`, `npm run validate:docs`, `openspec validate support-nested-stages --strict --no-interactive`, then exactly one `npm run verify:full` after all implementation changes. Record the automated browser result separately; do not claim browser layout coverage from unit tests. Do not archive automatically as part of implementation.

Out-of-scope follow-ups, **not prerequisites or apply tasks**: extending outbound overlay protocol stages with parent metadata; changing duration-only summaries to infer parent/child timing overlap; correcting historical dependency-list drift in the existing stage spec. None belongs in the implementation diff for this change.
