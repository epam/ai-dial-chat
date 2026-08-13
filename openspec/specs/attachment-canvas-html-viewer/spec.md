# attachment-canvas-html-viewer Specification

## Purpose

The HTML-viewing variant of the attachment canvas: the `Html` content type, previewability detection, renderer, and routing.

## Capability: attachment-canvas-html-viewer

### Overview

Adds an HTML viewer to `AttachmentCanvas` as a new `Html` content type. HTML file attachments (`.html`, `.htm`) are rendered inside a sandboxed `<iframe>` using `srcdoc`. External HTML URLs are rendered via `src`. When a URL-sourced iframe is blocked by the target page's CSP or `X-Frame-Options`, the viewer shows a friendly error panel with an "Open in new tab" fallback.

---

## ADDED Requirements

### Requirement: `HTML_EXTENSIONS` constant and `isHtmlPreviewable` utility

`libs/attachment-canvas/src/constants/file.ts` SHALL remove `'html'` and `'htm'` from `TEXT_EXTENSIONS` and add a new exported constant:

```ts
export const HTML_EXTENSIONS = new Set(['html', 'htm']);
```

`libs/attachment-canvas/src/utils/content.ts` SHALL export `isHtmlPreviewable(name: string): boolean` that returns `true` when the file name's extension (lowercased, without dot) is in `HTML_EXTENSIONS`.

**Rationale:** HTML files need a rendered preview, not a plain-text or syntax-highlighted view. Keeping them in `TEXT_EXTENSIONS` would route them to `CodeContent` instead.

#### Scenario: html extension is previewable

- **WHEN** `isHtmlPreviewable('page.html')` is called
- **THEN** it returns `true`

#### Scenario: htm extension is previewable

- **WHEN** `isHtmlPreviewable('page.htm')` is called
- **THEN** it returns `true`

#### Scenario: non-html extension is not previewable

- **WHEN** `isHtmlPreviewable('style.css')` is called
- **THEN** it returns `false`

#### Scenario: html and htm are no longer in TEXT_EXTENSIONS

- **WHEN** `isTextPreviewable('index.html')` is called
- **THEN** it returns `false`

---

### Requirement: `AttachmentContentType.Html` enum member

`libs/attachment-canvas/src/types/attachment-canvas.ts` SHALL add `Html = 'html'` to the `AttachmentContentType` enum.

**Feature flag:** none.

#### Scenario: enum member exists

- **WHEN** a consumer imports `AttachmentContentType` from `@epam/ai-dial-attachment-canvas`
- **THEN** `AttachmentContentType.Html` equals the string `'html'`

---

### Requirement: `HtmlCanvasContent` model interface

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL export:

```ts
interface HtmlCanvasContent {
  type: AttachmentContentType.Html;
  srcdoc?: string;
  url?: string;
}
```

- `srcdoc` — the full HTML text to render inline via the iframe `srcdoc` attribute. Used for file attachments.
- `url` — an external URL to render via the iframe `src` attribute. Used for external link sources.
- Exactly one of the two fields is expected to be set. When both are set, `srcdoc` takes precedence. When neither is set, the renderer treats it as an unsupported state and shows the blocked/error panel.

`HtmlCanvasContent` SHALL be added to the `AttachmentCanvasContent` discriminated union.

`isDownloadable(content)` SHALL return `true` for `HtmlCanvasContent` when `content.url != null` (same rule as `UnsupportedCanvasContent`). When only `srcdoc` is set and `url` is absent, `isDownloadable` returns `false` (there is no remote URL to download from).

#### Scenario: HtmlCanvasContent is part of the union

- **WHEN** a function accepts `AttachmentCanvasContent`
- **THEN** it can receive an `HtmlCanvasContent` value without a TypeScript error

---

### Requirement: new `AttachmentCanvasLabels` fields for HTML viewer

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL add four optional fields to `AttachmentCanvasLabels`:

```ts
/** Message shown when a URL-sourced iframe is blocked by the page's CSP or X-Frame-Options. Defaults to `'This page cannot be displayed in preview'`. */
htmlFrameBlockedLabel?: string;

/** Label for the "Open in new tab" fallback link shown alongside `htmlFrameBlockedLabel`. Defaults to `'Open in new tab'`. */
htmlOpenInNewTabLabel?: string;

/** Tooltip / aria-label for the header toggle button when the rendered view is active (clicking switches to source). Defaults to `'View source'`. */
htmlViewSourceLabel?: string;

/** Tooltip / aria-label for the header toggle button when the source view is active (clicking switches back to rendered). Defaults to `'View rendered'`. */
htmlViewRenderedLabel?: string;
```

