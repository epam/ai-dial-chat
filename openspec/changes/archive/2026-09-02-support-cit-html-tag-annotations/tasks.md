## 1. Shared types

- [x] 1.1 Add `HtmlTagSelector` (`{ type: 'html_tag'; tag: string; id: string }`) to `libs/chat-shared/src/models/annotation.ts` and include it in the `AnnotationSelector` union.
- [x] 1.2 Run `npm run test:file -- libs/chat-shared` (or the relevant type-check target) to confirm no existing consumer of `AnnotationSelector` breaks on the widened union.

## 2. Frontend normalization and merge (`libs/quotations`)

- [x] 2.1 Extend `normalizeRawAnnotations` in `libs/quotations/src/utils/annotation.ts` to recognize the `html_tag` + flat `body.source.url` wire shape (see design Decision 2), producing `body.source.attachment.url`/`.title` and preserving the `html_tag` selector, `index: undefined`.
- [x] 2.2 Add unit tests in `libs/quotations/src/utils/tests/annotation.spec.ts` (or sibling test file) for: the exact sample payload from the proposal (two `cit` ids, same source URL), the existing `attachment_index`/`pdf_region` shape (regression), and an entry matching neither shape (dropped).
- [x] 2.3 Update the annotation merge helper used by `libs/chat-hooks/src/conversation/useConversationStream/apply-chunk.ts` to match by `index` when both entries have one, otherwise by `target.selector.id` when both are `html_tag` selectors (design Decision 3) — never collapsing two distinct no-index entries.
- [x] 2.4 Add unit tests covering: two `html_tag` annotations in one chunk stay separate; a later chunk for the same `cit` id merges (concatenates `body.quote`); existing index-based merge scenarios still pass (regression).

## 3. Frontend grouping (`libs/quotations`)

- [x] 3.1 Add `groupKey: string` to the `AnnotationGroup` interface in `libs/quotations/src/utils/group-annotations-by-source.ts`; set `groupKey = sourceUrl` in `groupAnnotationsBySource` (unchanged value) and exclude `html_tag`-selector annotations from this function's grouping.
- [x] 3.2 Add `groupAnnotationsByCitId(annotations: Annotation[]): AnnotationGroup[]` in the same file, grouping `html_tag` annotations by `target.selector.id`, with `groupKey = `cit:${id}``, `sourceUrl` = first annotation's resolved attachment URL, `sourceName` via the same priority-order helper as `groupAnnotationsBySource` (extract a shared `resolveSourceName` helper to avoid duplicating the title/filename/hostname logic).
- [x] 3.3 Add `groupAnnotations(annotations: Annotation[]): AnnotationGroup[]` dispatcher that partitions by selector type and concatenates `groupAnnotationsByCitId` + `groupAnnotationsBySource` results; export it from `libs/quotations/src/index.ts` alongside the existing grouping exports.
- [x] 3.4 Add unit tests: two cit ids sharing one source URL produce two groups with distinct `groupKey`s and the same `sourceUrl`; two annotations sharing one cit id produce one group; `groupAnnotations` on a mixed list returns both group families; existing `groupAnnotationsBySource` scenarios still pass (regression).

## 4. Frontend streaming visibility (`libs/quotations`)

- [x] 4.1 Change `useAnnotations` (`libs/quotations/src/utils/useAnnotations.ts`) so that, while `isStreaming` is `true`, it returns `resolveMessageAnnotations(message).filter(a => a.target?.selector?.type === 'html_tag')` instead of `[]`; unchanged when `isStreaming` is `false`.
- [x] 4.2 Add unit tests: streaming with one `html_tag` + one `text_character_range` annotation returns only the `html_tag` one; streaming with no `html_tag` annotations returns `[]`; non-streaming behavior unchanged (regression).

## 5. Frontend tag injection (`libs/quotations`)

- [x] 5.1 Extend `injectCitationSentinels` (`libs/quotations/src/utils/citation-injection.ts`) with the three-pass algorithm from design Decision 5: (a) strip a trailing incomplete `<cit id="…">` fragment, (b) replace every complete `<cit id="…">` tag with its matching sentinel (looked up by scanning `groups` for an `html_tag` selector with that `id`) or with `''` when unmatched, (c) run the existing offset-based injection over the result for non-`html_tag` groups.
- [x] 5.2 Add unit tests: the exact sample sentence from the proposal (two `cit` tags, both matched) renders both markers at the right position with no raw tag text; an unmatched tag is stripped; a trailing incomplete tag fragment is stripped; existing offset-based injection scenarios still pass (regression).
- [x] 5.3 Update `useCitationMarkdownComponents` (`libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx`) so its `processedContent` computation runs whenever `groups.length > 0` **or** `content` contains `<cit` (not only when `groups.length > 0`), per design Decision 5 / the `quotations-citation-markdown` spec delta.
- [x] 5.4 Add a test confirming a zero-group message with an unmatched `<cit id>` tag still strips the tag and returns `markdownComponents: {}`.

## 6. Frontend groupKey-based popup state (`libs/quotations`)

