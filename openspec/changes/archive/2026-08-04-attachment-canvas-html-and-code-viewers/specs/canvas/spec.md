## MODIFIED Requirements

### Requirement: Content type routing table

The content-type routing table in `openFileCanvas` SHALL be extended as follows (new rows in bold):

| MIME type / Extension(s) | Resolver | Content type returned |
|---|---|---|
| Reference-only, PDF-page-detectable `referenceUrl` | `referenceAttachmentToPdfCanvasContent` | `PdfCanvasContent` |
| No `contentType` (empty string) **and** `attachment.data != null` | `resolveTextCanvasContent` | `PlainTextCanvasContent` |
| `text/markdown` MIME | `resolveMarkdownCanvasContent` | `MarkdownCanvasContent` |
| `application/json` MIME | `resolveJsonCanvasContent` | `JsonCanvasContent` or `PlainTextCanvasContent` |
| `application/pdf` MIME | `resolvePdfCanvasContent` | `PdfCanvasContent` |
| `md`, `markdown` extension | `resolveMarkdownCanvasContent` | `MarkdownCanvasContent` |
| `json` extension | `resolveJsonCanvasContent` | `JsonCanvasContent` or `PlainTextCanvasContent` (parse failure) |
| `pdf` extension | `resolvePdfCanvasContent` | `PdfCanvasContent` |
| `image/*` MIME | `resolveImageCanvasContent` | `ImageCanvasContent` |
| **`html`, `htm` extension** | **`resolveHtmlCanvasContent`** | **`HtmlCanvasContent`** |
| Other text-previewable (see `TEXT_EXTENSIONS`, excluding `html`/`htm`) | `resolveCodeCanvasContent` | `CodeCanvasContent` |
| Everything else | `createUnsupportedCanvasContent` | `UnsupportedCanvasContent` |

The `html`/`htm` branch runs before the generic `isTextPreviewable` branch. The `isTextPreviewable` branch now routes to `resolveCodeCanvasContent` (returning `CodeCanvasContent`) instead of `resolveTextCanvasContent`.

#### Scenario: html extension routes to Html

- **WHEN** `openFileCanvas` is called with an attachment whose name ends in `.html`
- **THEN** `resolveHtmlCanvasContent` is called
- **AND** the canvas opens with `HtmlCanvasContent`

#### Scenario: ts extension routes to Code

- **WHEN** `openFileCanvas` is called with an attachment whose name ends in `.ts`
- **THEN** `resolveCodeCanvasContent` is called with `language: 'typescript'`
- **AND** the canvas opens with `CodeCanvasContent`

---

### Requirement: Content renderer table

The canvas renderer table SHALL be extended with two new rows:

| `AttachmentContentType` | Payload fields | Renderer |
|---|---|---|
| `Image` | `url: string` | `<img>` centered, `max-h-full max-w-full object-contain` |
| `Audio` | `url: string; mimeType?: string` | Native `<audio controls>` |
| `PlainText` | `text: string` | `<pre>` with `whitespace-pre-wrap break-words` |
| `Markdown` | `text: string` | `MarkdownRenderer` |
| `Json` | `value: unknown` | `react-json-view-lite` `JsonView` inside `dir="ltr"` |
| `Pdf` | `url: string; highlights?; selectedHighlightId?` | `PdfContent` |
| **`Code`** | **`text: string; language?: string`** | **`CodeContent` (`react-syntax-highlighter` PrismLight inside `dir="ltr"`)** |
| **`Html`** | **`srcdoc?: string; url?: string`** | **`HtmlContent` (sandboxed `<iframe>`)** |
| `Unsupported` | — | Centered "Preview not supported" message |
| `Error` | `errorType; url?` | Centered error message |

#### Scenario: Code content type uses CodeContent renderer

- **WHEN** `AttachmentCanvas` renders a `CodeCanvasContent`
- **THEN** a `CodeContent` component is mounted in the panel body

#### Scenario: Html content type uses HtmlContent renderer

- **WHEN** `AttachmentCanvas` renders an `HtmlCanvasContent`
- **THEN** an `HtmlContent` component is mounted in the panel body

---

### Requirement: i18n table extension

The `AttachmentCanvasI18nKeys` enum and `en.json` SHALL be extended with:

| Enum member | en.json key | en.json value |
|---|---|---|
| `HtmlFrameBlocked` | `attachmentCanvas.htmlFrameBlocked` | `"This page cannot be displayed in preview"` |
| `HtmlOpenInNewTab` | `attachmentCanvas.htmlOpenInNewTab` | `"Open in new tab"` |
| `HtmlViewSource` | `attachmentCanvas.htmlViewSource` | `"View source"` |
| `HtmlViewRendered` | `attachmentCanvas.htmlViewRendered` | `"View rendered"` |

#### Scenario: new i18n keys exist

- **WHEN** `t(AttachmentCanvasI18nKeys.HtmlFrameBlocked)` is called
- **THEN** it returns `"This page cannot be displayed in preview"` in the English locale
