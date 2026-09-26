## MODIFIED Requirements

### Requirement: Source link clicks are routed by URL and content type

`ConversationSourcesPanel` SHALL wire `handleSourceClick` as `onSourceClick` on `SourcesSection`. `handleSourceClick` SHALL route each click as follows:

1. **External non-previewable URL** — if the URL is not a DIAL file ID and does not pass the previewability test (see below), open `window.open(url, '_blank', 'noopener,noreferrer')` immediately and return.
2. **PDF page reference** — if `parsePdfPageReference(url)` (from `@epam/ai-dial-quotations`) returns a non-`null` `page`, build a `DisplayAttachment` with `referenceUrl` set to the full source URL (including the `#page=N` fragment), `url` left undefined, and `contentType` `MIMEType.PDF`, then call `openAttachmentCanvas(attachment)`. `useOpenAttachmentCanvas` routes such an attachment through `resolveReferencePdfContent` (→ `referenceAttachmentToPdfCanvasContent`), so the PDF canvas receives `page` and a `selectedHighlightId` for that page, exactly as an inline reference-link preview does. If the canvas opens (`true`), close the sources sidebar. If it does not open (`false`): for a DIAL file ID, trigger a download of the fragment-free base file (`parsed.baseUrl`); otherwise open `window.open(url, '_blank', 'noopener,noreferrer')` with the original, fragment-bearing URL.
3. **External previewable document or DIAL file** — otherwise, resolve the source's effective content type via `resolveExternalSourceContentType(contentType, url)` (see below), build a `DisplayAttachment` from the `QuotationSource` using that resolved content type, and call `openAttachmentCanvas(attachment)`. If the canvas opens (`true`), close the sources sidebar. If the canvas does not open (`false`) and the URL is not a DIAL file ID, open `window.open(url, '_blank', 'noopener,noreferrer')`. If the canvas does not open and the URL is a DIAL file ID, trigger a download.

The page-reference branch lives only in the app container. `libs/source-panel` stays unaware of page semantics and passes the `QuotationSource` through unchanged.

**Content type resolution** — `resolveExternalSourceContentType(contentType, url)` exported from `libs/chat-hooks/src/files/attachment-canvas.ts`:

- Returns `contentType` unchanged if it already trustworthily identifies the source: it starts with `'image/'`, starts with `'audio/'`, equals `MIMEType.PDF` (`'application/pdf'`), or `isOoxmlPreviewable('', contentType)` (from `@epam/ai-dial-attachment-canvas`) recognizes it as a canonical DOCX/XLSX/PPTX/CSV MIME type.
- Otherwise, extracts the last path segment of `url` (ignoring query string and fragment): if its extension after the last `.` is `'pdf'` (`FileExtension.PDF`), returns `MIMEType.PDF`; otherwise, if `getOoxmlMimeType(fileName)` (from `@epam/ai-dial-attachment-canvas`) recognizes a `.docx`/`.xlsx`/`.pptx`/`.csv` extension, returns that format's canonical MIME type. Either case **overrides** the reported `contentType`.
- Otherwise returns `contentType` unchanged.

This override exists because some web-search grounding APIs (e.g. Google Vertex AI) label every web reference — YouTube, news articles, blog posts, PDFs, Office documents, and CSV files alike — with `content-type: text/markdown` regardless of actual content. Without it, the reported `contentType` would win over a recognized document extension when building the `DisplayAttachment`, routing the canvas into the markdown/text viewer instead of the PDF or `@silurus/ooxml` renderer. The `DisplayAttachment` built in step 3 above uses this resolved content type (not the raw `QuotationSource.contentType`) for both its `contentType` and `type` (`AttachmentType.Image` vs `AttachmentType.File`) fields.

**Previewability test** — `isExternalSourcePreviewable(contentType, url)` exported from `libs/chat-hooks/src/files/attachment-canvas.ts`, built on `resolveExternalSourceContentType`:

