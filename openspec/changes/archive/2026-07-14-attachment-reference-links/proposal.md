## Why

Assistant responses that carry RAG/search-grounding results (Google search grounding, the old DIAL RAG app's PDF chunks) expose each chunk as a `MessageAttachment` in `custom_content.attachments` with `title`, `data` (the quoted excerpt), and `reference_url`/`reference_type` — but no `url`. `useAttachmentAction.handleAttachmentClick` only acts on a DIAL-hosted `url`, so these tiles render in the attachment tray but the link icon does nothing and clicking is a no-op. Users cannot reach the cited source, reproducing the reported regression against the old DIAL RAG app's "click chunk → navigate to source" behavior.

## What Changes

- Group reference-only attachments (`url` absent, `reference_url` present) by `reference_url`, reusing the existing `groupAnnotationsBySource` grouping core, so repeated chunks from the same source collapse into one group with a Prev/Next switcher.
- Render one clickable chip per group using the existing `CitationDropdown`/`CitationCard` popup (title + quoted excerpt + an "Open in browser" action), instead of a dead `AttachmentCard` tile.
- Remove reference-only attachments from the plain attachment tray (`AttachmentTray`) so the non-functional tile no longer appears.
- Clicking "Open in browser" opens `reference_url` as-is in a new tab (or triggers the DIAL-file download anchor when the URL is DIAL-hosted) — no page-anchor/PDF-page navigation is attempted.
- Extract the DIAL-file-download-anchor / `window.open` branching (currently inlined in `useCitationMarkdownComponents`) into a shared util so inline citations and the new reference chips use the same logic.
- `CitationCard`/`CitationDropdown`'s `onPreview` becomes optional: the "Preview" button is hidden when omitted (reference chunks have nothing previewable), and the remaining button is always labelled "Open in browser" in that case.
- `CitationMarker` gains an optional link-icon prop, rendered before the label, to satisfy the "link icon next to attachment name" affordance; existing inline citation markers are unaffected (icon omitted there).
- Reference-only attachments whose `reference_url` points at a PDF file with an optional `#page=N` fragment (the old DIAL RAG app's PDF-chunk shape, observed inside both top-level `custom_content.attachments` and per-stage `custom_content.stages[].attachments`) open in the attachment canvas scrolled to the referenced page, the same way a regular PDF citation's "Preview" button does — instead of opening the chunk's raw (often garbled OCR) `data` as Markdown.
- This PDF-page behavior applies everywhere a reference-only attachment can be clicked: the new reference-chip row (`ConversationMessageItem`'s `onPreview` handler) and the generic attachment-card click path used for stage attachments and elsewhere (`useOpenAttachmentCanvas`, `useAttachmentAction`), so stage attachments inside `CollapsedGroup` get the same fix without a second implementation.
- The shared `MessageAttachment`→`DisplayAttachment` mapper now infers a reference-only attachment's `contentType` from `reference_type` or the `reference_url` file extension (falling back to the chunk's own `type`), so a PDF-page reference displays and behaves as a PDF (correct icon, correct canvas routing) everywhere it's rendered, rather than inheriting the chunk data's own MIME type (e.g. `text/markdown`).

## Capabilities

### New Capabilities

- `attachment-reference-links`: grouping reference-only `MessageAttachment`s by `reference_url` into citation-style groups, rendering them as a dedicated chip row in the assistant message, the shared "open source" action util, and PDF-page canvas preview.

### Modified Capabilities

- `citation-card`: `onPreview` becomes optional on `CitationCard`/`CitationDropdown`; footer renders a single "Open in browser" button when `onPreview` is absent.
- `citation-marker`: `CitationMarker` accepts an optional icon rendered before its label.
- `attachment-response-display`: reference-only attachments (no `url`, has `reference_url`) are excluded from the `AttachmentTray` passed to `AssistantMessageBubble`.
- `attachment-display-mapping`: the shared mapper infers `contentType` for reference-only attachments from `reference_type`/the `reference_url` extension.
- `attachment-card-click`: `useAttachmentAction`'s default click handler now also resolves reference-only attachments (PDF-page canvas preview, or DIAL-file-download/`window.open` otherwise) instead of no-oping when `url` is absent.
- `canvas`: `useOpenAttachmentCanvas` routes reference-only PDF-page attachments straight to a highlighted, page-scrolled `PdfCanvasContent`, ahead of its normal MIME/extension routing.

## Impact

- `apps/chat/src/utils/reference-attachment.ts` (new): filter + grouping + `parsePdfPageReference`.
- `apps/chat/src/utils/annotation.ts`: new exported `openAnnotationAttachment` util; strips a `#...` fragment before DIAL-file-id detection.
- `apps/chat/src/utils/attachment-canvas.ts`: new exported `referenceAttachmentToPdfCanvasContent`.
- `apps/chat/src/utils/dial-file.ts`: `resolveDialUrl` strips a `#...` fragment before resolving the DIAL download URL.
- `apps/chat/src/hooks/citations/useCitationMarkdownComponents.tsx`: use the extracted util instead of inlining it.
- `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`: routes reference-only PDF-page attachments to the canvas ahead of MIME/extension routing.
- `apps/chat/src/hooks/attachment/useAttachmentAction.ts`: default click handler now handles reference-only attachments.
- `apps/chat/src/components/Citations/CitationCard/CitationCard.tsx`, `CitationDropdown/CitationDropdown.tsx`: optional `onPreview`.
- `apps/chat/src/components/Citations/CitationMarker/CitationMarker.tsx`: optional icon prop.
- `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`: filter tray attachments, render the new reference chip row (with `onPreview` wired to the PDF-page canvas when applicable), share the existing `useCitationCard`/`CitationCardContext` instance.
- `libs/chat-shared/src/utils/message-attachment-to-display.ts`: infer `contentType` for reference-only attachments.
- No changes to `libs/attachment-input`, `libs/conversation-messages`, or any `DisplayAttachment`/`MessageAttachment` type (fields already exist).
