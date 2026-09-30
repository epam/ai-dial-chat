# Tasks

> Superseded note: tasks 1–5 were originally implemented as a lib-local title/markdown/link block (see git history / earlier proposal wording). After finding the `AttachmentCard`/`AttachmentGroup` precedent in `libs/conversation-messages`, that rendering was replaced with the `AttachmentCard`-tile approach described below. All groups reflect the final, shipped implementation.

## 1. Dependency and model/prop surface

- [x] 1.1 Add `@epam/ai-dial-attachment-input` to `libs/conversation-stages/package.json` `dependencies` (matching the `libs/conversation-messages` precedent — a `dependency`, not a peer). Run `nx sync` to regenerate TS project references. Verify: `npm exec nx typecheck @epam/ai-dial-conversation-stages` passes.
- [x] 1.2 Replace `resolveAttachmentUrl?: (attachment: MessageAttachment) => string | undefined` with `onAttachmentClick?: (attachment: DisplayAttachment) => void` on `StagesPanelProps` (`stages-props.ts`) and `CollapsedGroupProps` (`collapsed-group.ts`); add `attachmentClickLabel?: string` to `StagesPanelLabels`/`CollapsedGroupLabels` (default `'Preview search result'`). Verify: `npm exec nx typecheck @epam/ai-dial-conversation-stages` passes.
- [x] 1.3 Confirm `DisplayAttachment` is already re-exported from the consuming apps via `@epam/ai-dial-chat-shared` (no new export needed from `conversation-stages/src/index.ts` — `StagesPanelProps`/`CollapsedGroupProps` were already exported). Verify: `npm exec nx build @epam/ai-dial-conversation-stages` succeeds.

## 2. `StageItem` rendering

- [x] 2.1 In `StageItem.tsx`, change `hasExpandableContent` to `!!stage.content || !!stage.attachments?.length`; add `onAttachmentClick` to `StageItemProps`. Verify: `StageItem.spec.tsx` cases for "disclosure button when only attachments" and "no toggle when neither content nor attachments".
- [x] 2.2 Map `stage.attachments` to `DisplayAttachment[]` via `messageAttachmentsToDisplayAttachments` (from `@epam/ai-dial-chat-shared`, memoized with `useMemo`), and render each as an `AttachmentCard` tile (from `@epam/ai-dial-attachment-input`) inside a `role="list"`/`role="listitem"` wrapping row below `stage.content`. Resolve a tile click's `id` back to its `DisplayAttachment` and invoke `onAttachmentClick`. Verify: `StageItem.spec.tsx` — tile-per-attachment in order, `onAttachmentClick` called with the mapped object, reference-only attachment still renders a tile, tile renders without a handler.
- [x] 2.3 Architecture guard: confirm `StageItem.tsx` still contains no hardcoded `/api` paths, generated API client imports, app-context imports, storage/env access, or other host-owned integration detail — the only host-facing surface is the `onAttachmentClick` callback prop. Verify: `git diff` review of the file.

## 3. Thread the prop through `StagesPanel` and `CollapsedGroup`

- [x] 3.1 In `StagesPanel.tsx`, accept `onAttachmentClick` and pass it to every `StageItem` render site and into `StageGroupRow` -> its own `StageItem` list. Verify: `StagesPanel.spec.tsx` case asserting the callback reaches a rendered attachment tile.
- [x] 3.2 In `CollapsedGroup.tsx`, accept `onAttachmentClick` and forward it to both `StagesPanel` call sites (single-stage early return and the multi-stage grouped render). Verify: `CollapsedGroup.spec.tsx` cases for both the single-stage and multi-stage-group forwarding paths.

## 4. App wiring

- [x] 4.1 In `ConversationMessageItem.tsx`, implement `handleStageAttachmentClick(attachment: DisplayAttachment)`: when `attachment.data` is present, `openCanvas({ type: AttachmentContentType.Markdown, text: attachment.data }, attachment.name)` (reusing the same `openCanvas`/`AttachmentContentType` primitive `handleTableOpenInCanvas` already uses for markdown tables); otherwise, when `attachment.referenceUrl` is present, open the `resolveMarkdownUrl`-resolved URL in a new tab. Wire it to `<CollapsedGroup onAttachmentClick={handleStageAttachmentClick} />`. Verify: no new resolver/canvas logic duplicated — both `openCanvas` and `resolveMarkdownUrl` were already imported and used elsewhere in this file.
- [x] 4.2 Extend `ConversationMessageItem.spec.tsx`: mock `CollapsedGroup` to render a clickable tile per stage attachment and invoke `onAttachmentClick` with a `DisplayAttachment`-shaped object; assert `openCanvas` is called with `AttachmentContentType.Markdown` content for a `data`-carrying attachment, and `window.open` is called with the resolved download URL for a reference-only attachment. Verify: `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`.