- Resolves the effective content type via `resolveExternalSourceContentType(contentType, url)`. Returns `true` if the resolved type starts with `'image/'`, starts with `'audio/'`, equals `MIMEType.PDF`, or `isOoxmlPreviewable('', resolvedType)` recognizes it as a canonical DOCX/XLSX/PPTX/CSV MIME type.
- Otherwise, extracts the last path segment of `url` and returns `true` when `isTextPreviewable(fileName)` or `isHtmlPreviewable(fileName)` from `@epam/ai-dial-attachment-canvas` returns `true` — covers `.md`, `.markdown`, `.json`, `.txt`, `.xml`, `.html`/`.htm`, and all other plain-text formats the canvas text renderer supports.
- Returns `false` on invalid URLs or a last path segment with no file extension.

Image and audio content types, and an already-correct PDF or OOXML content type, are trusted directly because web-search grounding APIs do not mislabel images/audio (or, for PDF/OOXML, because a citation annotation's own `attachment.type` field — the same authoritative marker `annotationToPdfCanvasContent` trusts — is reliable even when the source's URL carries no matching extension, e.g. an opaque citation/reference id rather than a file name).

#### Scenario: Web-search reference URL without a file extension opens in a new tab

- **GIVEN** a `QuotationSource` with `contentType = 'text/markdown'` and a redirect URL containing no file extension (e.g. `https://vertexaisearch.cloud.google.com/grounding-api-redirect/...`)
- **WHEN** the user clicks the source link
- **THEN** `window.open` is called with the URL, `'_blank'`, and `'noopener,noreferrer'`
- **AND** the canvas is not opened

#### Scenario: External PDF URL opens in the canvas

- **GIVEN** a `QuotationSource` with a URL whose last path segment ends in `.pdf`
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` built from the source
- **AND** if the canvas opens, the sources sidebar is closed

#### Scenario: DIAL PDF source with a page fragment opens at that page

- **GIVEN** a `QuotationSource` with `url = 'files/bucket/report.pdf#page=81'`
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `referenceUrl` is `'files/bucket/report.pdf#page=81'`, whose `url` is undefined, and whose `contentType` is `MIMEType.PDF`
- **AND** the canvas opens the PDF at page 81
- **AND** the sources sidebar is closed

#### Scenario: External PDF source with a page fragment opens at that page

- **GIVEN** a `QuotationSource` with `url = 'https://example.com/docs/outlook.pdf#page=12'`
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `referenceUrl` is the full URL and whose `url` is undefined

#### Scenario: PDF page reference that fails to open falls back without losing the page

- **GIVEN** a `QuotationSource` with a PDF page-reference URL and `openAttachmentCanvas` returning `false`
- **WHEN** the user clicks the source link
- **THEN** for a DIAL file ID the download handler is invoked with an attachment whose `url` is the fragment-free base file ID
- **AND** for an external URL `window.open` is called with the original URL including `#page=N`, `'_blank'`, and `'noopener,noreferrer'`

#### Scenario: PDF URL without a page fragment keeps the existing route

- **GIVEN** a `QuotationSource` with `url = 'files/bucket/report.pdf'` (no `#page=N`)
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `url` is `'files/bucket/report.pdf'` and which has no `referenceUrl`

#### Scenario: Mislabelled content type is overridden by a .pdf URL extension

- **GIVEN** a `QuotationSource` with `contentType = 'text/markdown'` (mislabelled by a web-search grounding API) and a URL whose last path segment ends in `.pdf`
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `contentType` is `MIMEType.PDF`, not the source's original `'text/markdown'`
- **AND** the PDF opens in the PDF canvas viewer, not the markdown/text viewer

#### Scenario: PDF content type without a .pdf URL extension still opens in the canvas

- **GIVEN** a `QuotationSource` with `contentType = MIMEType.PDF` and a URL with no recognisable file extension (e.g. an opaque citation/reference id)
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `contentType` is `MIMEType.PDF`