**i18n impact:** Four new `AttachmentCanvasI18nKeys` members SHALL be added in `apps/chat/src/constants/translation-keys.ts` and four new keys added to `apps/chat/src/i18n/locales/en.json`:

| Key enum member | en.json key | en.json value |
|---|---|---|
| `HtmlFrameBlocked` | `attachmentCanvas.htmlFrameBlocked` | `"This page cannot be displayed in preview"` |
| `HtmlOpenInNewTab` | `attachmentCanvas.htmlOpenInNewTab` | `"Open in new tab"` |
| `HtmlViewSource` | `attachmentCanvas.htmlViewSource` | `"View source"` |
| `HtmlViewRendered` | `attachmentCanvas.htmlViewRendered` | `"View rendered"` |

`AttachmentCanvasContainer` SHALL forward all four labels to the `labels` prop.

#### Scenario: labels have default values

- **WHEN** `AttachmentCanvas` is rendered with a minimal `labels` object (no HTML labels provided)
- **THEN** `HtmlContent` renders the default string `'This page cannot be displayed in preview'` in the blocked state

---

### Requirement: `HtmlContent` renderer component

`libs/attachment-canvas/src/components/HtmlContent/HtmlContent.tsx` SHALL render HTML inside a sandboxed `<iframe>` by default, or as a syntax-highlighted source block when `isSourceView` is `true`.

**View modes:**

`isSourceView` is a **prop** (not internal state) — it is owned and toggled by `AttachmentCanvas` (see the toggle button requirement below).

- **Rendered mode (`isSourceView === false`):** displays the iframe (see below).
- **Source mode (`isSourceView === true`):** renders `content.srcdoc` using `CodeContent` with `language: 'html'`. Only reachable when `content.srcdoc != null`.

**Toggle button:**
- Rendered in the `AttachmentCanvas` panel header (`rightActions`), alongside the download and copy buttons — **not** inside `HtmlContent`.
- Uses `IconCode` ("View source") when rendered view is active; `IconEye` ("View rendered") when source view is active.
- `aria-pressed={isHtmlSourceView}` to expose toggle state.
- Tooltip/`aria-label`: `labels.htmlViewSourceLabel` when rendered; `labels.htmlViewRenderedLabel` when source.
- The toggle button SHALL only be rendered when `content.srcdoc != null`. For `url`-only content the source is not downloaded, so the toggle is hidden.
- `isHtmlSourceView` state is reset to `false` in `AttachmentCanvas` whenever `content` changes.

**`srcdoc` mode (file attachments):**
- Set the iframe's `srcdoc` attribute to `content.srcdoc`.
- The iframe SHALL carry `sandbox="allow-scripts"` — no `allow-same-origin`, no `allow-forms`, no `allow-popups`, no `allow-navigation`.
- The iframe SHALL fill the remaining panel body area (`w-full h-full border-none`).
- No CSP block detection is needed for `srcdoc`; the content is always rendered.

**`src` mode (external URLs):**
- Set the iframe's `src` attribute to `content.url`.
- The iframe SHALL carry `sandbox="allow-scripts allow-same-origin"`. `allow-same-origin` is safe here because the external URL is a different origin from the host app, so the embedded page cannot access the host's cookies or storage.
- **CSP block detection:** attach an `onLoad` handler. Inside `onLoad`, wrap the `contentDocument` access in a `try/catch`. If accessing `contentDocument` throws (cross-origin security error) or `contentDocument` is `null`, set `isBlocked = true`. Also attach an `onError` handler that sets `isBlocked = true` for outright network/load failures.
- When `isBlocked` is `true`, replace the iframe with the blocked-state panel (see below).
- Show a loading spinner while the iframe is loading (`isLoading` state, set to `false` in `onLoad` or `onError`).
- Since source text is not available for URL-only content, the toggle button is not shown.

**Blocked-state panel:**
- Centered in the panel body, same layout as the existing `Unsupported` / `Error` panels.
- Shows `labels.htmlFrameBlockedLabel` (default: `'This page cannot be displayed in preview'`).
- Shows an anchor `<a href={content.url} target="_blank" rel="noopener noreferrer">` with the label `labels.htmlOpenInNewTabLabel` (default: `'Open in new tab'`). The anchor SHALL be styled as a primary button using the existing button design token.
- The anchor SHALL only be rendered when `content.url != null`.

