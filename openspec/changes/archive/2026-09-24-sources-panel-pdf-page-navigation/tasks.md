Slicing strategy: **vertical**.

- Slice 1 fixes the reported bug end to end for sources that already carry `#page=N` (reference-only attachments): the click handler only.
- Slice 2 widens the fix to annotation-derived sources and adds per-page rows.

Each slice can be verified on its own.

## 1. Slice 1: Sources-panel click honours `#page=N`

- [x] 1.1 In `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`, add the PDF page-reference branch to `handleSourceClick` (design D3).
  - Place it after the non-previewable early return.
  - When `parsePdfPageReference(url)?.page != null`, build the `DisplayAttachment` with `referenceUrl: url`, `url` undefined and `contentType: MIMEType.PDF`, then call `openAttachmentCanvas`.
  - On `false`: download `{ …, url: parsed.baseUrl }` for a DIAL file ID; otherwise call `window.open(url, '_blank', 'noopener,noreferrer')` with the fragment kept.
  - Import `parsePdfPageReference` from `@epam/ai-dial-quotations`. Keep the `useCallback` deps unchanged. Use extensionless relative imports.
  - The existing non-page path must stay byte-for-byte equivalent.
  - **Verification:** `npm run test:file -- apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx`
- [x] 1.2 Add behaviour tests to `apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx`.
  - Capture `onSourceClick` from the existing `@epam/ai-dial-source-panel` mock and mock `useOpenAttachmentCanvas`.
  - Cover these cases:
    - a DIAL `…pdf#page=81` source opens with `referenceUrl` set, `url` undefined and `contentType` PDF, and closes the sidebar;
    - an external `https://…/x.pdf#page=12` source opens with `referenceUrl`;
    - on canvas failure, a DIAL page reference downloads the fragment-free base file ID;
    - on canvas failure, an external page reference calls `window.open` with the `#page=N` URL;
    - a PDF URL without a fragment still opens with `url` set and no `referenceUrl`;
    - the web-search redirect URL still opens in a new tab.
  - **Verification:** `npm run test:file -- apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx`
- [x] 1.3 Run `npm run verify:changed` for the slice.

## 2. Slice 2: Page-qualified annotation sources, one row per page

- [x] 2.1 In `libs/chat-hooks/src/conversation-sources/useConversationSources/useConversationSources.ts`, compute each annotation's source URL (design D2).
  - When `getAnnotationPdfPage(annotation)` returns `N` and `parsePdfPageReference(att.url)?.page === null`, the source URL is `` `${att.url}#page=${N}` ``. Otherwise it is `att.url`.
  - Use that URL both for `seenUrls` dedup and for `QuotationSource.url`.
  - Keep `title` derived from the bare `att.url`.
  - Update the `sources` JSDoc on `UseConversationSourcesResult`: it is "deduplicated by URL, PDF sources qualified with `#page=N`".
  - Use a module-level `const` arrow helper if one is extracted.
  - **Verification:** `npm run test:file -- libs/chat-hooks/src/conversation-sources/useConversationSources/tests/useConversationSources.spec.ts`
- [x] 2.2 Add tests to `libs/chat-hooks/src/conversation-sources/useConversationSources/tests/useConversationSources.spec.ts`.
  - Build annotation fixtures with `pdf_bbox` selectors. Cover these cases:
    - a page-12 annotation yields `doc.pdf#page=12`;
    - pages 3 and 7 of the same PDF yield two rows, in order;
    - two page-3 citations yield one row;
    - no selector, a non-`.pdf` URL, or a URL that already has a fragment keeps the URL unchanged;
    - a reference-only `doc.pdf#page=3` followed by a page-3 annotation on `doc.pdf` yields one row (the reference wins).
  - **Verification:** `npm run test:file -- libs/chat-hooks/src/conversation-sources/useConversationSources/tests/useConversationSources.spec.ts`
- [x] 2.3 Confirm that opening a second page of an already-open PDF jumps to the new page.
  - In `libs/attachment-canvas/src/components/PdfContent/tests/` (co-located spec for `PdfContent.tsx`), assert that a rerender with a changed `selectedPageNumber` scrolls to the new page. If such a test already exists, cite it.
  - If the behaviour is missing, record it as a follow-up task instead of fixing it here (scope discipline).
  - **Verification:** `npm run test:file -- libs/attachment-canvas/src/components/PdfContent/tests/PdfContent.spec.tsx`
- [x] 2.4 Architecture guard for `libs/chat-hooks`: confirm the diff adds only `@epam/ai-dial-quotations` helper calls. It must add no hardcoded `/api` paths, generated-client or `server-api` imports, app contexts, env/feature flags, routing, i18n or telemetry.
- [x] 2.5 Run `npm run verify:changed` for the slice.

## 3. Docs and specs

- [x] 3.1 `libs/source-panel/README.md`, `QuotationSource` section: note that for PDF sources `url` may carry a `#page=N` fragment naming the cited page, and that the panel forwards it unchanged to `onSourceClick`.
- [x] 3.2 `libs/chat-hooks/README.md`, `useConversationSources` section: state that annotation-derived PDF sources are page-qualified (`#page=N`) and that `sources` holds one entry per distinct page-qualified URL.
- [x] 3.3 Run `npm run validate:docs`.

## 4. Close-out

- [x] 4.1 Run `npm run verify:full` once.
- [x] 4.2 Follow-ups to record in the PR description, not to implement:
  - page navigation for extensionless `application/pdf` URLs;
  - an optional "p. N" label on Sources rows;
  - ~~the `PdfContent` re-navigation fix~~ — not needed: task 2.3 found the page re-sync already implemented and added a regression test.