#### Scenario: External text-previewable URL opens in the canvas

- **GIVEN** a `QuotationSource` with a URL whose last path segment has an extension recognised by `isTextPreviewable` (e.g. `.md`, `.markdown`, `.json`, `.txt`, `.csv`, `.xml`)
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called
- **AND** if the canvas opens, the sources sidebar is closed

#### Scenario: Image source opens in the canvas regardless of URL extension

- **GIVEN** a `QuotationSource` with `contentType = 'image/png'` (or any `image/*` value)
- **WHEN** the user clicks the source link
- **THEN** `openAttachmentCanvas` is called

#### Scenario: Canvas failure on external previewable URL falls back to new tab

- **GIVEN** a `QuotationSource` with a previewable URL extension (e.g. `.pdf`) but where `openAttachmentCanvas` returns `false`
- **WHEN** the user clicks the source link
- **THEN** `window.open` is called with the source URL, `'_blank'`, and `'noopener,noreferrer'`

#### Scenario: Canvas failure on DIAL file falls back to download

- **GIVEN** a `QuotationSource` whose URL is a DIAL file ID and where `openAttachmentCanvas` returns `false`
- **WHEN** the user clicks the source link
- **THEN** the attachment download handler is invoked (not `window.open`)

### Requirement: `useConversationSources` derives Uploaded, Generated, and Sources lists from messages

`libs/chat-hooks/src/conversation-sources/useConversationSources/useConversationSources.ts` SHALL export `useConversationSources(messages: Message[], resolvers?: AttachmentDisplayResolvers)` returning `{ uploaded: DisplayAttachment[]; generated: DisplayAttachment[]; sources: QuotationSource[] }`. The hook SHALL:

- Walk `messages` once in a single loop.
- For user messages: push all attachments into `uploaded` via `messageAttachmentToDisplayAttachment`, deduplicated by attachment id.
- For assistant messages:
  - Split `msg.custom_content?.attachments` into **reference-only** dtos (`isReferenceOnlyAttachment` from `@epam/ai-dial-quotations` returns `true`) and **regular** dtos (all others).
  - Push only the regular dtos into `generated` via `messageAttachmentToDisplayAttachment`, deduplicated by attachment id.
  - For each reference-only dto, if `dto.reference_url` has not been seen before, append a `QuotationSource` to `sources`:
    - `url` — `dto.reference_url` (unchanged, including any `#page=N` fragment it already carries)
    - `title` — `dto.title ?? dto.reference_url`
    - `contentType` — `dto.reference_type ?? dto.type ?? ''`
    - `quote` — `dto.data` (optional)
  - Also walk `resolveMessageAnnotations(msg)`. For each annotation where `annotation?.body?.source?.attachment?.url` is present, compute its **source URL**:
    - when `getAnnotationPdfPage(annotation)` (from `@epam/ai-dial-quotations`) returns a page `N` **and** `parsePdfPageReference(attachment.url)` returns a reference with `page === null` (a `.pdf` URL with no fragment yet), the source URL is `` `${attachment.url}#page=${N}` ``;
    - otherwise the source URL is `attachment.url` unchanged.

    If that source URL has not been seen before, append a `QuotationSource` to `sources`:
    - `url` — the source URL
    - `title` — `attachment.title ?? <last path segment of attachment.url> ?? attachment.url`
    - `contentType` — `attachment.type ?? ''`
    - `quote` — `annotation.body.quote` (optional)
- Deduplicate `sources` by the (page-qualified) source URL across both reference-only attachments and annotations (first occurrence wins), using a shared `seenUrls` set. Citations of the same PDF on different pages therefore yield one row per page; citations on the same page collapse into one row.
- Tolerate `null`/`undefined` annotation items without throwing.
- Return the three lists wrapped in `useMemo`, keyed on the `messages` and `resolvers` references.