**Props interface (`HtmlContentProps`):**
```ts
interface HtmlContentProps {
  content: HtmlCanvasContent;
  labels: Pick<AttachmentCanvasLabels, 'htmlFrameBlockedLabel' | 'htmlOpenInNewTabLabel'>;
  isSourceView: boolean;
  title?: string;
}
```

`htmlViewSourceLabel` and `htmlViewRenderedLabel` are consumed by `AttachmentCanvas` for the header toggle button, not by `HtmlContent`.

The component MUST NOT read from any app-level context.

**RTL impact:** none — the iframe and blocked-state panel are direction-agnostic. The blocked-state panel text uses logical Tailwind classes (`text-start`, `gap-x-2`, etc.).

**Accessibility:**
- The iframe SHALL carry `title` set to `title` prop value when provided.
- The blocked-state "Open in new tab" anchor SHALL carry `aria-label` indicating it opens in a new tab.
- The toggle button (in `AttachmentCanvas` header) exposes its current state via `aria-pressed`.

#### Scenario: srcdoc content renders iframe by default

- **WHEN** `HtmlContent` is rendered with `{ type: Html, srcdoc: '<p>Hello</p>' }`
- **THEN** the iframe `srcdoc` attribute equals `'<p>Hello</p>'`
- **AND** the source-view toggle button is rendered

#### Scenario: toggle switches to source view

- **WHEN** the user clicks the "View source" toggle button
- **THEN** the iframe is replaced by a syntax-highlighted HTML source block
- **AND** the toggle button label changes to "View rendered"

#### Scenario: toggle switches back to rendered view

- **WHEN** the user is in source view and clicks the "View rendered" toggle button
- **THEN** the source block is replaced by the iframe
- **AND** the toggle button label changes to "View source"

#### Scenario: toggle not shown for url-only content

- **WHEN** `HtmlContent` is rendered with `{ type: Html, url: 'https://example.com/page.html' }` (no `srcdoc`)
- **THEN** no toggle button is rendered

#### Scenario: url content sets iframe src

- **WHEN** `HtmlContent` is rendered with `{ type: Html, url: 'https://example.com/page.html' }`
- **THEN** the iframe `src` attribute equals `'https://example.com/page.html'`

#### Scenario: blocked iframe shows error panel

- **WHEN** the iframe's `onLoad` fires and `contentDocument` access throws
- **THEN** the iframe is replaced by the blocked-state panel
- **AND** the panel shows `htmlFrameBlockedLabel`
- **AND** an "Open in new tab" link pointing to `content.url` is rendered

#### Scenario: blocked panel is not shown for srcdoc

- **WHEN** `HtmlContent` is rendered with `srcdoc` content (no `url`)
- **THEN** no block-detection logic runs and no blocked panel is shown

---

### Requirement: `AttachmentCanvas` switch handles `Html` variant

`libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx` SHALL add a `case AttachmentContentType.Html` branch that renders `<HtmlContent content={content} labels={...} isSourceView={isHtmlSourceView} title={fileName} />`.

The panel chrome SHALL be identical to other content types. The scroll container class for `Html` SHALL be `overflow-hidden` (the iframe and source view manage their own scroll).

**`isHtmlSourceView` state** is owned by `AttachmentCanvas`, initialized to `false`, and reset to `false` whenever `content` changes.

**Toggle button in `rightActions`:** When `content.type === Html && content.srcdoc != null`, a toggle button SHALL be rendered in the panel header alongside the other action buttons:
- `IconCode` ("View source") in rendered mode; `IconEye` ("View rendered") in source mode.
- `aria-pressed={isHtmlSourceView}`.
- Tooltip and `aria-label` use `htmlViewSourceLabel` / `htmlViewRenderedLabel` from `labels`.

The download button SHALL follow `isDownloadable(content)` — shown only when `content.url != null`.

