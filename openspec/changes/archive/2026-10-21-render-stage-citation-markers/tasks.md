Slicing strategy: **contract-first, then vertical**. Slice 1 adds the quotations API, slice 2 the
stages prop contract; each lands green on its own with the default (absent) behavior unchanged.
Slice 3 wires the host end to end. Slice 4 is docs/specs. The temporary `[#9257]` debug logging
in `apps/chat-api` (`citation-debug.server.ts` and its two call sites) is NOT part of this change
and must be reverted before the first commit.

## 0. Preparation

- [x] 0.1 Revert the uncommitted investigation logging: delete `apps/chat-api/src/conversations/utils/citation-debug.server.ts` and its `.spec.ts`, and remove the `describeCitationChunk` / `describeCitationSummary` calls and imports from `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts` and `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`.
  - Verification: `git status` shows no `apps/chat-api` changes.

## 1. Quotations: cit-only renderer and content preparation

- [x] 1.1 Add `prepareCitationContent(content, isStreaming)` to `libs/quotations/src/utils/citation-injection.ts` (returns `content` untouched without `<cit`; `stripCitTagsWhileStreaming` while streaming; `escapeUnsupportedCitTags` otherwise; no sentinels) and export it from `libs/quotations/src/index.ts`.
- [x] 1.2 Extract the `CitationDropdown`-building `renderGroup` and the literal-text fallback from `useCitationMarkdownComponents.tsx` into an internal helper under `libs/quotations/src/hooks/` shared by both hooks; `useCitationMarkdownComponents` keeps its exact behavior.
- [x] 1.3 Add `libs/quotations/src/hooks/useCitationTagRenderer/useCitationTagRenderer.tsx` (`(groups, callbacks, fallbackGroups = EMPTY)` → memoized `(dataId, children) => ReactNode`, resolution via `buildCitGroupsByTagId`, `groups` win collisions) with JSDoc explaining why it exists (markdown surfaces whose typography must not be replaced), and export it from `libs/quotations/src/index.ts`. Use a module-level empty-array default so the memo holds.
- [x] 1.4 Unit tests: `libs/quotations/src/hooks/useCitationTagRenderer/tests/useCitationTagRenderer.spec.tsx` (claimed id, pooled id, collision, unclaimed literal text, offset group ignored, reference stability) and `prepareCitationContent` cases in `libs/quotations/src/utils/tests/citation-injection.spec.ts`.
- [x] 1.5 Architecture guard: the new hook imports nothing from `react-i18next`, app modules, attachment-canvas, or DTO converters.
  - Verification: `npm run test:file -- libs/quotations/src/hooks/useCitationTagRenderer/tests/useCitationTagRenderer.spec.tsx libs/quotations/src/hooks/useCitationMarkdownComponents/tests/useCitationMarkdownComponents.spec.tsx libs/quotations/src/utils/tests/citation-injection.spec.ts`, then `npm run verify:changed`.

## 2. Conversation stages: `renderCitation` prop

- [x] 2.1 Add exported type `StageCitationRenderer` and optional `renderCitation` to `StagesPanelProps` in `libs/conversation-stages/src/models/stages-props.ts` and to `CollapsedGroupProps` in `libs/conversation-stages/src/models/collapsed-group.ts`, with JSDoc; export the type from `libs/conversation-stages/src/index.ts`.
- [x] 2.2 Thread `renderCitation` through `CollapsedGroup.tsx` → `StagesPanel.tsx` → `StageList.tsx` (both the list and its nested-children render paths) → `StageItem.tsx` → `StageMarkdownContent.tsx`, mirroring every `attachmentDisplayResolvers` forwarding site.
- [x] 2.3 In `StageMarkdownContent.tsx`, build the `components` map with `useMemo` and add `cit: (props) => renderCitation(props['data-id'], props.children)` only when `renderCitation` is set (`cit` isn't a JSX intrinsic — cast as the quotations hook does). Leave `classNames` untouched.
- [x] 2.4 Tests: `libs/conversation-stages/src/components/StageItem/tests/StageItem.spec.tsx` (renderer output replaces the element; literal text without renderer; paragraph keeps `typography.contentClassName`). The not-clipped check moved to 3.4: the lib cannot render a quotations `CitationDropdown`, and the kit `Dropdown` always mounts its open overlay through `FloatingPortal` and `libs/conversation-stages/src/components/CollapsedGroup/tests/CollapsedGroup.spec.tsx` (grandchild receives the renderer).
- [x] 2.5 Architecture guard: `libs/conversation-stages` has no import of `@epam/ai-dial-quotations`, `react-i18next`, `react-markdown` or any `apps/*` module; `package.json` dependencies unchanged.
  - Verification: `npm run test:file -- libs/conversation-stages/src/components/StageItem/tests/StageItem.spec.tsx libs/conversation-stages/src/components/CollapsedGroup/tests/CollapsedGroup.spec.tsx libs/conversation-stages/src/components/StagesPanel/tests/StagesPanel.spec.tsx`, then `npm run verify:changed`.

## 3. Host wiring in apps/chat

- [x] 3.1 Add `prepareStageCitations(stages, isStreaming)` to `apps/chat/src/components/ConversationView/utils/message-display.ts`: maps stages whose `content` includes `<cit` through `prepareCitationContent`, returns every other stage by reference.
- [x] 3.2 Unit test `apps/chat/src/components/ConversationView/tests/message-display.spec.ts` for `prepareStageCitations` (streaming hides, finished escapes malformed, untouched stages keep identity).
- [x] 3.3 In `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`: `renderStageCitation = useCitationTagRenderer(citationGroups, citationCallbacks, fallbackCitationGroups)`; `displayStages = useMemo(() => prepareStageCitations(stages, isStreaming), [stages, isStreaming])`; pass `stages={displayStages}` and `renderCitation={renderStageCitation}` to `CollapsedGroup`. Keep `hasStages` computed from the unprepared `stages`.
- [x] 3.4 Host tests in `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`: stage marker resolves from message annotations and opens the card; resolves from `fallbackCitationGroups`; unclaimed id shows literal text; streaming shows no marker and keeps partial markup literal; body and stage citing the same id open one card at a time.
  - Verification: `npm run test:file -- apps/chat/src/components/ConversationView/utils/tests/message-display.spec.ts apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`, then `npm run verify:changed`.

## 4. Docs and specs

- [x] 4.1 `libs/quotations/README.md`: document `useCitationTagRenderer` under Hooks and `prepareCitationContent` under Utilities, with compiling examples.
- [x] 4.2 `libs/conversation-stages/README.md`: add a "Stage citations" subsection (the `renderCitation` contract, literal-text default, forwarding to nested stages) and the `StageCitationRenderer` type; note under `CollapsedGroup` that `renderCitation` is forwarded like `attachmentDisplayResolvers`.
- [x] 4.3 Run `npm run validate:docs` and `npm run validate:specs`.

## 5. Final gate

- [x] 5.1 `npm run verify:full`.
  - Result: `typecheck:full` and `lint:check` pass; every project's tests pass except two failures that also occur on a clean `development` checkout and are unrelated to this change: `format:check` flags a local, git-excluded `bff-observability-local/bff-observability-plan.md`, and `libs/conversation-input/src/components/AddAttachmentButton/tests/AddAttachmentButton.prompts.spec.tsx` ("renders the overlay content in the desktop flyout on keyboard open") fails with `@epam/ai-dial-ui-kit` `0.16.0-dev.22`. Follow-up: fix that test separately.