`QuotationSource` is defined in `libs/source-panel/src/models/quotation-source.ts` as:
```ts
interface QuotationSource {
  url: string;
  title: string;
  contentType: string;
  quote?: string;
}
```

Its shape is unchanged. For PDF sources, `url` MAY carry a `#page=N` fragment identifying the cited page.

#### Scenario: No messages

- **WHEN** the hook is called with `[]`
- **THEN** it returns `{ uploaded: [], generated: [], sources: [] }`

#### Scenario: Only user attachments

- **WHEN** every message in the input has `role: MessageRole.User` and one attachment each
- **THEN** all derived attachments appear in `uploaded` in message order
- **AND** `generated` and `sources` are empty

#### Scenario: Only assistant attachments without reference_url

- **WHEN** every message in the input has `role: MessageRole.Assistant` and one regular (url-bearing) attachment each
- **THEN** all derived attachments appear in `generated` in message order
- **AND** `uploaded` and `sources` are empty

#### Scenario: Reference-only attachment goes to sources, not generated

- **WHEN** an assistant message has one attachment with `reference_url` set and no `url`
- **THEN** `generated` receives no entry from that attachment
- **AND** `sources` contains one `QuotationSource` with `url = dto.reference_url`, `title = dto.title`, `contentType = dto.reference_type ?? dto.type ?? ''`, and `quote = dto.data`

#### Scenario: Mixed roles

- **WHEN** a user message with one attachment is followed by an assistant message with two regular attachments
- **THEN** `uploaded` has one entry from the user message and `generated` has two entries from the assistant message

#### Scenario: Message without custom_content

- **WHEN** a message has `custom_content === undefined` or `custom_content.attachments === undefined`
- **THEN** the hook contributes no entries from that message but still processes the rest

#### Scenario: Annotations with source URLs produce sources entries

- **WHEN** an assistant message has `custom_content.annotations` containing two annotations each with `body.source.attachment.url`
- **THEN** both appear in `sources` in annotation order

#### Scenario: PDF annotation with a page selector is page-qualified

- **WHEN** an annotation has `body.source.attachment.url = 'files/bucket/doc.pdf'` and a `pdf_bbox` selector on page 12
- **THEN** `sources` contains a `QuotationSource` with `url = 'files/bucket/doc.pdf#page=12'`

#### Scenario: Same PDF cited on different pages yields one row per page

- **WHEN** two annotations cite `files/bucket/doc.pdf`, one on page 3 and one on page 7
- **THEN** `sources` contains two entries, `…/doc.pdf#page=3` and `…/doc.pdf#page=7`, in annotation order

#### Scenario: Same PDF cited twice on the same page yields one row

- **WHEN** two annotations cite `files/bucket/doc.pdf` on page 3
- **THEN** `sources` contains exactly one entry, `…/doc.pdf#page=3`

#### Scenario: Annotation without a page or on a non-PDF URL is not qualified

- **WHEN** an annotation has no PDF selector, or its attachment URL does not end in `.pdf`, or its URL already carries a fragment
- **THEN** its `QuotationSource.url` equals `body.source.attachment.url` unchanged

#### Scenario: Duplicate source URLs are deduplicated across reference attachments and annotations

- **WHEN** a reference-only attachment and a subsequent annotation resolve to the same source URL (e.g. `reference_url = 'files/bucket/doc.pdf#page=3'` and an annotation on `files/bucket/doc.pdf` with a page-3 selector)
- **THEN** `sources` contains only the first occurrence (the reference attachment)

#### Scenario: Annotations without a source URL are skipped

- **WHEN** an annotation has no `body.source.attachment.url`
- **THEN** it contributes no entry to `sources`

#### Scenario: Memoisation stable on identical messages reference

- **WHEN** the hook is rendered twice with the same `messages` reference
- **THEN** it returns the same `{ uploaded, generated, sources }` object reference both times
