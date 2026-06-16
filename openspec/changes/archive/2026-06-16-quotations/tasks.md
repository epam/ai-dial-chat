## 1. Shared Types — `libs/chat-shared`

- [x] 1.1 Create `libs/chat-shared/src/models/annotation.ts` exporting `TextCharacterRangeSelector`, `AnnotationSelector`, `AnnotationTarget`, `AttachmentResource`, `AnnotationSource`, `AnnotationBody`, and `Annotation` interfaces
- [x] 1.2 Extend the `Message` interface in `libs/chat-shared/src/models/chat.ts` to add `custom_content.annotations?: Annotation[]`
- [x] 1.3 Export `Annotation` and related types from `libs/chat-shared/src/index.ts`
- [x] 1.4 Run `npm exec nx lint chat-shared && npm exec nx build chat-shared` and fix any errors

## 2. Data Utilities — `apps/chat`

- [x] 2.1 Create `apps/chat/src/utils/group-annotations-by-source.ts` exporting `AnnotationGroup` interface and `groupAnnotationsBySource` function (group by `body.source.attachment.url`, derive `sourceName` from URL path filename with hostname fallback)
- [x] 2.2 Add unit tests for `groupAnnotationsBySource` in `apps/chat/src/utils/tests/group-annotations-by-source.spec.ts`

## 3. Annotation Accumulation Hook — `apps/chat`

- [x] 3.1 Create `apps/chat/src/hooks/annotations/useAnnotations.ts` — returns empty array during streaming, full filtered array when complete
- [x] 3.2 Add unit tests for `useAnnotations` in `apps/chat/src/hooks/annotations/tests/useAnnotations.spec.ts`

## 4. Citation Popup State Hook — `apps/chat`

- [x] 4.1 Create `apps/chat/src/hooks/citations/useCitationPopup.ts` — tracks open group and active index per group
- [x] 4.2 Add unit tests for `useCitationPopup` in `apps/chat/src/hooks/citations/tests/useCitationPopup.spec.ts`

## 5. `CitationMarker` Component — `apps/chat`

- [x] 5.1 Create `apps/chat/src/components/Citations/CitationMarker/CitationMarker.tsx` — UI kit `Button` (neutral/outlined/small), overflow count label, `onOpen` callback
- [x] 5.2 Add i18n keys `citations.marker.label`, `citations.marker.labelWithOverflow`, `citations.marker.ariaLabel` to `apps/chat/src/i18n/locales/en.json`
- [x] 5.3 Add unit tests in `apps/chat/src/components/Citations/CitationMarker/tests/CitationMarker.spec.tsx`

## 6. `CitationPopup` Component — `apps/chat`

- [x] 6.1 Create `apps/chat/src/components/Citations/CitationPopup/CitationPopup.tsx` — `DialTooltip`-based popover with header (file icon + source name + looping switcher), body (title + optional quote), footer ("Preview" + "Download"/"Open in browser" depending on source type)
- [x] 6.2 Add i18n keys `citations.popup.switcher`, `citations.popup.preview`, `citations.popup.openInBrowser`, `citations.popup.download`, `citations.popup.previousCitation`, `citations.popup.nextCitation`, `citations.popup.ariaLabel` to `en.json`
- [x] 6.3 Add unit tests in `apps/chat/src/components/Citations/CitationPopup/tests/CitationPopup.spec.tsx`

## 7. Inline Marker Injection into Assistant Message Renderer — `apps/chat`

- [x] 7.1 Located assistant message markdown renderer and identified injection point (`ConversationMessageItem` → `MessageBubble` → `MDMessageViewer`)
- [x] 7.2 Implemented sentinel string injection (`⟦C{idx}⟧`) and `replaceSentinelsInChildren` post-processor splitting text nodes at offsets
- [x] 7.3 Wired `useAnnotations`, `groupAnnotationsBySource`, and `useCitationPopup` into `ConversationMessageItem`; markers suppressed when `isStreaming: true`
- [x] 7.4 Passed `onOpen` to `CitationDropdown` which wraps `CitationMarker` in a `DialTooltip` (controlled, `placement="bottom-end"`)
- [x] 7.5 Implemented `onPreview` handler — converts `annotation.body.source.attachment` to `DisplayAttachment` and invokes attachment-preview callback
- [x] 7.6 Implemented `onOpenInBrowser`/download handler — calls `window.open(url, '_blank', 'noopener,noreferrer')`
- [x] 7.7 Memoised processed content and markdown components with `useMemo`

## 8. `AssistantMessageBubble` Update — `libs/conversation-messages`

- [x] 8.1 Added `markdownComponents?: Components` prop to `AssistantMessageBubble` and threaded through to `MDMessageViewer`
- [x] 8.2 Verified citation popup "Preview" path calls the same `onAttachmentClick` callback as a direct tray card click

## 9. Integration & Verification

- [x] 9.1 Ran lint across affected projects and fixed all errors
- [x] 9.2 Ran tests across affected projects — all 368 tests pass
- [x] 9.3 No TypeScript errors
- [x] 9.4 Manual verification: citation markers render inline in assistant messages, popup opens on click, switcher loops, Preview/Download/Open-in-browser actions work, RTL layout correct
