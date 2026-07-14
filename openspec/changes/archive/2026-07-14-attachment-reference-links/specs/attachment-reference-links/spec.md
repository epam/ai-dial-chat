## ADDED Requirements

### Requirement: Reference-only attachments are identified and grouped by source

`apps/chat/src/utils/reference-attachment.ts` SHALL export:

```ts
isReferenceOnlyAttachment(dto: MessageAttachment): boolean
getReferenceAttachmentGroups(dtos: MessageAttachment[] | undefined): AnnotationGroup[]
```

`isReferenceOnlyAttachment` SHALL return `true` when `dto.url == null && dto.reference_url != null`, and `false` otherwise.

`getReferenceAttachmentGroups` SHALL:
- Filter `dtos` to those satisfying `isReferenceOnlyAttachment`.
- Map each matching dto to a synthetic `Annotation`:
  ```ts
  {
    body: {
      title: dto.title,
      quote: dto.data,
      source: {
        type: 'attachment',
        attachment: { type: dto.reference_type ?? dto.type ?? '', url: dto.reference_url, title: dto.title },
      },
    },
  }
  ```
- Pass the resulting `Annotation[]` through the existing `groupAnnotationsBySource` (`apps/chat/src/utils/group-annotations-by-source.ts`) and return its result unchanged.
- Return `[]` when `dtos` is `undefined` or contains no reference-only entries.

**i18n**: none — pure data transformation.
**RTL**: none.
**Memoisation**: callers SHALL wrap the result in `useMemo` keyed on the source `dtos` array.

#### Scenario: Attachment with both url and reference_url is not reference-only

- **WHEN** `isReferenceOnlyAttachment` is called with a dto that has both `url` and `reference_url` set
- **THEN** it returns `false`

#### Scenario: Attachment with only reference_url is reference-only

- **WHEN** `isReferenceOnlyAttachment` is called with a dto that has `reference_url` set and no `url`
- **THEN** it returns `true`

#### Scenario: Repeated chunks from the same reference_url collapse into one group

- **WHEN** `getReferenceAttachmentGroups` is called with three reference-only dtos, two of which share the same `reference_url`
- **THEN** the result contains two `AnnotationGroup`s, one of which has two annotations

#### Scenario: No reference-only attachments yields an empty array

- **WHEN** `getReferenceAttachmentGroups` is called with `undefined`, or with dtos that all have a `url`
- **THEN** it returns `[]`

---

### Requirement: Shared "open source" action used by both inline citations and reference chips

`apps/chat/src/utils/annotation.ts` SHALL export `openAnnotationAttachment(attachment: AttachmentResource): void` that:
- When `attachment.url` is a DIAL file id (`isDialFileId`): resolves the download URL via `resolveDialFileDownloadUrl`, then triggers a browser download using a programmatically created `<a download>` element, with `download` set to `attachment.title` when present, otherwise the last path segment of the URL.
- Otherwise: calls `window.open(attachment.url, '_blank', 'noopener,noreferrer')`.
- No-ops when `attachment.url` is missing or the resolved download URL is `undefined`.

`useCitationMarkdownComponents`'s `onOpenInBrowser` callback SHALL delegate to this function instead of inlining the branch.

**i18n**: none.
**RTL**: none — behavioral utility only.

#### Scenario: DIAL file id triggers anchor-download

- **WHEN** `openAnnotationAttachment` is called with an attachment whose `url` is a DIAL file id
- **THEN** a resolved download URL is fetched and a hidden `<a download>` click is dispatched; `window.open` is NOT called

#### Scenario: External URL calls window.open

- **WHEN** `openAnnotationAttachment` is called with an attachment whose `url` is an `https://` URL that is not a DIAL file id
- **THEN** `window.open` is called with the URL, `"_blank"`, and `"noopener,noreferrer"`

---

### Requirement: Reference-only attachments render as a citation-style chip row on the assistant message

`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` SHALL, for assistant messages:
- Compute `referenceGroups = getReferenceAttachmentGroups(msg.custom_content?.attachments)`, memoised on the attachments array.
- Exclude reference-only dtos (per `isReferenceOnlyAttachment`) from the array passed to `attachmentDtosToDisplayAttachments` before it reaches the `AttachmentTray`.
- When `referenceGroups.length > 0`, render one `CitationDropdown` per group in a wrapping flex row, prepended to the existing `afterContent` slot (ahead of stage/error content), passing:
  - `group` — the `AnnotationGroup`.
  - `onOpenInBrowser` — a handler that extracts `annotation.body.source.attachment` and calls `openAnnotationAttachment`.
  - no `onPreview` (Preview is not applicable to these chunks — see `citation-card` capability).
- Reuse the same `useCitationCard()` instance and `CitationCardProvider` already established for inline citations in this component — no second provider is created.

**i18n**: none new — reuses existing `CitationsI18nKeys`.
**RTL**: the chip row uses a logical flex-wrap layout (`flex flex-wrap gap-2`); no directional-only styling.
**Accessibility**: each chip inherits `CitationMarker`'s existing `aria-label` (`citations.marker.ariaLabel`) and the popup's existing `role="dialog"`/`aria-modal`.
**Feature flag**: none.