- [x] 6.1 Rename the state/keys in `useCitationCard` (`libs/quotations/src/utils/useCitationCard.ts`) from `sourceUrl`-based (`openGroupSourceUrl`, `activeIndexByGroup` keyed by URL) to `groupKey`-based (`openGroupKey`), updating `openPopup`, `closePopup`, `setActiveIndex`, `isOpen`, `getActiveIndex` parameter names accordingly.
- [x] 6.2 Update `CitationDropdown` (`libs/quotations/src/components/CitationDropdown/CitationDropdown.tsx`) to call `citationCard.isOpen(group.groupKey)`, `getActiveIndex(group.groupKey)`, `openPopup(group.groupKey)`, `setActiveIndex(group.groupKey, i)` — keep `group.sourceUrl` only where it means "the attachment to preview/download".
- [x] 6.3 Update the React `key` prop in `useCitationMarkdownComponents`'s `renderMarker` from `` `citation-${group.sourceUrl}` `` to `` `citation-${group.groupKey}` ``.
- [x] 6.4 Update/rename existing `useCitationCard.spec.ts` tests for the `groupKey` vocabulary; add a test asserting two groups sharing one `sourceUrl` but different `groupKey`s have independent open/active-index state.

## 7. Backend persistence (`apps/chat-api`)

- [x] 7.1 In `apps/chat-api/src/conversations/utils/apply-chunk.server.ts`, add a server-local `normalizeRawAnnotationsServer(raw: unknown[], attachments: MessageAttachment[])` mirroring `libs/quotations`' `normalizeRawAnnotations` (both wire shapes), with no cross-import from `libs/quotations` (design Decision 6).
- [x] 7.2 Update `mergeAnnotations` in the same file to the `index`-then-`target.selector.id` match rule (mirrors task 2.3, design Decision 3).
- [x] 7.3 In `applyChunkToMessage`, read `delta.custom_fields?.annotations`, normalize it against the union of `existing.attachments` and this chunk's incoming `attachments` (`allAttachments`), and merge the result into `custom_content.annotations` using the updated `mergeAnnotations` — alongside the existing `delta.custom_content.annotations` handling, not replacing it.
- [x] 7.4 Update the `SseDelta`/`SseChunk` minimal types at the top of the file if needed so `delta.custom_fields.annotations` is typed (mirroring `custom_fields?: { annotations?: unknown[] }` already on `StreamChunkDelta` in `chat-shared`).
- [x] 7.5 Add unit tests in the server-side apply-chunk test file for: the exact sample `custom_fields.annotations` payload from the proposal persisting into `custom_content.annotations` with two distinct entries; a legacy `attachment_index` raw entry still normalizing; two `html_tag` entries in one chunk not collapsing; a later chunk merging into an existing `cit`-id entry (regression on existing index-based scenarios too).

## 8. Backend DTO (`apps/chat-api`)

- [x] 8.1 Add `AnnotationSelectorDto`, `AnnotationTargetDto`, `AttachmentResourceDto`, `AnnotationSourceDto` to `apps/chat-api/src/conversations/dto/annotation.dto.ts` per design Decision 7, with `class-validator`/`@ApiPropertyOptional` decorators matching the NestJS conventions in `apps/chat-api/AGENTS.md`.
- [x] 8.2 Add `body.source?: AnnotationSourceDto` to `AnnotationBodyDto` and `target?: AnnotationTargetDto` to `AnnotationDto`.
- [x] 8.3 Run `npm run openapi && npm run openapi:check` and rebuild/lint `chat-api-client` per the NestJS rules, since the DTO shape is part of the documented Swagger contract for persisted messages.

## 9. App wiring (`apps/chat`)

- [x] 9.1 Update the app's citation-rendering call site to call `groupAnnotations` (from `@epam/ai-dial-quotations`) instead of `groupAnnotationsBySource` directly.
- [x] 9.2 Grep `apps/chat/src` for any remaining direct use of `AnnotationGroup.sourceUrl` as an identity/key (vs. "the attachment URL") and switch those to `groupKey`.
- [ ] 9.3 Manually verify in the running app (`npm run start:all`) against a mocked/replayed SSE stream matching the proposal's sample payload: tags are hidden while streaming before the annotation chunk arrives, pills appear once it arrives (still mid-stream), Preview/Download work, and reloading the conversation still shows the pills. **Not performed in this session** — requires a live DIAL Core connection / browser session; unit and component tests cover every underlying piece (normalization, merge, grouping, streaming gate, tag injection, groupKey state) but not this end-to-end path.

## 10. Docs

- [x] 10.1 Update `libs/quotations/README.md`: document `HtmlTagSelector`, the dual-shape `normalizeRawAnnotations`, `groupAnnotationsByCitId`, `groupAnnotations`, and the `groupKey`-based `useCitationCard`/`CitationDropdown` usage examples (fix any example that still shows `sourceUrl`-keyed `openPopup`/`isOpen` calls).
- [x] 10.2 Run `npm run validate:docs` and fix any reported drift. (One pre-existing, unrelated failure remains in `libs/chat-hooks/README.md` — not touched by this change.)

## 11. Final verification

- [x] 11.1 Run `npm run verify:changed` (or the project's equivalent affected-lint/test/typecheck) across `libs/chat-shared`, `libs/quotations`, `libs/chat-hooks`, `apps/chat-api`, and `apps/chat`. (Nx's `nx affected`/`run-many` graph was broken by an unrelated concurrent worktree with duplicate project names — ran `tsc --build` and `vitest run` directly per project instead; all pass except pre-existing, untouched-file failures unrelated to this change.)
- [x] 11.2 Run the code-review-and-quality skill's five-axis review before merge, per `AGENTS.md`'s default behavior for implementation work. Found and fixed: (1) the earlier debug-logging change to the streaming adapters was leaking raw chunk content, violating an existing security test — fixed to log only chunk length; (2) the server-side `normalizeHtmlTagAnnotation` never inferred `body.source.attachment.type`, unlike its documented `libs/quotations` mirror — fixed with a local extension-based guess plus a regression test. A minor, low-severity streaming-edge-case note on the trailing-partial-tag regex was accepted as-is per the design doc's own risk language.
