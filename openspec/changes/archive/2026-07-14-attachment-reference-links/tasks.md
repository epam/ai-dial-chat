## 1. Shared utilities

- [x] 1.1 Extract `openAnnotationAttachment(attachment: AttachmentResource): void` into `apps/chat/src/utils/annotation.ts`, moving the DIAL-file-id/`window.open` branch out of `useCitationMarkdownComponents.tsx`.
- [x] 1.2 Update `useCitationMarkdownComponents.tsx`'s `onOpenInBrowser` to call `openAnnotationAttachment` instead of inlining the logic; keep its existing tests passing.
- [x] 1.3 Create `apps/chat/src/utils/reference-attachment.ts` with `isReferenceOnlyAttachment` and `getReferenceAttachmentGroups`, delegating grouping to `groupAnnotationsBySource`.
- [x] 1.4 Add `apps/chat/src/utils/tests/reference-attachment.spec.ts` covering: url+reference_url present (not reference-only), reference_url-only (reference-only), grouping/dedup of repeated `reference_url`s, empty/undefined input.

## 2. Citation component changes

- [x] 2.1 Make `onPreview` optional on `CitationCardProps` and `CitationDropdownProps`; hide the "Preview" `PrimaryButton` in `CitationCard.tsx` when `onPreview` is absent.
- [x] 2.2 In `CitationCard.tsx`, when `onPreview` is absent, always label the remaining footer button via `CitationsI18nKeys.PopupOpenInBrowser` (skip the MIME-based `isWebLink` branch).
- [x] 2.3 In `CitationDropdown.tsx`, only wrap/forward a preview handler (and call `citationCard.closePopup()` on it) when `onPreview` is provided.
- [x] 2.4 Update `CitationCard.spec.tsx` and `CitationDropdown` tests: Preview button hidden and single "Open in browser" button shown when `onPreview` is omitted; existing behavior unchanged when it's provided.
- [x] 2.5 Add an optional `icon?: ReactNode` prop to `CitationMarker.tsx`, rendered before the label inside the `NeutralButton`; default `undefined` (no visual change for existing callers).
- [x] 2.6 Update `CitationMarker.spec.tsx` to cover: no icon by default, icon rendered before label when provided.

## 3. Wire into `ConversationMessageItem`

- [x] 3.1 Compute `referenceGroups = useMemo(() => getReferenceAttachmentGroups(msg.custom_content?.attachments), [msg.custom_content?.attachments])` in `ConversationMessageItem.tsx`.
- [x] 3.2 Filter reference-only dtos (`isReferenceOnlyAttachment`) out of the array passed to `attachmentDtosToDisplayAttachments` at the assistant-message render call site.
- [x] 3.3 Add a `handleOpenReferenceInBrowser` callback that extracts `annotation.body.source.attachment` and calls `openAnnotationAttachment`.
- [x] 3.4 Extend the existing `afterContent` block to prepend a `flex flex-wrap gap-2` row of `CitationDropdown`s (one per `referenceGroups` entry, keyed by `group.sourceUrl`, `icon={<IconLink size={14} aria-hidden />}` passed through to the underlying `CitationMarker`, no `onPreview`) when `referenceGroups.length > 0`; keep the existing stage/error rendering unchanged when it's empty.
- [x] 3.5 Confirm the row shares the existing `useCitationCard()`/`CitationCardProvider` instance already created in this component — no second provider.

## 4. Tests and verification

- [x] 4.1 Add/extend `ConversationMessageItem` tests: reference-only attachment excluded from tray; chip row renders one entry per group; clicking a chip opens the popup; message with no reference-only attachments renders no chip row.
- [x] 4.2 Run `npm exec nx test chat` and `npm exec nx lint chat`; fix any findings.
- [x] 4.3 Manually verify in the running app (`npm start`) using a conversation payload shaped like the reported bug (attachments with `title`/`data`/`reference_url`, no `url`): the dead tile is gone, the reference chip renders with a link icon, opening it shows the quoted excerpt, and "Open in browser" opens `reference_url` in a new tab; confirm existing inline-citation rendering is unaffected.

## 5. PDF-page reference attachments open in the canvas

- [x] 5.1 Add `parsePdfPageReference(url): { baseUrl, page: number | null } | null` to `apps/chat/src/utils/reference-attachment.ts`; use it in `getReferenceAttachmentGroups` to set the synthetic annotation's attachment `type` to `application/pdf` when detected.
- [x] 5.2 Add `referenceAttachmentToPdfCanvasContent(attachment): PdfCanvasContent | null` to `apps/chat/src/utils/attachment-canvas.ts`, building a page-scoped invisible highlight (`id`/`selectedHighlightId` unique per page) when a page is present, or a plain PDF payload when not.
- [x] 5.3 Strip a trailing `#...` fragment before DIAL-file-id resolution in `resolveDialUrl` (`dial-file.ts`) and `openAnnotationAttachment` (`annotation.ts`), so a `#page=N` fragment doesn't corrupt the resolved download URL.
- [x] 5.4 In `ConversationMessageItem.tsx`, pass `onPreview` (opens the canvas) to a reference chip's `CitationDropdown` when its group is PDF-page-detectable; keep `onOpenInBrowser` (raw download) unconditional.
- [x] 5.5 In `useOpenAttachmentCanvas.ts`'s `openFileCanvas`, try `referenceAttachmentToPdfCanvasContent` before the MIME/extension switch, so stage attachments (`CollapsedGroup`) and any other `DisplayAttachment` click path get the same fix.
- [x] 5.6 In `useAttachmentAction.ts`'s `handleAttachmentClick`, handle `referenceUrl`-only attachments (PDF-page canvas preview, else `openAnnotationAttachment`) instead of no-oping when `url` is absent.
- [x] 5.7 In `libs/chat-shared/src/utils/message-attachment-to-display.ts`, infer `contentType` for reference-only attachments from `reference_type`/the `reference_url` extension, so PDF-page references are typed `application/pdf` everywhere a `DisplayAttachment` is rendered.
- [x] 5.8 Add/extend unit tests: `reference-attachment.spec.ts` (`parsePdfPageReference`, type override), `attachment-canvas.spec.ts` (`referenceAttachmentToPdfCanvasContent`, incl. distinct-id-per-page), `useOpenAttachmentCanvas.spec.ts`, `useAttachmentAction.spec.ts`, `message-attachment-to-display.spec.ts` (chat-shared).
- [x] 5.9 Run `npm exec nx test chat`, `npm exec nx test ai-dial-chat-shared`, `npm exec nx lint chat`, `npm exec nx lint ai-dial-chat-shared`; fix any findings.
- [x] 5.10 Manually verify in the running app: a reference chunk shaped like `reference_url: 'files/{bucket}/report.pdf#page=N'` (from both top-level `custom_content.attachments` and per-stage `custom_content.stages[].attachments`) shows a PDF file-type icon (not Markdown) and opens the canvas scrolled to page N; switching between chips referencing different pages of the same already-open PDF re-scrolls to the new page.
