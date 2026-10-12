Slicing strategy: vertical. Slice 1 makes the lib capable and leaves it inert by default. Slice 2 turns it on in the chat app end to end. Slice 3 covers docs and the final gate.

## 1. Library: opt-in direct preview for file citations (`libs/quotations`)

- [x] 1.1 Create `libs/quotations/src/utils/citation-source-kind.ts`.
  - It exports `isWebLinkAnnotation(annotation: Annotation): boolean`, which is true when `annotation.body?.source?.attachment?.type` is `MIMEType.HTML` or `MIMEType.XHTML`.
  - Use a const arrow function with JSDoc.
  - Keep the helper internal: do not export it from `src/index.ts`.
  - Add `libs/quotations/src/utils/tests/citation-source-kind.spec.ts` covering html, xhtml, pdf, Office and missing-type sources.
  - Verification: `npm run test:file -- libs/quotations/src/utils/tests/citation-source-kind.spec.ts`
- [x] 1.2 In `libs/quotations/src/components/CitationCard/CitationCard.tsx`, replace the inline MIME check in `isWebLink` with `onPreview == null || isWebLinkAnnotation(annotation)`. This must not change behaviour.
  - Verification: `npm run test:file -- libs/quotations/src/components/CitationCard/tests/CitationCard.spec.tsx`
- [x] 1.3 Add `previewFilesOnMarkerClick?: boolean` (default `false`, with JSDoc) to `CitationDropdownProps` in `libs/quotations/src/components/CitationDropdown/CitationDropdown.tsx`.
  - Change `handleMarkerOpen` to preview directly when `handlePreview && (isPreviewOpen || (previewFilesOnMarkerClick && !isWebLinkAnnotation(annotation)))`. Otherwise open the card.
  - Update the `useCallback` deps.
  - Add tests in `libs/quotations/src/components/CitationDropdown/tests/CitationDropdown.spec.tsx`, querying by role/label:
    - a PDF marker with the flag calls `onPreview` once and no `dialog` appears;
    - an html marker with the flag opens the dialog;
    - with the flag on, `isPreviewable` → false opens the dialog;
    - without the flag, a PDF marker opens the dialog;
    - keyboard activation of a PDF marker with the flag calls `onPreview`.
  - Verification: `npm run test:file -- libs/quotations/src/components/CitationDropdown/tests/CitationDropdown.spec.tsx`
- [x] 1.4 Add the optional `previewFilesOnMarkerClick` to `UseCitationMarkdownComponentsCallbacks` in `libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx`, with JSDoc and default `false`.
  - Forward it to each rendered `CitationDropdown`, keeping the existing memo inputs so `markdownComponents` stays independent of popup state.
  - Add tests in `libs/quotations/src/hooks/useCitationMarkdownComponents/tests/useCitationMarkdownComponents.spec.tsx` for two cases: the flag is forwarded, and a repeated PDF `cit` id previews once with the reference-identical annotation and renders no card.
  - Verification: `npm run test:file -- libs/quotations/src/hooks/useCitationMarkdownComponents/tests/useCitationMarkdownComponents.spec.tsx`
- [x] 1.5 Architecture guard. Confirm the `libs/quotations` diff adds no host-owned knowledge:
  - no `isDialFileId` or DIAL file-id parsing;
  - no `/api` paths;
  - no imports of `apps/chat` code, contexts, i18n, attachment-canvas hooks, or the generated API client.
  - Only the boolean and the MIME helper are new. Keep relative imports extensionless.
- [x] 1.6 Run `npm run verify:changed` for the slice.

## 2. App: enable for inline citations (`apps/chat`)

- [x] 2.1 In `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`, add `previewFilesOnMarkerClick: true` to the `citationCallbacks` `useMemo` object. Do not touch the reference-chip `CitationDropdown` row.
- [x] 2.2 Extend `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx` with these cases:
  - with the canvas closed, clicking an inline PDF/DIAL-file citation marker opens the canvas and renders no citation dialog;
  - clicking a `text/html` inline citation marker renders the citation dialog;
  - clicking a reference-only PDF-page chip still renders the citation dialog.
  - Verification: `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`
- [x] 2.3 Run `npm run verify:changed` for the slice.

## 3. Docs and final gate

- [x] 3.1 Update `libs/quotations/README.md` in two places: the `CitationDropdown` section (next to the `isPreviewOpen` paragraph) and the `useCitationMarkdownComponents` callbacks list. Document `previewFilesOnMarkerClick`: what it does, its `false` default, and the web-link exception. Then run `npm run validate:docs`.
- [x] 3.2 Run `npm run validate:specs` and `openspec validate open-file-citations-in-canvas`.
- [x] 3.3 Run `npm run verify:full` once to close the change. (Blocked by an Nx workspace-data lock held by another process, `os error 32`; the same checks were run directly on the changed projects instead: `tsc --build` for `libs/quotations` and `apps/chat`, ESLint, all `libs/quotations` specs and `ConversationMessageItem.spec.tsx`.)