No copy-text action is shown for `Html` content (copying is available in source view via the browser's native selection).

#### Scenario: Html branch renders HtmlContent

- **WHEN** `AttachmentCanvas` receives an `HtmlCanvasContent`
- **THEN** the panel body contains an `HtmlContent` element

#### Scenario: download button shown when url is present

- **WHEN** `AttachmentCanvas` receives `HtmlCanvasContent { url: 'https://...' }` and `onDownload` is provided
- **THEN** the download button is rendered

#### Scenario: download button hidden when only srcdoc is set

- **WHEN** `AttachmentCanvas` receives `HtmlCanvasContent { srcdoc: '<p>...</p>' }` and `onDownload` is provided
- **THEN** the download button is NOT rendered

---

### Requirement: `resolveHtmlCanvasContent` app-layer resolver

`apps/chat/src/utils/attachment-canvas.ts` SHALL export:

```ts
export const resolveHtmlCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<HtmlCanvasContent | ErrorCanvasContent | null>
```

The function SHALL delegate text resolution to the shared `resolveAttachmentText` helper. On success, return `{ type: AttachmentContentType.Html, srcdoc: text }`. A non-`null` `url` from `resolveDialUrl(attachment)` SHALL also be included in the payload (as `url`) so the download button is available.

**Size gate:** When the resolved text length exceeds 1 048 576 characters (1 MiB), the function SHALL return `null` (falling through to `UnsupportedCanvasContent`). This prevents `srcdoc` truncation in browsers that cap the attribute length.

Because `null` also means "this attachment carries no text at all" (an external HTML URL), the caller SHALL distinguish the two with `hasAttachmentTextSource(attachment)` — see the routing requirement below — so a size-gated file is not re-opened as a url-only iframe and reported as frame-blocked.

#### Scenario: file attachment resolves to srcdoc

- **WHEN** `resolveHtmlCanvasContent` is called with an HTML file attachment that has downloadable text
- **THEN** it returns `{ type: AttachmentContentType.Html, srcdoc: <fetched text>, url: <download url> }`

#### Scenario: fetch error propagates

- **WHEN** the underlying fetch returns HTTP 403
- **THEN** `resolveHtmlCanvasContent` returns an `ErrorCanvasContent` with `errorType: Forbidden`

#### Scenario: oversized file falls through

- **WHEN** the resolved text exceeds 1 MiB
- **THEN** `resolveHtmlCanvasContent` returns `null`

---

### Requirement: routing update — html/htm attachments route to `Html`

`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`'s internal `openFileCanvas` SHALL add a branch before the existing `isTextPreviewable` check:

- If the attachment is an HTML source, call `resolveHtmlCanvasContent(attachment)` and open the canvas with the result.

An attachment counts as an HTML source when `isHtmlPreviewable(attachment.name)` is `true` **or** `isHtmlPreviewable(getUrlFileName(attachment.url))` is `true`. The URL fallback is required because a cited source's `name` is its citation title, which usually carries no file extension — matching on the name alone routes such a source to the Unsupported branch. The same combined check SHALL gate the Unsupported branch, so the two cannot disagree.

When `resolveHtmlCanvasContent` returns `null`, the fallback SHALL depend on whether the attachment had text to fetch:

- `hasAttachmentTextSource(attachment) === false` — an external HTML URL. Open `HtmlCanvasContent { url }` so the iframe loads it directly, or return `false` when there is no URL either.
- `hasAttachmentTextSource(attachment) === true` — the text was fetched and rejected by the size gate. Open `UnsupportedCanvasContent`; re-opening it as a url-only iframe would render the frame-blocked panel, telling the user the page refused to be framed when it never was.

`isExternalSourcePreviewable` in `apps/chat/src/utils/attachment-canvas.ts` SHALL be updated to return `true` for `html`/`htm` URL extensions (so external HTML source links open in the canvas rather than a new tab).

For external URL sources (an `AttachmentResource` whose URL path ends in `.html` or `.htm`), the canvas SHALL be opened with `HtmlCanvasContent { url }` — no fetch, the iframe loads the URL directly.

**i18n impact:** see "new `AttachmentCanvasLabels` fields" requirement above.

#### Scenario: html attachment opens Html content type

- **WHEN** the user clicks a `.html` file attachment
- **THEN** `openCanvas` is called with `HtmlCanvasContent { srcdoc: <file text>, url: <download url> }`

#### Scenario: htm attachment opens Html content type

- **WHEN** the user clicks a `.htm` file attachment
- **THEN** `openCanvas` is called with `HtmlCanvasContent { srcdoc: <file text> }`

#### Scenario: external html URL opens Html content type

- **WHEN** an `AttachmentResource` URL ends with `.html`
- **THEN** `openCanvas` is called with `HtmlCanvasContent { url: <resource url> }`
- **AND** no text fetch is performed

#### Scenario: cited source with an extension-less title opens Html content type

- **WHEN** a cited source's `name` is a title with no file extension and its URL path ends with `.html`
- **THEN** `openCanvas` is called with `HtmlCanvasContent { url: <resource url> }`, not `UnsupportedCanvasContent`

#### Scenario: oversized html file opens the unsupported panel

- **WHEN** an HTML file attachment's text exceeds the srcdoc size gate, so `resolveHtmlCanvasContent` returns `null`
- **THEN** `openCanvas` is called with `UnsupportedCanvasContent`, and the frame-blocked panel is not shown
