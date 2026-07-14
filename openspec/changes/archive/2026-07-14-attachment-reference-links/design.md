## Context

`MessageAttachment` (`libs/chat-shared/src/models/chat.ts`) already types `reference_url`/`reference_type`, and the DTO→display mapper (`message-attachment-to-display.ts`, wrapped by `apps/chat/src/utils/attachment-dto-to-display.ts`) already forwards `reference_url` onto `DisplayAttachment.referenceUrl`. Nothing downstream reads it: `useAttachmentAction.handleAttachmentClick` only resolves a DIAL-hosted `url`, so a chunk-style attachment (no `url`, only `reference_url`) renders a tile whose click and link-icon affordance are both dead.

The app already has a fully-built mechanism for the same underlying concept — "a quoted excerpt that cites a source, clickable to open/download that source" — for inline text citations: `groupAnnotationsBySource` groups `Annotation[]` by `body.source.attachment.url`, and `CitationDropdown`/`CitationCard` render a popup (title + quote + Preview/Open-in-browser footer) driven by `useCitationCard`/`CitationCardContext`. This change reuses that stack for `custom_content.attachments` entries that only carry a `reference_url`, rather than building a second, parallel "reference card" UI.

## Goals / Non-Goals

**Goals:**
- Make reference-only attachments clickable end-to-end: grouped by source, poppable, and able to open the cited `reference_url`.
- Reuse `groupAnnotationsBySource`, `CitationCard`, `CitationDropdown`, and `useCitationCard`/`CitationCardContext` as-is (or with additive, backward-compatible extensions) rather than duplicating them.
- Remove the dead tile from the attachment tray so the broken affordance disappears.