## 5. RTL and accessibility

- [x] 5.1 Confirm no new physical-direction Tailwind classes were introduced (`AttachmentCard` itself already handles its own RTL layout; the new wrapping row is a plain `flex flex-wrap gap-3` with no directional dependency). Verify: `git diff` grep for `ml-|mr-|text-left|text-right|pl-|pr-` — zero matches.
- [x] 5.2 Confirm attachment tiles are real interactive elements reachable by keyboard with an accessible name equal to the attachment's mapped `name`, and that `attachmentClickLabel` overrides `AttachmentCard`'s own default click label (which reads as a download/open action, not preview). Verify: `StageItem.spec.tsx`/`StagesPanel.spec.tsx`/`CollapsedGroup.spec.tsx` tile tests query by role `button` and accessible name.

## 6. Content-type correction (found during manual review of the live feature)

- [x] 6.1 Add `mapStageAttachmentsToDisplay` to `libs/conversation-stages/src/utils/stage-attachments.ts`: wraps `messageAttachmentsToDisplayAttachments` and overrides each mapped attachment's `contentType` with its original `MessageAttachment.type` when declared, matched back by the same `id` derivation the shared mapper uses (`url ?? data ?? title`) so the override survives the mapper's own de-duplication. `StageItem.tsx` now calls this instead of the generic mapper directly. Verify: `libs/conversation-stages/src/utils/tests/stage-attachments.spec.ts` — declared type wins over inferred type, falls back to inferred type when no declared type, multiple attachments map correctly, empty/undefined input returns `[]`. Run `npm run test:file -- libs/conversation-stages/src/utils/tests/stage-attachments.spec.ts`.

## 7. Full verification

- [x] 7.1 `npm exec nx lint @epam/ai-dial-conversation-stages -- --fix` and `npm exec nx lint @epam/chat -- --fix` — both clean (pre-existing warnings in unrelated files only).
- [x] 7.2 `npm exec nx test @epam/ai-dial-conversation-stages` (89 tests) and the affected app test files pass; `npm exec nx typecheck`/`build` clean for both `@epam/ai-dial-conversation-stages` and `@epam/chat`.

## 8. `/code-review-and-quality` fixes

- [x] 8.1 README (`libs/conversation-stages/README.md`) had no mention of the new `onAttachmentClick`/`attachmentClickLabel` props or the stage-attachment-tile rendering — found by the five-axis review's documentation-accuracy check. Fixed: added a "Stage attachments" section and updated the `StagesPanel`/`CollapsedGroup` examples. Verify: `npm run validate:docs`.
- [x] 8.2 `mapStageAttachmentsToDisplay`'s type-override lookup was last-write-wins, so a later attachment sharing a derived `id` with an earlier, surviving one (per `messageAttachmentsToDisplayAttachments`'s first-occurrence-wins de-dup) could overwrite the surviving tile's `contentType` with the wrong duplicate's declared type — found by the review's correctness pass. Fixed to first-occurrence-wins, matching the underlying mapper's own semantics. Verify: new regression case in `stage-attachments.spec.ts` (90 tests total), run via `npm run test:file -- libs/conversation-stages/src/utils/tests/stage-attachments.spec.ts`.
- [x] 8.3 `npm run verify:changed` re-run after both fixes — typecheck, lint, and tests all pass.
- [x] 7.3 `npm run verify:full` — `typecheck:full` and `lint:check` pass. `format:check` reports a pre-existing, untouched `apps/chat-api/README.md` formatting issue (not part of this diff). `test:full` reports one pre-existing, unrelated flaky failure in `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` (`apps/chat-api` is untouched by this change; the test passes in isolation on both baseline and this diff). `npm run validate:docs` passes (README requires no update — `attachment-input` is a plain `dependency`, not a peer, so it doesn't need a Peer Dependencies entry).