#### Scenario: Reference-only attachment no longer appears in the plain tray

- **WHEN** an assistant message's `custom_content.attachments` contains one entry with `reference_url` and no `url`
- **THEN** no `AttachmentCard` for that entry is rendered inside the `AttachmentTray`

#### Scenario: Reference chip opens the citation popup

- **WHEN** the user clicks the rendered chip for a reference group
- **THEN** the `CitationCard` popup opens showing the group's title/quote and a single "Open in browser" button (no "Preview" button)

#### Scenario: Message with only file attachments renders no reference row

- **WHEN** an assistant message's `custom_content.attachments` are all `url`-bearing (no `reference_url`-only entries)
- **THEN** `referenceGroups` is empty and no chip row is rendered

---

### Requirement: Reference-only PDF-page attachments open in the canvas at the referenced page

`apps/chat/src/utils/reference-attachment.ts` SHALL export `parsePdfPageReference(url: string): { baseUrl: string; page: number | null } | null` that matches a URL ending in `.pdf`, optionally followed by a `#page=N` fragment, returning `null` for any other URL shape.

`apps/chat/src/utils/attachment-canvas.ts` SHALL export `referenceAttachmentToPdfCanvasContent(attachment: AttachmentResource): PdfCanvasContent | null` that:
- Returns `null` when `parsePdfPageReference(attachment.url)` returns `null`.
- Resolves `baseUrl` to a DIAL download URL when it is a DIAL file id, otherwise uses it as-is; returns `null` if resolution fails.
- When no page fragment is present, returns `{ type: Pdf, url }` with no highlights.
- When a page is present, returns `{ type: Pdf, url, highlights: [...], selectedHighlightId }` with a single invisible (`opacity: 0`, zero-size bbox) highlight scoped to that page, whose `id`/`selectedHighlightId` is `` `reference-page-${page}` `` — unique per page number, so switching between two chips of the same PDF at different pages while the canvas is already open produces a different `selectedHighlightId` and re-triggers the scroll.

`getReferenceAttachmentGroups` SHALL set the synthetic annotation's `source.attachment.type` to `application/pdf` (instead of `dto.reference_type ?? dto.type ?? ''`) when `parsePdfPageReference(dto.reference_url)` is non-null.

In `ConversationMessageItem.tsx`, each reference-chip `CitationDropdown` SHALL be given an `onPreview` handler (opening the canvas via `referenceAttachmentToPdfCanvasContent` + `openCanvas`) when its group's `primaryAnnotation` attachment is PDF-page-detectable, and no `onPreview` otherwise (existing behavior). `onOpenInBrowser` SHALL continue to be passed unconditionally and SHALL continue to download the raw file, regardless of `onPreview`.

This routing SHALL also apply outside the reference-chip row, so any `DisplayAttachment` click path resolves the same way:
- `useOpenAttachmentCanvas`'s `openFileCanvas` SHALL try `referenceAttachmentToPdfCanvasContent` first, whenever `attachment.url == null && attachment.referenceUrl != null`, before its normal MIME-type/extension routing.
- `useAttachmentAction`'s `handleAttachmentClick` (used by any attachment card with no explicit `onAttachmentClick` override, including stage attachments rendered inside `CollapsedGroup`) SHALL route reference-only attachments the same way: PDF-page canvas preview when detectable, otherwise `openAnnotationAttachment` (DIAL-file download or `window.open`).

**i18n**: none new.
**RTL**: none — canvas panel layout is unaffected.

#### Scenario: PDF reference with a page anchor opens the canvas scrolled to that page

- **WHEN** a reference-only attachment's `reference_url` is `files/{bucket}/report.pdf#page=81` and the user activates it (chip Preview, stage attachment click, or plain attachment-tray click)
- **THEN** the canvas opens with `PdfCanvasContent` whose `url` is the resolved download URL for `files/{bucket}/report.pdf`, and a highlight scoped to page 81 is passed as `selectedHighlightId`

#### Scenario: PDF reference with no page anchor opens the canvas at the default page

- **WHEN** a reference-only attachment's `reference_url` is `files/{bucket}/report.pdf` (no `#page=`)
- **THEN** the canvas opens with `PdfCanvasContent` for that file and no highlights/`selectedHighlightId`

#### Scenario: Switching between two pages of the same open PDF re-scrolls

- **WHEN** the canvas is already open showing page 5 of a PDF and the user activates a reference chip for page 19 of the same PDF
- **THEN** the new `PdfCanvasContent`'s `selectedHighlightId` differs from the previous one, so the underlying viewer scrolls to page 19

#### Scenario: Non-PDF reference-only attachment is unaffected

- **WHEN** a reference-only attachment's `reference_url` does not end in `.pdf`
- **THEN** `referenceAttachmentToPdfCanvasContent` returns `null` and the existing "Open in browser"/MIME-routing behavior is used instead