**Non-Goals:**
- ~~Page-level navigation (PDF page anchors, `#page=N`)~~ — **superseded by Decision 6.** The initial sample payload (Google grounding redirects) carried no reliable page/offset data, so `reference_url` was planned to open as-is. A second real payload (the old DIAL RAG app's PDF chunks) showed `reference_url` values like `files/.../report.pdf#page=81`; since a page anchor is directly actionable and the app already has the PDF-canvas/highlight machinery for exactly this case (regular citation "Preview"), this was pulled into scope rather than left broken.
- Any change to `DisplayAttachment`/`MessageAttachment` types — the fields needed already exist.
- Any change to `libs/attachment-input` or `libs/conversation-messages` — the fix stays entirely inside `apps/chat`, consistent with library isolation (citations already live at the app level).
- Deduplicating/altering how *file*-backed attachments (those with a real `url`) render — only `url`-absent, `reference_url`-present entries are affected.

## Decisions

### 1. Synthesize `Annotation`s from reference-only `MessageAttachment`s, reuse `groupAnnotationsBySource`

New `apps/chat/src/utils/reference-attachment.ts`:
- `isReferenceOnlyAttachment(dto: MessageAttachment): boolean` — `dto.url == null && dto.reference_url != null`.
- `getReferenceAttachmentGroups(dtos): AnnotationGroup[]` — maps each matching dto to a synthetic `Annotation` (`body.title = dto.title`, `body.quote = dto.data`, `body.source.attachment = { type: dto.reference_type ?? dto.type ?? '', url: dto.reference_url, title: dto.title }`), then delegates to the existing `groupAnnotationsBySource`.

**Alternative considered**: write a bespoke grouping function keyed on `reference_url` instead of reusing `groupAnnotationsBySource`. Rejected — the grouping rules (dedupe by URL, derive `sourceName`, preserve order) are identical to what citations already need; a second implementation would drift.

### 2. Extract the "open source" action into a shared util

`useCitationMarkdownComponents.tsx` currently inlines the DIAL-file-id → download-anchor / else `window.open` branch inside its `onOpenInBrowser` callback. Move it to `apps/chat/src/utils/annotation.ts` as `openAnnotationAttachment(attachment: AttachmentResource): void`, and have `useCitationMarkdownComponents` call it. The new reference-chip row calls the same function directly.

**Alternative considered**: duplicate the branch in a new hook. Rejected — this is exactly the kind of "same core" duplication the proposal is meant to avoid; a single source of truth also means future changes to DIAL-file detection apply to both flows automatically.

### 3. Make `CitationCard.onPreview` (and `CitationDropdown.onPreview`) optional

Reference-only chunks have nothing to preview: no local file, no PDF-canvas offset (no target/selector data at all — see Non-Goals). Rather than passing a no-op `onPreview` (which would render a "Preview" button that does nothing — the same class of bug this change fixes for the link icon), `onPreview?: (annotation: Annotation) => void` becomes optional on both components:
- When present (existing inline-citation call sites): behavior is unchanged, including the MIME-based "Open in browser" vs "Download" label.
- When absent (new reference-chip call site): the Preview button is not rendered, and the remaining button is unconditionally labelled via `CitationsI18nKeys.PopupOpenInBrowser` — a reference-only group is by definition an external open, never a local download, so the MIME-sniffing branch is skipped rather than mislabeling.

**Alternative considered**: pass a stub `onPreview` that just calls `openAnnotationAttachment` again (so both buttons behave identically). Rejected — a UI showing two buttons that do the same thing is confusing; hiding the redundant one is clearer and matches the reported expectation of a single "Reference…"-style action.

### 4. `CitationMarker` gets an optional leading icon

Add `icon?: ReactNode`, rendered before the label inside the existing `NeutralButton`, defaulting to `undefined` so existing inline-citation markers are visually unchanged. The reference-chip row passes `icon={<IconLink size={14} aria-hidden />}` to satisfy "link icon next to attachment name."

### 5. Placement: `afterContent` slot in `ConversationMessageItem`, sharing the existing `CitationCardProvider`

`ConversationMessageItem.tsx` already creates one `useCitationCard()` instance per message and wraps its render in `<CitationCardProvider value={citationCard}>` for inline citations. The reference-chip row is rendered as a sibling block prepended to the existing `afterContent` (which currently holds stages/error content), reusing the same provider instance — `sourceUrl` keys for reference groups (`reference_url`s, typically `https://...`) and inline-citation groups (DIAL file URLs, typically `files/...` or other `https://` URLs) live in the same map with no collision expected in practice, since both are the actual API-provided values.

Reference-only dtos are filtered out of the array passed to `attachmentDtosToDisplayAttachments` at the assistant-message render call site in the same component, so the tray only ever shows genuinely downloadable/previewable attachments.

### 6. Reference-only PDF-page attachments open in the canvas at the referenced page, everywhere they're clickable

A second observed payload shape (the old DIAL RAG app's PDF chunks, surfaced both at the top level and inside `custom_content.stages[].attachments`) sets `reference_url` to a DIAL file id with an optional `#page=N` fragment, e.g. `files/{bucket}/uploads/report.pdf#page=81`, and `data`/`type` describe the (often garbled OCR) chunk text, not the referenced file. Per the confirmed direction, `title` and `reference_url` drive the open action; `data`/`type` are ignored for it (they still drive the quote text shown in the popup body, which is unrelated).

- `apps/chat/src/utils/reference-attachment.ts` exports `parsePdfPageReference(url): { baseUrl, page: number | null } | null`, matching a trailing `.pdf` (optionally followed by `#page=N`).
- `apps/chat/src/utils/attachment-canvas.ts` exports `referenceAttachmentToPdfCanvasContent(attachment: AttachmentResource): PdfCanvasContent | null`, which resolves the DIAL download URL for `baseUrl` and, when a page is present, attaches a single invisible (`opacity: 0`, zero-size bbox) highlight scoped to that page as `selectedHighlightId`. The highlight `id` is `` `reference-page-${page}` `` — **unique per page**, not a constant string — because `PdfContent`'s underlying viewer only re-scrolls when `selectedHighlightId` actually changes; reusing one id across different pages of the same already-open PDF would update the thumbnail sidebar (driven by local React state) but silently fail to scroll the document itself.
- Three click paths converge on this, so the fix is not duplicated: `ConversationMessageItem`'s reference-chip row passes `onPreview` (opens canvas) precisely when a group's attachment is PDF-page-detectable, alongside `onOpenInBrowser` (still downloads the raw file, unaffected); `useOpenAttachmentCanvas`'s `openFileCanvas` tries `referenceAttachmentToPdfCanvasContent` before its normal MIME/extension switch, fixing the generic attachment-card click path used by stage attachments (`CollapsedGroup`) and any other `DisplayAttachment` consumer; `useAttachmentAction`'s default `handleAttachmentClick` (used when no `onAttachmentClick` override is supplied) gets the same routing plus a `openAnnotationAttachment` fallback for non-PDF reference-only attachments, since it previously no-oped whenever `url` was absent.
- The shared `messageAttachmentToDisplayAttachment` mapper (`libs/chat-shared`) infers `contentType` for reference-only attachments (`dto.reference_type` first, else the `reference_url` extension via a small `FileExtension`→`MIMEType` table, else `dto.type`) so the PDF-page case is typed `application/pdf` everywhere a `DisplayAttachment` is rendered — fixing both the file-type icon/label (previously showed the chunk's own `text/markdown` type) and ensuring `useOpenAttachmentCanvas`'s ordinary MIME routing would also land on the PDF branch even without the dedicated pre-check above.
- `resolveDialUrl` (`dial-file.ts`) and `openAnnotationAttachment` (`annotation.ts`) both strip a trailing `#...` fragment before DIAL-file-id detection/resolution, since a `#page=N` fragment is not part of the file path and would otherwise corrupt the resolved download URL.

**Alternative considered**: extend `PdfCanvasContent`/`PdfContent` (in `libs/attachment-canvas`) with a dedicated `initialPage` field instead of a synthetic invisible highlight. Rejected — the existing `selectedHighlightId`/highlights mechanism already does exactly what's needed (scroll-to-page) without a lib API change, keeping this fix entirely inside `apps/chat`.

## Risks / Trade-offs

- **[Risk]** A future API response could send an attachment with both `url` and `reference_url` set, meaning it would follow the existing file-download path and never enter the new reference-chip flow. → Acceptable: `url` presence already means "downloadable DIAL file," which takes priority; `reference_url` becomes a citation-style secondary action, but the primary tray tile still exists and works. This is out of scope for this change since none of the reported payloads exhibit it.
- **[Risk]** Making `onPreview` optional on `CitationCard`/`CitationDropdown` is a public prop-signature change on a shared component. → Mitigation: purely additive (`?`), all existing call sites keep passing it, so no call site needs updating; `citation-card` spec is updated with a MODIFIED requirement documenting the new optional behavior.
- **[Risk]** `reference_url` values observed in the sample payload are opaque Google-grounding redirect links, not literal document URLs — "Open in browser" may land on an interstitial redirect rather than the exact source page. → Accepted per the confirmed direction (open `reference_url` as-is); this matches what the URL actually is, and is still a strict improvement over the current no-op.
- **[Risk]** The PDF-page detection (`parsePdfPageReference`) matches purely on the `.pdf` suffix of the URL path; a non-DIAL external URL that happens to end in `.pdf#page=N` would also be routed to the canvas rather than opened in a new tab. → Accepted: an external PDF opening in the in-app canvas (with no page-scroll effect, since `isDialFileId` gates the download-URL resolution and a non-DIAL `.pdf` URL is passed straight through as the canvas `url`) is a reasonable, arguably better, outcome than a raw `window.open`.
- **[Risk]** `messageAttachmentToDisplayAttachment` (a `libs/chat-shared` pure mapper) now infers `contentType` from `reference_url`'s file extension for reference-only attachments — a small increase in what the "pure" mapper interprets from the DTO. → Acceptable: it is pure string/extension parsing (no host/network/environment knowledge), mirrors the file's own existing `getAttachmentType`/`getInlineDataUrl` MIME-sniffing helpers, and only activates when `url` is absent (never touches downloadable attachments).

## Migration Plan

No data migration. This is a frontend-only rendering/behavior change gated by data shape (`url` absent + `reference_url` present), so it activates automatically for any existing or future message that already carries such attachments — no flag needed, no backward-incompatible change to persisted conversation data.
